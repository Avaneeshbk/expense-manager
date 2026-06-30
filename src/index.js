// Entry point — single-file router for all messages.
//
// Architecture: ONE catch-all message handler in this file. All bot logic
// (commands, text, voice, photo) routes through a single dispatcher function
// in src/bot/router.js. This avoids the cascading-handler bug class where
// a handler's side effects (session state, DB writes) interact unexpectedly
// with downstream handlers.

import "dotenv/config";
import { Bot } from "grammy";
import cron from "node-cron";

import { config } from "./config.js";
import { getOrCreateUser } from "./services/users.js";
import { route } from "./bot/router.js";
import { tickReminders } from "./services/reminders.js";

if (!config.telegram.botToken) {
  console.error("TELEGRAM_BOT_TOKEN missing. Set it in .env and try again.");
  process.exit(1);
}

const bot = new Bot(config.telegram.botToken);

// Per-message middleware: ensure the user is registered.
// We pass ctx into route() rather than registering multiple on() handlers.
// This is THE ONLY bot.on() call for messages (commands still use bot.command).
bot.use(async (ctx, next) => {
  if (ctx.from) {
    try {
      await getOrCreateUser(ctx.from);
    } catch (e) {
      console.error("user upsert failed:", e.message);
    }
  }
  await next();
});

// All commands
bot.command("start",    (ctx) => route(ctx, { kind: "command", name: "start" }));
bot.command("help",     (ctx) => route(ctx, { kind: "command", name: "help" }));
bot.command("today",    (ctx) => route(ctx, { kind: "command", name: "today" }));
bot.command("week",     (ctx) => route(ctx, { kind: "command", name: "week" }));
bot.command("month",    (ctx) => route(ctx, { kind: "command", name: "month" }));
bot.command("all",      (ctx) => route(ctx, { kind: "command", name: "all" }));
bot.command("methods",  (ctx) => route(ctx, { kind: "command", name: "methods" }));
bot.command("budget",   (ctx) => route(ctx, { kind: "command", name: "budget", arg: ctx.match || "" }));
bot.command("undo",     (ctx) => route(ctx, { kind: "command", name: "undo" }));
bot.command("recat",    (ctx) => route(ctx, { kind: "command", name: "recat", arg: ctx.match || "" }));
bot.command("reminder", (ctx) => route(ctx, { kind: "command", name: "reminder", arg: ctx.match || "" }));
bot.command("clear",    (ctx) => route(ctx, { kind: "command", name: "clear", arg: ctx.match || "" }));
bot.command("debug",    (ctx) => route(ctx, { kind: "command", name: "debug" }));
bot.command("health",   (ctx) => route(ctx, { kind: "command", name: "health" }));

// ONE catch-all for non-command messages. We route based on message type.
bot.on("message", async (ctx) => {
  const msg = ctx.message;
  if (!msg) return;

  if (msg.voice)        return route(ctx, { kind: "voice" });
  if (msg.photo)        return route(ctx, { kind: "photo" });
  if (msg.text)         return route(ctx, { kind: "text", text: msg.text });
  if (msg.caption)      return route(ctx, { kind: "text", text: msg.caption });
  // Anything else (sticker, location, contact, etc.)
  return ctx.reply("Send a text, voice note, or photo of a GPay receipt.");
});

// Generic error handler
bot.catch((err) => {
  console.error("[bot] error:", err.error?.message || err.message || err);
  if (err.ctx) {
    try {
      err.ctx.reply("Something went wrong on my end. Try again, or type /help.").catch(() => {});
    } catch {}
  }
});

// --- Reminder scheduler -----------------------------------------------------
cron.schedule("* * * * *", async () => {
  try {
    const res = await tickReminders(async (telegramId, text) => {
      await bot.api.sendMessage(telegramId, text);
    });
    if (res.sent > 0) console.log(`[reminders] sent ${res.sent}, skipped ${res.skipped}`);
  } catch (e) {
    console.error("[reminders] tick error:", e.message);
  }
}, { timezone: config.reminders.timezone });

// --- Self-ping ---------------------------------------------------------------
// Kept for compatibility if you ever move back to a Render Web Service.
// On Fly.io the bot stays warm naturally, so this is a no-op when
// RENDER_EXTERNAL_URL isn't set.
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(process.env.RENDER_EXTERNAL_URL).catch(() => {});
  }, 14 * 60 * 1000);
}

// --- Boot -------------------------------------------------------------------
bot.start();
console.log("✅ Expense manager bot is up.");
console.log(`   Reminder timezone: ${config.reminders.timezone}`);
console.log(`   Default reminder: ${String(config.reminders.defaultHour).padStart(2,"0")}:${String(config.reminders.defaultMin).padStart(2,"0")}`);
console.log(`   LLM primary:      ${config.gemini.model}`);
console.log(`   LLM fallback:     ${config.groq.apiKey ? "Groq (llama-3.3-70b)" : "disabled"}`);
console.log(`   OCR model:         ${process.env.OCR_MODEL || "gemini-flash-lite-latest"}`);
console.log(`   Whisper (voice):  ${config.groq.apiKey ? "Groq" : "disabled"}`);
