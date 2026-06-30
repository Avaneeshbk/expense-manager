// Vercel serverless function: GET /api/expenses?from=...&to=...&limit=...
// Uses the Supabase SERVICE_ROLE key — keeps RLS strict on the DB.
//
// The single Telegram user this dashboard serves is read from the
// DASHBOARD_TELEGRAM_ID env var. Multi-user support would add basic auth
// or a real session check.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TG_ID = Number(process.env.DASHBOARD_TELEGRAM_ID || 0);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!URL || !SERVICE_KEY || !TG_ID) {
    return res.status(500).json({ error: "Server not configured" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { from, to, limit } = req.query as Record<string, string | undefined>;

  let q = db
    .from("expenses")
    .select("*")
    .eq("telegram_id", TG_ID)
    .order("spent_at", { ascending: false });

  if (from) q = q.gte("spent_at", from);
  if (to) q = q.lte("spent_at", to);
  if (limit) q = q.limit(Number(limit) || 1000);
  else q = q.limit(1000);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}
