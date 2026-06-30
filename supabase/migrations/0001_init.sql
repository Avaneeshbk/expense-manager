-- Expense Manager — Supabase schema
-- All tables use telegram_id (bigint) as the user identifier.
-- Row Level Security (RLS) is enabled so that even with a leaked anon key,
-- users can only read/write their own data. The bot uses the SERVICE_ROLE
-- key server-side, which bypasses RLS — we still filter by telegram_id
-- in every query for defense in depth.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  telegram_id        bigint primary key,
  username           text,
  first_name         text,
  last_name          text,
  timezone           text not null default 'Asia/Kolkata',
  reminder_hour      smallint not null default 21 check (reminder_hour between 0 and 23),
  reminder_minute    smallint not null default 0  check (reminder_minute between 0 and 59),
  reminder_enabled   boolean not null default true,
  onboarded_at       timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  streak_days        integer not null default 0,
  longest_streak     integer not null default 0,
  last_log_date      date
);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id            uuid primary key default uuid_generate_v4(),
  telegram_id   bigint not null references public.users(telegram_id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  currency      text not null default 'INR',
  category      text not null,
  subcategory   text,
  merchant      text,
  payment_mode  text,        -- cash, upi, card, netbanking, wallet, other
  note          text,
  raw_text      text,         -- original message (debug / audit)
  spent_at      timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  is_recurring  boolean not null default false
);

create index if not exists expenses_user_time_idx
  on public.expenses (telegram_id, spent_at desc);

create index if not exists expenses_user_category_idx
  on public.expenses (telegram_id, category, spent_at desc);

-- ---------------------------------------------------------------------------
-- merchant_aliases — learn that "zom" / "swig" / "amzn" all map to a known merchant
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_aliases (
  id           uuid primary key default uuid_generate_v4(),
  telegram_id  bigint not null references public.users(telegram_id) on delete cascade,
  alias        text not null,
  merchant     text not null,
  category     text not null,
  hits         integer not null default 1,
  last_used_at timestamptz not null default now(),
  unique (telegram_id, alias)
);

create index if not exists merchant_aliases_user_idx
  on public.merchant_aliases (telegram_id, alias);

-- ---------------------------------------------------------------------------
-- budgets — per-category monthly limit
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id           uuid primary key default uuid_generate_v4(),
  telegram_id  bigint not null references public.users(telegram_id) on delete cascade,
  category     text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (telegram_id, category)
);

-- ---------------------------------------------------------------------------
-- reminders_log — so we don't double-send the daily check-in
-- ---------------------------------------------------------------------------
create table if not exists public.reminders_log (
  id          uuid primary key default uuid_generate_v4(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  sent_on     date not null,
  kind        text not null default 'daily_checkin',
  sent_at     timestamptz not null default now(),
  unique (telegram_id, sent_on, kind)
);

-- ---------------------------------------------------------------------------
-- updated_at trigger for expenses
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_touch on public.expenses;
create trigger expenses_touch
  before update on public.expenses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- (Bot uses service_role key, but enable RLS so anon key is safe by default.)
-- ---------------------------------------------------------------------------
alter table public.users            enable row level security;
alter table public.expenses         enable row level security;
alter table public.merchant_aliases enable row level security;
alter table public.budgets          enable row level security;
alter table public.reminders_log    enable row level security;

-- Drop & recreate policies idempotently
do $$ begin
  perform 1; -- placeholder, real drops below
exception when others then null; end $$;

-- We DO NOT add policies for the `anon` or `authenticated` roles here,
-- because the bot uses the service role and the dashboard will either:
--   (a) call our backend (which uses service role + filters by telegram_id), or
--   (b) use the anon key with a policy scoped to a `dashboard_user_id` claim.
-- This means: with RLS enabled and no policies, anon cannot read/write anything.
-- The bot backend still works because service_role bypasses RLS.
--
-- If you want a directly-embedded dashboard, add a policy like:
--   create policy "dash read" on public.expenses for select to anon
--     using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'telegram_id')::bigint);
-- and pass that claim from your backend. For now we keep it locked down.
