// Reminders service — sends the daily check-in.
// We poll once a minute. For each user whose local time matches their
// reminder_hour:reminder_minute AND who hasn't been pinged today, send a
// message and log it. (Supabase keeps it idempotent via the unique index.)

import { db } from "../db/supabase.js";
import { config } from "../config.js";

function nowPartsInTz(tz) {
  // Returns { y, m, d, hour, minute, weekday, isoDate } in the given tz.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    hour: Number(parts.hour === "24" ? "00" : parts.hour),
    minute: Number(parts.minute),
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/**
 * Check & send due reminders. Call this every minute from a cron job.
 * @param {(telegramId:number, text:string) => Promise<void>} send
 */
export async function tickReminders(send) {
  const { data: users, error } = await db()
    .from("users")
    .select("telegram_id, reminder_hour, reminder_minute, reminder_enabled, timezone, first_name, streak_days")
    .eq("reminder_enabled", true);
  if (error) {
    console.error("[reminders] fetch users failed:", error.message);
    return { sent: 0, skipped: 0, error: error.message };
  }

  let sent = 0, skipped = 0;
  for (const u of users || []) {
    const tz = u.timezone || config.reminders.timezone;
    const t = nowPartsInTz(tz);
    if (t.hour !== u.reminder_hour || t.minute !== u.reminder_minute) {
      skipped++;
      continue;
    }

    // Idempotency check
    const { data: already } = await db()
      .from("reminders_log")
      .select("id")
      .eq("telegram_id", u.telegram_id)
      .eq("sent_on", t.isoDate)
      .eq("kind", "daily_checkin")
      .maybeSingle();
    if (already) { skipped++; continue; }

    const name = u.first_name ? `, ${u.first_name}` : "";
    const streak = u.streak_days > 0 ? `\n🔥 Current streak: ${u.streak_days} day${u.streak_days === 1 ? "" : "s"}` : "";
    const text =
      `Hey${name}! Quick check-in 🌙\n` +
      `Anything you spent on today? Just type or send a voice note — e.g. "150 on coffee" or "split 800 dinner with Rahul".\n` +
      `Commands: /today · /week · /month · /undo · /budget · /help` +
      streak;

    try {
      await send(u.telegram_id, text);
      await db().from("reminders_log").insert({
        telegram_id: u.telegram_id,
        sent_on: t.isoDate,
        kind: "daily_checkin",
      });
      sent++;
    } catch (e) {
      console.error(`[reminders] send failed for ${u.telegram_id}:`, e.message);
    }
  }
  return { sent, skipped };
}
