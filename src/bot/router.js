// SINGLE dispatcher for every bot message.
//
// Why one dispatcher instead of multiple on() handlers?
//   - Avoids cascading-handler bugs where one handler's state mutations
//     interfere with downstream handlers
//   - One place to add logging, tracing, rate-limiting, dedup
//   - Easier to reason about and test

import { InputFile } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { db } from "../db/supabase.js";
import { config } from "../config.js";
import { parseReceipt } from "../ai/receipt.js";
import {
  insertExpenses, listInRange, totalsByCategory, getLast, deleteLast,
  getRecent, updateExpense, allTimeStats, deleteAll, deleteInRange, deleteMatch,
} from "../services/expenses.js";
import { setBudget, listBudgets as getBudgets } from "../services/budgets.js";
import { setReminder, disableReminders } from "../services/users.js";
import { recomputeStreak } from "../services/streaks.js";
import { renderReportImage, renderEmptyImage } from "../utils/bar-image.js";
import { stripGpayBoilerplate } from "../utils/gpay.js";
import { inr } from "../utils/money.js";
import { dayRangeInTz, weekRangeInTz, monthRangeInTz, formatRangeLabel } from "../utils/time.js";

// ---------- Constants ----------

const CATEGORIES = new Set([
  "Food", "Transport", "Shopping", "Groceries", "Bills", "Entertainment",
  "Health", "Education", "Rent", "Subscriptions", "Personal", "Travel",
  "Investment", "Gifts", "Other",
]);

const DEFAULT_PAYMENT = "upi";

const BRAND_CATEGORY = {
  zomato: "Food", swiggy: "Food", dunzo: "Food", bigbasket: "Groceries",
  blinkit: "Groceries", zepto: "Groceries", instamart: "Groceries",
  amazon: "Shopping", flipkart: "Shopping", myntra: "Shopping", ajio: "Shopping",
  uber: "Transport", ola: "Transport", rapido: "Transport",
  irctc: "Travel", makemytrip: "Travel", cleartrip: "Travel", goibibo: "Travel",
  bookmyshow: "Entertainment", netflix: "Subscriptions", spotify: "Subscriptions",
  airtel: "Bills", jio: "Bills", vi: "Bills", bsnl: "Bills", act: "Bills",
  bescom: "Bills", electricity: "Bills",
  paytm: "Personal", phonepe: "Personal",
};

const KEYWORD_CATEGORY = {
  food: "Food", groceries: "Groceries", grocery: "Groceries", kirana: "Groceries",
  taxi: "Transport", auto: "Transport", cab: "Transport", uber: "Transport",
  ola: "Transport", rapido: "Transport", fuel: "Transport", petrol: "Transport",
  shopping: "Shopping", clothes: "Shopping",
  bills: "Bills", bill: "Bills", electricity: "Bills", rent: "Rent", recharge: "Bills",
  entertainment: "Entertainment", movie: "Entertainment", movies: "Entertainment",
  health: "Health", medical: "Health", pharmacy: "Health", medicine: "Health",
  education: "Education", books: "Education", course: "Education",
  subscriptions: "Subscriptions",
  personal: "Personal",
  travel: "Travel", trip: "Travel", flight: "Travel", train: "Travel",
  investment: "Investment", sip: "Investment",
  gift: "Gifts", gifts: "Gifts",
  misc: "Other", other: "Other",
};

const VALID_CATEGORY_LIST = [...CATEGORIES].slice(0, -1).join(", ") + ", Other";

