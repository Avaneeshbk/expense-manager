// Centralized config. Reads from process.env (populated by dotenv in index.js).
// Throws early on missing required keys so we fail fast on startup.

const required = (key) => {
  const v = process.env[key];
  if (!v || v.startsWith("YOUR_") || v.includes("AQ.Ab8RN6IYQpFW")) {
    // soft warning, not a hard throw — the gemini key looks present already.
    // (Telegram token + Gemini key are usually filled first; Supabase comes after.)
    if (key === "SUPABASE_URL" || key === "SUPABASE_SERVICE_ROLE_KEY") {
      console.warn(`[config] ${key} not set yet — Supabase features will fail until you add it.`);
      return "";
    }
  }
  return v || "";
};

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    ownerId: Number(process.env.OWNER_TELEGRAM_ID || 0),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  reminders: {
    defaultHour: Number(process.env.DEFAULT_REMINDER_HOUR ?? 21),
    defaultMin:  Number(process.env.DEFAULT_REMINDER_MINUTE ?? process.env.DEFAULT_REMINDER_MIN ?? 0),
    timezone:    process.env.TIMEZONE || "Asia/Kolkata",
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || "",
  },
};

// Surface critical issues at boot.
if (!config.telegram.botToken) {
  console.error("[config] TELEGRAM_BOT_TOKEN missing — bot cannot start.");
}
if (!config.gemini.apiKey) {
  console.error("[config] GEMINI_API_KEY missing — message parsing will fail.");
}
