// Vercel serverless function:
//   GET    /api/budgets
//   POST   /api/budgets         { category, monthly_limit }
//   DELETE /api/budgets?category=Food

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TG_ID = Number(process.env.DASHBOARD_TELEGRAM_ID || 0);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!URL || !SERVICE_KEY || !TG_ID) {
    return res.status(500).json({ error: "Server not configured" });
  }
  const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === "GET") {
    const { data, error } = await db
      .from("budgets")
      .select("*")
      .eq("telegram_id", TG_ID)
      .order("category");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === "POST") {
    const { category, monthly_limit } = req.body || {};
    if (!category || !(Number(monthly_limit) > 0)) {
      return res.status(400).json({ error: "category and monthly_limit required" });
    }
    const { data, error } = await db
      .from("budgets")
      .upsert(
        {
          telegram_id: TG_ID,
          category,
          monthly_limit: Number(monthly_limit),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id,category" }
      )
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === "DELETE") {
    const category = String(req.query.category || "");
    if (!category) return res.status(400).json({ error: "category required" });
    const { error } = await db
      .from("budgets")
      .delete()
      .eq("telegram_id", TG_ID)
      .eq("category", category);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
