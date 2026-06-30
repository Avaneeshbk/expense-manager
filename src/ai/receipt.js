// Receipt OCR — uses Gemini's multimodal input to read a GPay screenshot.
//
// Returns either:
//   - { ok: true, amount, payee, payee_kind: "brand"|"local", datetime, ocr_text }
//   - { ok: false, reason: "unclear" | "multiple" | "no_amount" | ..., ask: "..." }
//
// The `caption` parameter is the user-provided caption text (e.g. "food"
// or "taxi"). When present, it can:
//   - supply the category for local vendors
//   - override the merchant (e.g. "taxi 200" → amount 200, category Transport)
//   - correct the OCR's amount (e.g. "this was actually 250")
//
// We NEVER trust the caption to fully override the OCR; we only use it to
// fill in missing fields or correct obvious mistakes.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

const SYSTEM_PROMPT = `You are a precise OCR + parser for Google Pay (GPay) payment
receipt screenshots. The user has just paid someone and forwarded the receipt
to a Telegram bot.

Your job: extract structured data and decide whether the receipt is clear
enough to log automatically.

The screenshot will be in English (GPay English UI).

Output STRICT JSON. No prose. No markdown fences.

Shape:
{
  "ok": boolean,
  "reason"?: "unclear" | "no_amount" | "multiple" | "no_receipt" | "not_english",
  "ask"?: string,         // if !ok, a question to ask the user
  "amount"?: number,      // in INR, no commas, no currency symbol
  "payee"?: string,       // merchant / recipient name as shown
  "payee_kind"?: "brand" | "local",  // is it a well-known brand or a local vendor?
  "datetime"?: string,    // ISO 8601, IST if visible
  "ocr_text"?: string,    // the full text you can read from the image
  "note"?: string         // any extra context (UPI ref, payment method, etc.)
}

Brand detection rules:
- "brand" = well-known companies (Zomato, Swiggy, Uber, Ola, Rapido, Amazon,
  Flipkart, BigBasket, Blinkit, Zepto, Dunzo, Jio, Airtel, Vi, BSNL, ACT,
  Airtel Payments Bank, IRCTC, MakeMyTrip, Cleartrip, Goibibo, BookMyShow,
  Paytm, PhonePe, Google Pay itself, Netflix, Spotify, Apple, Google, etc.)
- "local" = anything else (kirana store, local restaurant, friend's name,
  unknown merchant). Do NOT save the local vendor's name in payee — use "local".
- If unsure, default to "local".

Multiple-transaction rule:
- If the screenshot clearly shows MULTIPLE transactions (e.g. a history list),
  return only the most recent one and set amount/datetime/payee from that.
- If it's genuinely ambiguous which is the most recent, return ok=false with
  reason "multiple" and ask the user to send a single transaction.

Failure rules:
- If the amount is unclear, return ok=false with reason "no_amount" and ask
  the user what they paid.
- If the image is not a payment receipt (e.g. screenshot of a chat), return
  ok=false with reason "no_receipt".
- If the text is unreadable or in a language you can't parse, return
  ok=false with reason "unclear" and ask the user to retype the amount.
- NEVER guess. NEVER return ok=true with bogus data.

Important: amount must be a positive number. No currency symbol. No commas.
The number itself (e.g. 250, not "₹250" or "Rs. 250").
`;

let _model = null;
function model() {
  if (_model) return _model;
  if (!config.gemini.apiKey) throw new Error("GEMINI_API_KEY missing");
  const genai = new GoogleGenerativeAI(config.gemini.apiKey);
  // Use the -latest alias which is the most generous for free-tier image calls.
  // We can pin to a specific model via OCR_MODEL env var.
  const ocrModel = process.env.OCR_MODEL || "gemini-flash-lite-latest";
  _model = genai.getGenerativeModel({
    model: ocrModel,
    systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });
  return _model;
}

/**
 * Parse a receipt image.
 *
 * @param {object} opts
 * @param {Buffer} opts.imageBuffer   - the raw image bytes
 * @param {string} opts.mimeType      - "image/jpeg" | "image/png" | etc.
 * @param {string} [opts.caption]     - user-provided caption text
 * @returns {Promise<object>}         - see shape above
 */
export async function parseReceipt({ imageBuffer, mimeType = "image/jpeg", caption }) {
  const parts = [
    { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
    { text: caption
      ? `The user sent this image with the caption: "${caption}". Use the caption only to fill in the category for a local vendor, or to correct obvious mistakes in the OCR. Do not let the caption override a clearly readable OCR value.`
      : "Extract the receipt details." },
  ];

  const result = await model().generateContent({ contents: [{ role: "user", parts }] });
  const raw = result.response.text().trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Gemini returned non-JSON: ${raw.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }

  // Sanity validation: if ok=true, we MUST have amount + payee
  if (parsed.ok) {
    if (!(Number(parsed.amount) > 0)) {
      return { ok: false, reason: "no_amount", ask: "I couldn't read the amount. What did you pay?" };
    }
    if (!parsed.payee) {
      return { ok: false, reason: "unclear", ask: "I couldn't read the payee. Who did you pay?" };
    }
    if (parsed.payee_kind === "local") {
      // Don't save the local name — per user request.
      parsed.payee = "local";
    }
  }
  return parsed;
}