const TEXT_PROMPT = `You are the parser for a personal expense-tracking Telegram bot.
The user is in India and speaks casual English, often mixed with Hindi/Telugu (Hinglish). Currency is INR.

Output strict JSON (no markdown fences).

Top-level shapes:
1) { "kind": "expenses", "items": [ Expense, ... ] }
2) { "kind": "query", "intent": "today"|"week"|"month"|"help"|"streak"|"budget"|"methods" }
3) { "kind": "undo" }
4) { "kind": "recategorize", "category": "Food", "subcategory": "Lunch" }
5) { "kind": "delete_match", "match": "<substring>" }
6) { "kind": "set_budget", "category": "Food", "amount": 5000 }
7) { "kind": "update_last", "patch": { ...partial fields... } }   ← corrections
8) { "kind": "chitchat" }

Expense: { amount:number, category:string, subcategory?:string, merchant?:string, payment_mode?: "cash"|"upi"|"card"|"netbanking"|"wallet"|"other", note?:string, spent_at_hint?:ISO }

Categories: Food, Transport, Shopping, Groceries, Bills, Entertainment, Health, Education, Rent, Subscriptions, Personal, Travel, Investment, Gifts, Other.

Rules:
- Output strict JSON. No commentary. No markdown fences.
- "spent"/"paid"/"given" indicate expenses.
- Numbers: "2.5k" → 2500, "1.2 lakh" → 120000, "two fifty" → 250.
- "change it"/"actually it was"/"no wait"/"make that" = correction → update_last with patch. Only include CHANGED fields.
- Merchant normalization: "zom"/"zomato" → "Zomato", "swiggy" → "Swiggy", "uber" → "Uber", "ola" → "Ola".
- If no amount found in a clear expense statement, return {"kind":"chitchat"}.
- A bare category word ("rent", "food") alone is chitchat, not an expense.
`;

// ---------- Helpers ----------

function applyDefaults(e) {
  const out = { ...e };
  if (!out.payment_mode || !String(out.payment_mode).trim()) out.payment_mode = DEFAULT_PAYMENT;
  else out.payment_mode = String(out.payment_mode).toLowerCase().trim();
  return out;
}

function validateExpense(e) {
  const errs = [];
  if (!(Number(e.amount) > 0)) errs.push("amount");
  if (!e.category) errs.push("category");
  if (e.category && !CATEGORIES.has(e.category)) errs.push(`unknown category ${e.category}`);
  return errs;
}

function prettyExpense(e) {
  const parts = [inr(e.amount), e.category];
  if (e.merchant && e.merchant !== "local") parts.push(`@ ${e.merchant}`);
  if (e.payment_mode) parts.push(`· ${e.payment_mode.toUpperCase()}`);
  return parts.join(" ");
}

function categoryFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (KEYWORD_CATEGORY[t]) return KEYWORD_CATEGORY[t];
  const first = t.split(/\s+/)[0];
  if (KEYWORD_CATEGORY[first]) return KEYWORD_CATEGORY[first];
  return null;
}

function categoryForBrand(payee) {
  if (!payee) return null;
  const key = payee.toLowerCase().split(/\s+/)[0];
  return BRAND_CATEGORY[key] || null;
}

async function getUserTz(telegramId) {
  try {
    const { data } = await db().from("users").select("timezone").eq("telegram_id", telegramId).maybeSingle();
    return data?.timezone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

async function userBudgets(telegramId) {
  const out = {};
  try {
    const { data } = await db()
      .from("budgets")
      .select("category, monthly_limit")
      .eq("telegram_id", telegramId);
    for (const b of data || []) out[b.category] = Number(b.monthly_limit);
  } catch (e) {
    console.warn("[router] budgets fetch failed:", e.message);
  }
  return out;
}

function safeParseLLM(raw) {
  try { return JSON.parse(raw); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("LLM returned non-JSON");
    return JSON.parse(m[0]);
  }
}

function isTransientLLMError(msg) {
  return /429|503|500|504|UNAVAILABLE|RESOURCE_EXHAUSTED|quota|overloaded|high demand|timeout|ENOTFOUND|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg || "");
}

function translateLLMError(msg) {
  if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED"))
    return "⏳ AI rate limit reached. Try again in a minute, or wait a few hours.";
  if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded") || msg.includes("high demand"))
    return "⚠️ AI providers are busy. Try again in a minute.";
  if (msg.includes("404") || msg.includes("not found"))
    return "Model not available. Please ping the owner.";
  if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ETIMEDOUT"))
    return "Network problem reaching the AI. Try again in a moment.";
  if (msg.includes("No LLM provider")) return "Bot has no LLM configured. Ping the owner.";
  return "I couldn't parse that. Try \"200 on Zomato\" or \"300 Uber\".";
}

// ---------- LLM providers ----------

async function callGeminiText(text, recent) {
  const genai = new GoogleGenerativeAI(config.gemini.apiKey);
  const m = genai.getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: { role: "system", parts: [{ text: TEXT_PROMPT }] },
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" },
  });
  const ctx = recent.length ? `\n\nRecent:\n${JSON.stringify(recent)}` : "";
  const r = await m.generateContent(text + ctx);
  return r.response.text();
}

