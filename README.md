# Expense Manager — Voice-First Telegram Bot + Web Dashboard

A zero-cost, multi-user expense manager that lives in Telegram. Send a voice
note or a quick text, and an AI extracts amount, category, merchant, and
payment mode into a clean ledger. Daily 9 PM reminders keep streaks alive.
A web dashboard on Vercel shows analytics, the full ledger, and budget tools.

## What you get

**Telegram bot** (`src/`)
- 🎙️ Voice notes & text → AI categorizes automatically
- 🇮🇳 INR only, code-mix friendly
- 💳 Default payment mode = UPI (overridable)
- 👥 Multi-user — each Telegram user = own ledger
- 🔔 Daily 9 PM reminder (configurable)
- 📊 Reports: `/today`, `/week`, `/month`, `/all`, `/methods`
- ✏️ Corrections, `/undo`, `/clear today|week|month|all`
- 🔁 Streak tracking
- 🛡️ Robust: Gemini (primary) + Groq (fallback) for LLM; Groq for STT

**Web dashboard** (`dashboard/`)
- 📊 Overview with daily trend chart and hero metrics
- 📜 Searchable, sortable ledger
- 🔍 Insights: category pie, monthly bars, payment methods, top merchants
- ⚙️ Settings: manage monthly budgets per category
- 🌗 Light / dark / system theme with proper tokens
- 🎨 Custom design system (Inter + JetBrains Mono, emerald accent, no AI tropes)

## Stack

| Component | Tool | Cost |
|---|---|---|
| Bot framework | grammY (Node.js) | Free |
| Bot hosting | Render (free tier) | Free |
| LLM | Gemini 2.5 Flash Lite | Free tier |
| LLM fallback | Groq (llama-3.3-70b) | Free tier |
| Speech-to-text | Groq Whisper | Free tier |
| Database | Supabase (Postgres) | Free tier |
| Dashboard framework | React + Vite + TypeScript | Free |
| Dashboard hosting | Vercel | Free tier |
| Dashboard charts | Recharts | Free |
| Dashboard icons | Lucide | Free |

## Quick start

### 1. Bot

```bash
cp .env.example .env          # fill in keys
# Run the SQL in supabase/migrations/0001_init.sql on your Supabase project
npm install
npm run dev
```

Talk to your bot on Telegram: `/start`, `Spent 200 on Zomato`, `/today`.

### 2. Dashboard

```bash
cd dashboard
cp .env.local.example .env.local  # fill in Supabase URL, service key, your Telegram ID
npm install
npm run dev
```

Open http://localhost:5173.

### 3. Deploy dashboard to Vercel

1. Push to GitHub
2. Import `dashboard/` in Vercel
3. Add the three env vars
4. Deploy

## Folder layout

```
expense-manager/
├── src/                          # Bot
│   ├── index.js                  entry
│   ├── config.js
│   ├── ai/gemini.js              Gemini + Groq parser with fallback
│   ├── db/supabase.js
│   ├── services/                 expenses, users, budgets, streaks, reminders
│   ├── bot/
│   │   ├── commands/index.js     /start /today /week /month /all ...
│   │   └── handlers/
│   │       ├── messages.js       text → AI → ledger
│   │       └── voice.js          voice → Groq Whisper → text
│   └── utils/
│       ├── format.js             ★ clean Telegram message layouts
│       ├── money.js              INR formatting
│       └── time.js               tz-aware date ranges
├── supabase/migrations/0001_init.sql
├── dashboard/                    ★ Web dashboard
│   ├── api/                      Vercel serverless functions
│   ├── src/
│   │   ├── App.tsx               router + shell
│   │   ├── main.tsx              entry + anti-flash theme
│   │   ├── index.css             design tokens
│   │   ├── components/           Sidebar, StatCard, ThemeToggle, ui
│   │   ├── pages/                Overview, Ledger, Insights, Settings
│   │   └── lib/                  api, money, time, categories, theme, cn
│   ├── vercel.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── README.md
├── SETUP.md                      step-by-step for the bot
└── RENDER_DEPLOY.md              deploy the bot
```

## Design system (dashboard)

- **Type**: Inter (display, body) + JetBrains Mono (numbers)
- **Color**: Neutral gray scale + emerald accent
- **Themes**: Light & dark, with semantic tokens (`bg`, `surface`, `border`, `text`, `accent`)
- **Layout**: Sidebar (desktop) / top bar (mobile), generous whitespace
- **Charts**: Recharts (no flashy animations)
- **Icons**: Lucide
- **Numbers**: tabular figures everywhere
