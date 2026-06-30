# Setup Checklist

You have the codebase. Follow these steps to go from zero → working bot.

## 1. Supabase (free) — 5 min

1. Sign up at https://supabase.com
2. New project → pick a region close to you (e.g. Mumbai)
3. Save the database password somewhere safe
4. Go to **SQL Editor** → New query
5. Paste the entire contents of `supabase/migrations/0001_init.sql` and Run
6. Go to **Project Settings → API** and copy:
   - `Project URL`  → `SUPABASE_URL`
   - `service_role` key (⚠️ server-side only) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Local bot — 2 min

```bash
cd /Users/avaneesh/expense-manager
npm install
# Edit .env with your Supabase values
npm run dev
```

You should see:
```
✅ Expense manager bot is up.
```

Open Telegram → your bot → `/start`

## 3. Test the flow

- Type: `Spent 200 on Zomato`
- Bot should reply: `✅ ₹200.00 Food @ Zomato · …`
- Type: `/today`
- Should show today's entries

## 4. Test voice (optional)

Either:
- Have a Telegram Premium client auto-transcribe (rare in bot API), OR
- Add a free Groq API key in `.env` (`GROQ_API_KEY=...`) for Whisper fallback
  - Sign up at https://console.groq.com → API Keys → Create
  - Free tier: 30 minutes of audio per day

## 5. Deploy to Render (free) — 5 min

1. Push the repo to GitHub
2. Sign up at https://render.com
3. **New → Web Service** → connect your repo
4. Settings:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Instance type**: Free
5. **Environment** → add all the keys from `.env`
6. **Advanced → Add Environment Variable**:
   - `RENDER_EXTERNAL_URL` → set automatically by Render (we use it for self-ping)
7. Deploy. First deploy takes ~3 min.
8. Once live, the bot works 24/7. Free tier sleeps after 15 min idle — we self-ping every 14 min to stay up.

## 6. Invite another user (multi-user test)

- Have a friend open Telegram, find your bot, send `/start`
- They get their own ledger — completely isolated
- Confirm by checking Supabase → `users` table → you'll see two rows

## 7. (Later) Dashboard

Build a Vercel-deployed static site that reads from Supabase.
We can do this in Phase 2 once the bot feels solid.