async function callGroqText(text, recent) {
  const messages = [{ role: "system", content: TEXT_PROMPT }];
  if (recent.length) messages.push({ role: "system", content: `Recent:\n${JSON.stringify(recent)}` });
  messages.push({ role: "user", content: text });
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.groq.apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages, temperature: 0.1, max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

async function callLLM(text, recent) {
  const providers = [
    { name: "gemini", fn: () => callGeminiText(text, recent), ok: !!config.gemini.apiKey },
    { name: "groq",   fn: () => callGroqText(text, recent),   ok: !!config.groq.apiKey && config.groq.apiKey.length > 10 },
  ].filter(p => p.ok);

  if (!providers.length) {
    throw new Error("No LLM provider configured. Set GEMINI_API_KEY or GROQ_API_KEY.");
  }

  let lastErr;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    try {
      const raw = await p.fn();
      const parsed = safeParseLLM(raw);
      if (!parsed?.kind) throw new Error("No kind in response");
      return parsed;
    } catch (e) {
      const msg = String(e?.message || e);
      console.warn(`[llm] ${p.name} failed: ${msg.slice(0, 200)}`);
      lastErr = e;
      if (!isTransientLLMError(msg) || i === providers.length - 1) throw e;
    }
  }
  throw lastErr;
}

// ---------- Main dispatcher ----------

export async function route(ctx, msg) {
  const id = ctx.from?.id;
  if (!id) return;
  try {
    switch (msg.kind) {
      case "command": return await handleCommand(ctx, msg);
      case "text":    return await handleText(ctx, msg.text || "");
      case "voice":   return await handleVoice(ctx);
      case "photo":   return await handlePhoto(ctx);
      default:        return ctx.reply("Unsupported message.");
    }
  } catch (e) {
    console.error(`[route] ${msg.kind} crashed:`, e?.message);
    try { await ctx.reply("Something went wrong. Try again."); } catch {}
  }
}

// ---------- Voice (Groq Whisper) ----------

