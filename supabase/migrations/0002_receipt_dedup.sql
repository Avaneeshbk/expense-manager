-- Add deduplication support for receipt-based expenses.
-- We use Telegram's file_unique_id (a stable ID per uploaded file) to
-- prevent the same photo from being inserted twice (e.g. if the bot
-- restarts mid-processing and Telegram redelivers the update).
--
-- Run this ONCE in Supabase SQL Editor (Project → SQL → New query).

alter table public.expenses
  add column if not exists source_file_id text;

create unique index if not exists expenses_telegram_file_unique
  on public.expenses (telegram_id, source_file_id)
  where source_file_id is not null;

-- For any existing duplicate rows (from before this index), keep the oldest.
-- If you have duplicates, run this cleanup once:
-- delete from public.expenses e
-- where exists (
--   select 1 from public.expenses e2
--   where e2.telegram_id = e.telegram_id
--     and e2.source_file_id = e.source_file_id
--     and e2.created_at < e.created_at
-- );
