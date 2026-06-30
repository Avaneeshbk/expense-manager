// Expenses service — all DB ops for the expenses table.
// Every function takes telegram_id first and filters on it.

import { db } from "../db/supabase.js";

/**
 * Insert one expense.
 * @returns {object} the inserted row
 */
export async function insertExpense(telegramId, e) {
  const row = {
    telegram_id:  telegramId,
    amount:       e.amount,
    currency:     e.currency || "INR",
    category:     e.category || "Other",
    subcategory:  e.subcategory || null,
    merchant:     e.merchant || null,
    payment_mode: e.payment_mode || null,
    note:         e.note || null,
    raw_text:     e.raw_text || null,
    spent_at:     e.spent_at || new Date().toISOString(),
    is_recurring: !!e.is_recurring,
  };
  const { data, error } = await db()
    .from("expenses")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Insert many expenses in one go.
 */
export async function insertExpenses(telegramId, items) {
  if (!items.length) return [];
  const rows = items.map((e) => ({
    telegram_id:  telegramId,
    amount:       e.amount,
    currency:     e.currency || "INR",
    category:     e.category || "Other",
    subcategory:  e.subcategory || null,
    merchant:     e.merchant || null,
    payment_mode: e.payment_mode || null,
    note:         e.note || null,
    raw_text:     e.raw_text || null,
    spent_at:     e.spent_at || new Date().toISOString(),
    is_recurring: !!e.is_recurring,
  }));
  const { data, error } = await db()
    .from("expenses")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return data;
}

/**
 * Update an expense by id (only if it belongs to this user).
 */
export async function updateExpense(telegramId, id, patch) {
  const { data, error } = await db()
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .eq("telegram_id", telegramId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete an expense by id.
 */
export async function deleteExpense(telegramId, id) {
  const { error } = await db()
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("telegram_id", telegramId);
  if (error) throw error;
  return true;
}

/**
 * Delete the most recent expense.
 */
export async function deleteLast(telegramId) {
  const last = await getLast(telegramId);
  if (!last) return null;
  await deleteExpense(telegramId, last.id);
  return last;
}

/**
 * Delete the most recent expense whose note/merchant/subcategory/category
 * contains the given substring (case-insensitive).
 */
export async function deleteMatch(telegramId, match) {
  const m = String(match || "").toLowerCase();
  if (!m) return deleteLast(telegramId);
  const { data, error } = await db()
    .from("expenses")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("spent_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const hit = (data || []).find((r) =>
    [r.merchant, r.subcategory, r.category, r.note]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(m))
  );
  if (!hit) return null;
  await deleteExpense(telegramId, hit.id);
  return hit;
}

/**
 * Get the most recent expense.
 */
export async function getLast(telegramId) {
  const { data, error } = await db()
    .from("expenses")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("spent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Get the last N expenses (most recent first). Used for AI context.
 */
export async function getRecent(telegramId, n = 5) {
  const { data, error } = await db()
    .from("expenses")
    .select("id, amount, category, subcategory, merchant, payment_mode, note, spent_at")
    .eq("telegram_id", telegramId)
    .order("spent_at", { ascending: false })
    .limit(n);
  if (error) throw error;
  return data || [];
}

/**
 * List expenses in a time window.
 */
export async function listInRange(telegramId, fromIso, toIso) {
  const { data, error } = await db()
    .from("expenses")
    .select("*")
    .eq("telegram_id", telegramId)
    .gte("spent_at", fromIso)
    .lte("spent_at", toIso)
    .order("spent_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Category-wise totals in a window.
 */
export async function totalsByCategory(telegramId, fromIso, toIso) {
  const rows = await listInRange(telegramId, fromIso, toIso);
  const totals = new Map();
  let grand = 0;
  for (const r of rows) {
    const k = r.category || "Other";
    totals.set(k, (totals.get(k) || 0) + Number(r.amount));
    grand += Number(r.amount);
  }
  return { total: grand, byCategory: Object.fromEntries(totals), count: rows.length };
}

/**
 * Get stats for the user's all-time data: count, total, first/most-recent dates,
 * and a per-month breakdown.
 */
export async function allTimeStats(telegramId) {
  const { data, error } = await db()
    .from("expenses")
    .select("amount, category, payment_mode, spent_at")
    .eq("telegram_id", telegramId)
    .order("spent_at", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) {
    return { count: 0, total: 0, first: null, last: null, byCategory: {}, byMonth: {}, byPayment: {} };
  }
  const byCategory = {};
  const byPayment = {};
  const byMonth = {};
  let total = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    total += amt;
    byCategory[r.category || "Other"] = (byCategory[r.category || "Other"] || 0) + amt;
    const pm = (r.payment_mode || "unknown").toLowerCase();
    byPayment[pm] = (byPayment[pm] || 0) + amt;
    const monthKey = (r.spent_at || "").slice(0, 7); // "YYYY-MM"
    if (monthKey) byMonth[monthKey] = (byMonth[monthKey] || 0) + amt;
  }
  return {
    count: rows.length,
    total,
    first: rows[0].spent_at,
    last: rows[rows.length - 1].spent_at,
    byCategory,
    byPayment,
    byMonth,
  };
}

/**
 * Bulk delete all expenses for a user. Returns the count deleted.
 * Used by /clear (after confirmation).
 */
export async function deleteAll(telegramId) {
  const { data, error: e1 } = await db()
    .from("expenses")
    .select("id")
    .eq("telegram_id", telegramId);
  if (e1) throw e1;
  const count = (data || []).length;
  if (count === 0) return 0;
  const { error: e2 } = await db()
    .from("expenses")
    .delete()
    .eq("telegram_id", telegramId);
  if (e2) throw e2;
  return count;
}

/**
 * Delete expenses in a time window (used by /clear today / this week).
 */
export async function deleteInRange(telegramId, fromIso, toIso) {
  const { data, error: e1 } = await db()
    .from("expenses")
    .select("id")
    .eq("telegram_id", telegramId)
    .gte("spent_at", fromIso)
    .lte("spent_at", toIso);
  if (e1) throw e1;
  const count = (data || []).length;
  if (count === 0) return 0;
  const { error: e2 } = await db()
    .from("expenses")
    .delete()
    .eq("telegram_id", telegramId)
    .gte("spent_at", fromIso)
    .lte("spent_at", toIso);
  if (e2) throw e2;
  return count;
}
