// Budgets service.

import { db } from "../db/supabase.js";

export async function setBudget(telegramId, category, monthlyLimit) {
  const { data, error } = await db()
    .from("budgets")
    .upsert(
      {
        telegram_id: telegramId,
        category,
        monthly_limit: monthlyLimit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_id,category" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listBudgets(telegramId) {
  const { data, error } = await db()
    .from("budgets")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("category");
  if (error) throw error;
  return data || [];
}

export async function deleteBudget(telegramId, category) {
  const { error } = await db()
    .from("budgets")
    .delete()
    .eq("telegram_id", telegramId)
    .eq("category", category);
  if (error) throw error;
}
