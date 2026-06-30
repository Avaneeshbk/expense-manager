// Streak service — tracks consecutive days the user has logged >= 1 expense.

import { db } from "../db/supabase.js";

function todayInTz(tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function yesterdayInTz(tz) {
  // Use UTC arithmetic then format in tz — robust to DST.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const now = new Date();
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const localMidnight = new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day)
  ));
  localMidnight.setUTCDate(localMidnight.getUTCDate() - 1);
  const back = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(localMidnight);
  const b = Object.fromEntries(back.map((p) => [p.type, p.value]));
  return `${b.year}-${b.month}-${b.day}`;
}

/**
 * Recompute streak for a user. Call after a successful insert or at the
 * end of a day. Returns the new streak.
 */
export async function recomputeStreak(telegramId) {
  const { data: user, error: e1 } = await db()
    .from("users")
    .select("streak_days, longest_streak, timezone, last_log_date")
    .eq("telegram_id", telegramId)
    .single();
  if (e1) throw e1;

  const tz = user.timezone || "Asia/Kolkata";
  const today = todayInTz(tz);
  const yesterday = yesterdayInTz(tz);

  // Find most recent date the user logged an expense.
  const { data: latest, error: e2 } = await db()
    .from("expenses")
    .select("spent_at")
    .eq("telegram_id", telegramId)
    .order("spent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e2) throw e2;

  if (!latest) {
    // No expenses — leave streak at 0.
    await db().from("users").update({ streak_days: 0, last_log_date: null }).eq("telegram_id", telegramId);
    return 0;
  }

  const latestDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(latest.spent_at));

  let newStreak;
  if (latestDate === today) {
    newStreak = user.last_log_date === yesterday ? user.streak_days + 1 : Math.max(1, user.streak_days || 0);
  } else if (latestDate === yesterday) {
    // Logged yesterday but not today — streak still alive, don't bump.
    newStreak = Math.max(1, user.streak_days || 1);
    await db().from("users").update({ last_log_date: latestDate }).eq("telegram_id", telegramId);
    return newStreak;
  } else {
    // Gap → streak broken
    newStreak = 0;
  }

  const newLongest = Math.max(user.longest_streak || 0, newStreak);
  await db()
    .from("users")
    .update({ streak_days: newStreak, longest_streak: newLongest, last_log_date: latestDate })
    .eq("telegram_id", telegramId);
  return newStreak;
}