async function handleVoice(ctx) {
  if (!config.groq.apiKey) {
    return ctx.reply("🎙️ Voice transcription isn't configured.");
  }
  const voice = ctx.message.voice;
  await ctx.reply("Transcribing…");
  try {
    const file = await ctx.api.getFile(voice.file_id);
    const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());

    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/ogg" }), "voice.ogg");
    form.append("model", "whisper-large-v3");
    form.append("response_format", "json");
    form.append("language", "en");
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.groq.apiKey}` },
      body: form,
    });
    if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const transcript = (j.text || "").trim();
    if (!transcript) return ctx.reply("Couldn't transcribe. Mind typing it out?");

    await ctx.reply(`Heard: _${transcript}_`, { parse_mode: "Markdown" });
    return await handleText(ctx, transcript);
  } catch (e) {
    console.error("[voice] failed:", e.message);
    return ctx.reply("Couldn't transcribe. Try typing the expense.");
  }
}

// ---------- Photo (GPay receipts) ----------

async function handlePhoto(ctx) {
  const photos = ctx.message.photo;
  const largest = photos[photos.length - 1];
  const fileId = largest.file_unique_id || largest.file_id;
  const id = ctx.from.id;

  // Dedup check
  if (fileId) {
    const { data: existing } = await db()
      .from("expenses")
      .select("id, amount, category, merchant")
      .eq("telegram_id", id)
      .eq("source_file_id", fileId)
      .maybeSingle();
    if (existing) {
      return ctx.reply(
        `Already logged that receipt — ${inr(existing.amount)} ${existing.category}` +
        (existing.merchant ? ` @ ${existing.merchant}` : "") +
        `\n\n_Use /undo if it was a mistake._`,
        { parse_mode: "Markdown" }
      );
    }
  }

  let buf;
  try {
    const file = await ctx.api.getFile(largest.file_id);
    const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return ctx.reply("Couldn't download the image. Try again or type the expense directly.");
  }

  const caption = stripGpayBoilerplate((ctx.message.caption || "").trim());

  let ocr;
  try {
    ocr = await parseReceipt({ imageBuffer: buf, mimeType: "image/jpeg", caption });
  } catch (e) {
    const msg = String(e?.message || e);
    return ctx.reply(
      translateLLMError(msg) + "\n\n_As a fallback, type the expense — e.g. \"200 on Swiggy via UPI\"."
    );
  }

  if (!ocr.ok) {
    return ctx.reply(
      `*I couldn't read the receipt.*\n\n${ocr.ask || "Could you tell me the amount and who you paid?"}\n\n` +
      `_Tip: just type it like a normal expense — e.g. "200 on Swiggy"._`,
      { parse_mode: "Markdown" }
    );
  }

  // Resolve category: caption keyword > brand map > "Other"
  let category = categoryFromText(caption) || categoryForBrand(ocr.payee) || "Other";

  // Sanity-check datetime
  let spentAt = new Date().toISOString();
  if (ocr.datetime) {
    const parsed = new Date(ocr.datetime);
    if (!isNaN(parsed.getTime())) {
      const diff = Math.abs(parsed.getTime() - Date.now());
      if (diff < 24 * 60 * 60 * 1000) spentAt = parsed.toISOString();
    }
  }

  const expense = {
    amount: Number(ocr.amount),
    category,
    merchant: ocr.payee_kind === "brand" ? ocr.payee : "local",
    payment_mode: "upi",
    note: [
      ocr.ocr_text ? ocr.ocr_text.slice(0, 400) : null,
      ocr.payee_kind === "local" && ocr.payee ? `payee: ${ocr.payee}` : null,
    ].filter(Boolean).join("\n") || null,
    spent_at: spentAt,
    source_file_id: fileId,
  };

  // Insert (with unique-constraint dedup fallback)
  try {
    await insertExpenses(id, [expense]);
  } catch (e) {
    if (fileId && (e?.message?.includes("expenses_telegram_file_unique") || e?.code === "23505")) {
      return ctx.reply(`Already logged that receipt.`);
    }
    console.error("[photo] insert error:", e.message);
    return ctx.reply("Couldn't save the expense. Try again.");
  }

  const streak = await recomputeStreak(id);
  const merchantLabel = expense.merchant === "local" ? "@ local" : `@ ${expense.merchant}`;
  await ctx.reply(
    `*Logged*\n  ${inr(expense.amount)}  ${category}  ${merchantLabel}\n` +
    (streak > 0 ? `🔥 Streak: ${streak} day${streak === 1 ? "" : "s"}\n` : "") +
    (category === "Other"
      ? `\n_Category defaulted to Other. Use \`/recat ${category === "Other" ? "Food" : "Food"}\` to change it._`
      : ""),
    { parse_mode: "Markdown" }
  );
}

// ---------- Text messages ----------

async function handleText(ctx, rawText) {
  const text = (rawText || "").trim();
  if (!text) return ctx.reply("Send a text, voice, or photo. /help for examples.");

  // Bare-category-word? Don't try to log, just explain.
  const cat = categoryFromText(text);
  if (cat) {
    return ctx.reply(
      `Got "${text}" — that's a category, not an expense.\n` +
      `To log one, include the amount: e.g. "200 on food" or "500 rent".\n` +
      `Or /recat ${cat} to recategorize your last entry.`
    );
  }

  let parsed;
  try {
    const recent = await getRecent(ctx.from.id, 3);
    parsed = await callLLM(text, recent);
  } catch (e) {
    const msg = String(e?.message || e);
    console.error("[text] LLM failed:", msg);
    return ctx.reply(translateLLMError(msg));
  }

  switch (parsed.kind) {
    case "expenses":     return await saveExpenses(ctx, parsed.items || []);
    case "query":        return await renderReport(ctx, parsed.intent);
    case "methods":      return await renderMethods(ctx);
    case "undo":         return cmdUndo(ctx);
    case "recategorize": return await cmdRecatFromLLM(ctx, parsed.category, parsed.subcategory);
    case "delete_match": return cmdDeleteMatch(ctx, parsed.match);
    case "update_last":  return cmdUpdateLast(ctx, parsed.patch);
    case "set_budget":   return cmdSetBudget(ctx, parsed.category, parsed.amount);
    case "chitchat":
    default:             return ctx.reply("Try \"200 on Zomato\" or \"300 Uber\".");
  }
}

