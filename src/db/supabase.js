// Supabase client. We use the SERVICE_ROLE key on the server side, which
// bypasses Row Level Security. To stay safe, EVERY query in our code MUST
// filter by telegram_id — never trust a missing filter.

import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

let _client = null;

export function db() {
  if (_client) return _client;
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
  }
  _client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
