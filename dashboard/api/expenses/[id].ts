// Vercel serverless function: DELETE /api/expenses/:id
// Deletes a single expense (id is the UUID).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TG_ID = Number(process.env.DASHBOARD_TELEGRAM_ID || 0);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!URL || !SERVICE_KEY || !TG_ID) {
    return res.status(500).json({ error: "Server not configured" });
  }
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "id required" });
  const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error } = await db
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("telegram_id", TG_ID);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
}