// ---------- Save expenses (text + voice) ----------

async function saveExpenses(ctx, items) {
  const clean = items
    .map(e => applyDefaults(e))
    .map(e => ({ ...e, raw_text: ctx.message?.text || ctx.message?.caption || "" }))
    .filter(e => validateExpense(e).length === 0);

  if (!clean.length) {
    return ctx.reply(
      `Couldn't extract a valid amount. Try:\n` +
      `  • "150 on coffee"\n  • "Spent 200 on Zomato"\n  • "200 on taxi, change to 400" (correction)`
    );
  }

  const inserted = await insertExpenses(ctx.from.id, clean);
  const streak = await recomputeStreak(ctx.from.id);
  const total = inserted.reduce((s, r) => s + Number(r.amount), 0);

  const lines = inserted.map(r => {
    const merch = r.merchant && r.merchant !== "local" ? `@ ${r.merchant}` : "";
    return `  ${inr(r.amount).padStart(10)}  ${r.category}  ${merch}`;
  });

  await ctx.reply(
    `*Logged ${inserted.length} ${inserted.length === 1 ? "entry" : "entries"}*\n` +
    lines.join("\n") +
    `\n\n*Total:* ${inr(total)}` +
    (streak > 0 ? `\n🔥 Streak: ${streak} day${streak === 1 ? "" : "s"}` : ""),
    { parse_mode: "Markdown" }
  );
}

// ---------- Reports ----------

async function renderReport(ctx, intent) {
  const tz = await getUserTz(ctx.from.id);
  let range, title, scopeNote;
  if (intent === "today") {
    range = dayRangeInTz(tz);
    title = "Today";
    scopeNote = "Budgets are monthly. % is share used today.";
  } else if (intent === "week") {
    range = weekRangeInTz(tz);
    title = "Last 7 days";
    scopeNote = "Budgets are monthly. % is share used this week.";
  } else if (intent === "month") {
    range = monthRangeInTz(tz);
    title = "This month";
    scopeNote = "Budgets are monthly.";
  } else {
    return ctx.reply("Try /today, /week, or /month.");
  }

  const { total, byCategory, count } = await totalsByCategory(ctx.from.id, range.from, range.to);
  if (count === 0) {
    return ctx.reply(`*${title}*\n\nNothing yet. Send a voice or text like "200 on lunch" to start.`, { parse_mode: "Markdown" });
  }

  const budgets = await userBudgets(ctx.from.id);
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const rows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => ({
      label: cat,
      sublabel: budgets[cat] ? `budget ${inr(budgets[cat])}/mo` : "no budget",
      amount: amt,
      budget: budgets[cat] || 0,
    }));

  const buf = await renderReportImage({
    title,
    range: formatRangeLabel(range.from, range.to, tz),
    total, count,
    topLine: `Biggest: ${top[0]} ${inr(top[1])}`,
    rows,
    footer: scopeNote,
  });

  await ctx.replyWithPhoto(new InputFile(buf, "report.png"),
    { caption: `*${title}* · ${count} ${count === 1 ? "entry" : "entries"} · total ${inr(total)}`, parse_mode: "Markdown" });
}

async function renderMethods(ctx) {
  const tz = await getUserTz(ctx.from.id);
  const r = monthRangeInTz(tz);
  const rows = await listInRange(ctx.from.id, r.from, r.to);
  if (!rows.length) return ctx.reply("*Payment methods*\n\nNo expenses this month yet.");

  const totals = new Map();
  for (const row of rows) {
    const k = (row.payment_mode || "unknown").toLowerCase();
    totals.set(k, (totals.get(k) || 0) + Number(row.amount));
  }
  const total = [...totals.values()].reduce((s, v) => s + v, 0);
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const labels = { upi: "UPI", card: "Card", cash: "Cash", wallet: "Wallet", netbanking: "Net Banking", other: "Other", unknown: "Unknown" };

  const lines = entries.map(([mode, amt]) => {
    const pct = total ? Math.round((amt / total) * 100) : 0;
    return `  ${labels[mode] || mode}  ${inr(amt).padStart(9)}  ${pct}%`;
  });

  await ctx.reply(
    `*Payment methods · ${formatRangeLabel(r.from, r.to, tz)}*\n\n` +
    lines.join("\n") +
    `\n\n*Total* ${inr(total)}`,
    { parse_mode: "Markdown" }
  );
}

