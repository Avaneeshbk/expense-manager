# Ledger — Expense Manager Dashboard

A web dashboard for the Telegram expense bot. Reads from the same Supabase
database, renders analytics, and lets you manage budgets.

## Design principles

- **Neutral, calm aesthetic** — not the typical "AI-generated purple gradient"
- **Single accent color** (emerald) for data and callouts; everything else is
  neutral gray scale
- **Generous whitespace**, **tabular figures** for all numbers
- **Light & dark themes** with proper tokens, system preference aware, no
  flash on first paint
- **Real type system**: Inter (display) + JetBrains Mono (numbers)

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** with custom design tokens (not stock Tailwind)
- **Recharts** for charts
- **Lucide** for icons
- **Vercel serverless functions** (`/api/*`) as a tiny Supabase proxy — the
  service role key never reaches the browser

## Local dev

```bash
cd dashboard
cp .env.local.example .env.local
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_TELEGRAM_ID
npm install
npm run dev
```

Open http://localhost:5173.

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in Vercel, point at the `dashboard/` directory
3. Add the three env vars from `.env.local`
4. Deploy

## File map

```
dashboard/
  api/                 # Vercel serverless functions
    expenses.ts        # GET /api/expenses
    expenses/[id].ts   # DELETE /api/expenses/:id
    budgets.ts         # GET/POST/DELETE /api/budgets
  src/
    App.tsx            # Router + shell
    main.tsx           # Entry + anti-flash theme
    index.css          # Design tokens, base styles
    components/
      ui.tsx           # Card, Button, Badge, EmptyState, Spinner
      StatCard.tsx     # Metric card with label/value/sub/trend
      Sidebar.tsx      # Side nav (desktop) / top bar (mobile)
      ThemeToggle.tsx  # Light/dark/system cycle
    pages/
      Overview.tsx     # Hero stats, daily trend, recent entries, top categories
      Ledger.tsx       # Searchable, sortable, filterable table
      Insights.tsx     # Category pie, monthly bars, payment methods, top merchants
      Settings.tsx     # Budgets CRUD with progress bars
    lib/
      api.ts           # Wrappers for /api/* endpoints
      cn.ts            # Tailwind class merge
      money.ts         # INR formatting
      time.ts          # tz-aware date ranges
      categories.ts    # Categories + colors + icons
      theme.tsx        # Theme provider (light/dark/system)
```
