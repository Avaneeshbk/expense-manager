// User registration / lookup service.

import { db } from "../db/supabase.js";

export async function getOrCreateUser(telegramUser) {
  const id = Number(telegramUser.id);
  const { data: existing, error: e1 } = await db()
    .from("users")
    .select("*")
    .eq("telegram_id", id)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) {
    // touch last_seen + keep profile fields fresh
    const patch = {
      last_seen_at: new Date().toISOString(),
      username: telegramUser.username || existing.username,
      first_name: telegramUser.first_name || existing.first_name,
      last_name:  telegramUser.last_name  || existing.last_name,
    };
    await db().from("users").update(patch).eq("telegram_id", id);
    return { ...existing, ...patch };
  }
  const row = {
    telegram_id: id,
    username:    telegramUser.username || null,
    first_name:  telegramUser.first_name || null,
    last_name:   telegramUser.last_name || null,
  };
  const { data, error } = await db()
    .from("users")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setReminder(telegramId, hour, minute) {
  hour = Number(hour); minute = Number(minute);
  if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) {
    throw new Error("Invalid reminder time");
  }
  const { error } = await db()
    .from("users")
    .update({ reminder_hour: hour, reminder_minute: minute, reminder_enabled: true })
    .eq("telegram_id", telegramId);
  if (error) throw error;
  return { hour, minute };
}

export async function disableReminders(telegramId) {
  const { error } = await db()
    .from("users")
    .update({ reminder_enabled: false })
    .eq("telegram_id", telegramId);
  if (error) throw error;
}