// ---------- Commands ----------

async function handleCommand(ctx, msg) {
  const id = ctx.from.id;
  const arg = (msg.arg || "").trim();
  switch (msg.name) {
    case "start":    return cmdStart(ctx);
    case "help":     return cmdHelp(ctx);
    case "today":    return renderReport(ctx, "today");
    case "week":     return renderReport(ctx, "week");
    case "month":    return renderReport(ctx, "month");
    case "all":      return cmdAll(ctx);
    case "methods":  return renderMethods(ctx);
    case "budget":   return cmdBudget(ctx, arg);
    case "undo":     return cmdUndo(ctx);
    case "recat":    return cmdRecat(ctx, arg);
    case "reminder": return cmdReminder(ctx, arg);
    case "clear":    return cmdClear(ctx, arg);
    case "debug":    return cmdDebug(ctx);
    case "health":   return cmdHealth(ctx);
    default:         return ctx.reply("Unknown command. /help");
  }
}

async function cmdStart(ctx) {
  await ctx.reply(
    [
      "👋 *Welcome*",
      "",
      "I log what you spend. Examples:",
      "  • _\"Spent 200 on Zomato\"_ (defaults to UPI)",
      "  • _\"150 cash on chai\"_",
      "  • _\"200 on taxi, change to 400\"_ (correction)",
      "  • Send a 📷 GPay receipt — I'll auto-read it.",
      "",
      "Tap /help for all commands.",
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
}

async function cmdHelp(ctx) {
  await ctx.reply(
    [
      "*Commands*",
      "",
      "*REPORTS*",
      "  /today — what you spent today",
      "  /week  — last 7 days",
      "  /month — this month",
      "  /all   — all-time report",
      "  /methods — by payment mode (UPI/cash/card)",
      "",
      "*BUDGETS*",
      "  /budget — show all budgets",
      "  /budget Food 5000 — set Food's monthly limit",
      "",
      "*EDIT*",
      "  /undo — delete the most recent entry",
      "  /recat Food — recategorize the last entry",
      "  /clear — bulk delete (asks: today / week / month / all)",
      "",
      "*SETTINGS*",
      "  /reminder 21:30 — set daily check-in time",
      "  /reminder off — disable reminders",
      "",
      "*OTHER*",
      "  /debug — show recent raw entries",
      "  /health — show bot status",
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
}

async function cmdAll(ctx) {
  const stats = await allTimeStats(ctx.from.id);
  if (!stats.count) return ctx.reply("No entries yet. Send your first expense.");

  const fmt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
  });
  const first = fmt.format(new Date(stats.first));
  const last  = fmt.format(new Date(stats.last));
  const days = Math.max(1, Math.round((new Date(stats.last) - new Date(stats.first)) / 86_400_000) + 1);
  const avgDay = Math.round(stats.total / days);
  const avgEntry = Math.round(stats.total / stats.count);
  const catEntries = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const lines = [
    `*All-time*`,
    `_${first} → ${last}_   ${days} day${days === 1 ? "" : "s"}`,
    "",
    `${stats.count} ${stats.count === 1 ? "entry" : "entries"}  ·  total *${inr(stats.total)}*`,
    `avg  ${inr(avgEntry)}/entry  ·  ${inr(avgDay)}/day`,
    "",
    "*Top categories*",
  ];
  for (const [cat, amt] of catEntries) {
    const pct = Math.round((amt / stats.total) * 100);
    lines.push(`  ${cat.padEnd(15)}  ${inr(amt).padStart(9)}  ${pct}%`);
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}

async function cmdBudget(ctx, arg) {
  if (!arg) {
    const all = await getBudgets(ctx.from.id);
    if (!all.length) return ctx.reply("No budgets set. Try `/budget Food 5000`");
    const lines = ["*Your monthly budgets*", ""];
    for (const b of all) {
      lines.push(`  ${b.category.padEnd(15)}  ${inr(b.monthly_limit).padStart(9)}`);
    }
    return ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  }
  const parts = arg.split(/\s+/);
  const numeric = parts.find(p => /[\d.k]+/i.test(p));
  const alpha = parts.find(p => /^[a-zA-Z]+$/.test(p));
  if (!numeric || !alpha) return ctx.reply("Usage: /budget <Category> <amount>\nExample: /budget Food 5000");
  let amount = Number(numeric.toLowerCase().replace("k", ""));
  if (numeric.toLowerCase().endsWith("k")) amount *= 1000;
  if (!(amount > 0)) return ctx.reply("Amount must be positive.");
  const category = alpha[0].toUpperCase() + alpha.slice(1).toLowerCase();
  await setBudget(ctx.from.id, category, amount);
  return ctx.reply(`📊 *Budget set*\n\n  ${category}  →  *${inr(amount)}* / month`, { parse_mode: "Markdown" });
}

async function cmdSetBudget(ctx, category, amount) {
  if (!CATEGORIES.has(category)) return ctx.reply(`Unknown category. Try: ${VALID_CATEGORY_LIST}.`);
  if (!(amount > 0)) return ctx.reply("Amount must be > 0.");
  await setBudget(ctx.from.id, category, amount);
  return ctx.reply(`📊 *Budget set*\n\n  ${category}  →  *${inr(amount)}* / month`, { parse_mode: "Markdown" });
}

async function cmdUndo(ctx) {
  const last = await getLast(ctx.from.id);
  if (!last) return ctx.reply("Nothing to undo — your ledger is empty.");
  await deleteLast(ctx.from.id);
  await recomputeStreak(ctx.from.id);
  return ctx.reply(`*Removed*\n  ${prettyExpense(last)}`, { parse_mode: "Markdown" });
}

async function cmdRecat(ctx, arg) {
  const text = (arg || "").trim();
  if (!text) return ctx.reply("Usage: /recat <category>\nExample: /recat Food");
  const cat = KEYWORD_CATEGORY[text.toLowerCase()] || (CATEGORIES.has(text) ? text : null);
  if (!cat) return ctx.reply(`Unknown category "${text}". Try: ${VALID_CATEGORY_LIST}.`);
  const last = await getLast(ctx.from.id);
  if (!last) return ctx.reply("Nothing to recategorize.");
  await updateExpense(ctx.from.id, last.id, { category: cat });
  return ctx.reply(`*Recategorized*\n  ${prettyExpense({ ...last, category: cat })}`, { parse_mode: "Markdown" });
}

async function cmdRecatFromLLM(ctx, category, subcategory) {
  if (!category) return ctx.reply("Which category? Use /recat <name>.");
  const last = await getLast(ctx.from.id);
  if (!last) return ctx.reply("Nothing to recategorize.");
  const patch = { category };
  if (subcategory) patch.subcategory = subcategory;
  const updated = await updateExpense(ctx.from.id, last.id, patch);
  return ctx.reply(`*Recategorized*\n  ${prettyExpense(updated)}`, { parse_mode: "Markdown" });
}

async function cmdUpdateLast(ctx, patch) {
  const last = await getLast(ctx.from.id);
  if (!last) return ctx.reply("No recent entry to update.");
  const clean = Object.fromEntries(
    Object.entries(patch || {}).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );
  if (!Object.keys(clean).length) return ctx.reply("Nothing to update.");
  const updated = await updateExpense(ctx.from.id, last.id, clean);
  return ctx.reply(`*Updated*\n  ${prettyExpense(updated)}`, { parse_mode: "Markdown" });
}

async function cmdDeleteMatch(ctx, match) {
  const removed = await deleteMatch(ctx.from.id, match);
  if (!removed) return ctx.reply("Couldn't find a matching entry.");
  return ctx.reply(`*Removed*\n  ${prettyExpense(removed)}`, { parse_mode: "Markdown" });
}

async function cmdReminder(ctx, arg) {
  const t = (arg || "").trim();
  if (!t || t === "off") {
    if (t === "off") {
      await disableReminders(ctx.from.id);
      return ctx.reply("🔕 Reminders disabled. Re-enable with /reminder 21:00");
    }
    const { data } = await db().from("users").select("reminder_hour, reminder_minute, reminder_enabled").eq("telegram_id", ctx.from.id).maybeSingle();
    if (!data) return ctx.reply("Run /start first.");
    const hh = String(data.reminder_hour).padStart(2, "0");
    const mm = String(data.reminder_minute).padStart(2, "0");
    const status = data.reminder_enabled ? "ON" : "OFF";
    return ctx.reply(`⏰ Reminder is ${status} — ${hh}:${mm}\n\nChange with /reminder 21:30 (24h) or /reminder off`);
  }
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return ctx.reply("Use 24h format: /reminder 21:30");
  try {
    const [, hh, mm] = m;
    await setReminder(ctx.from.id, Number(hh), Number(mm));
    return ctx.reply(`⏰ Reminder set to ${hh.padStart(2,"0")}:${mm} daily.`);
  } catch {
    return ctx.reply("Invalid time. Use HH:MM, e.g. /reminder 21:00");
  }
}

async function cmdClear(ctx, arg) {
  const scope = (arg || "").trim().toLowerCase();
  if (!scope) {
    return ctx.reply(
      "*Clear data*\n\n  /clear today — only today\n  /clear week  — last 7 days\n  /clear month — this month\n  /clear all   — everything (irreversible)",
      { parse_mode: "Markdown" }
    );
  }
  const tz = await getUserTz(ctx.from.id);
  let count = 0, label = "";
  if (scope === "today") {
    const r = dayRangeInTz(tz);
    count = await deleteInRange(ctx.from.id, r.from, r.to);
    label = "today";
  } else if (scope === "week") {
    const r = weekRangeInTz(tz);
    count = await deleteInRange(ctx.from.id, r.from, r.to);
    label = "the last 7 days";
  } else if (scope === "month") {
    const r = monthRangeInTz(tz);
    count = await deleteInRange(ctx.from.id, r.from, r.to);
    label = "this month";
  } else if (scope === "all") {
    count = await deleteAll(ctx.from.id);
    label = "all entries";
  } else {
    return ctx.reply("Unknown scope. Try: today, week, month, or all.");
  }
  if (count === 0) return ctx.reply(`Nothing to clear — no entries in ${label}.`);
  await db().from("users").update({ streak_days: 0, last_log_date: null }).eq("telegram_id", ctx.from.id);
  return ctx.reply(`🗑️ *Cleared ${count} ${count === 1 ? "entry" : "entries"}* (${label}). Streak reset.`, { parse_mode: "Markdown" });
}

async function cmdDebug(ctx) {
  const rows = await getRecent(ctx.from.id, 10);
  if (!rows.length) return ctx.reply("No entries yet.");
  const lines = ["*Last 10 entries*", ""];
  for (const r of rows) {
    const t = (r.spent_at || "").slice(0, 16).replace("T", " ");
    const amt = inr(r.amount).padStart(8);
    const cat = (r.category || "-").padEnd(13);
    const pm = (r.payment_mode || "-").toUpperCase().padEnd(4);
    const m = r.merchant ? ` @${r.merchant}` : "";
    lines.push(`  ${t}  ${amt}  ${cat}  ${pm}${m}`);
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}

async function cmdHealth(ctx) {
  const providers = [];
  if (config.gemini.apiKey) providers.push(`gemini(${config.gemini.model})`);
  if (config.groq.apiKey && config.groq.apiKey.length > 10) providers.push("groq");
  await ctx.reply(
    `*Health*\n\n` +
    `  LLM: ${providers.join(", ") || "none"}\n` +
    `  Voice: ${config.groq.apiKey ? "✓" : "✗"}\n` +
    `  OCR model: ${process.env.OCR_MODEL || "gemini-flash-lite-latest"}\n` +
    `  Telegram: connected`,
    { parse_mode: "Markdown" }
  );
}
