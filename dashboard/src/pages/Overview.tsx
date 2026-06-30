// Overview page — the home screen after login.
// Shows: this-month total, last 30 days, average per day, biggest category,
// top merchant, daily trend chart, recent entries list.

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Receipt, Calendar, Flame, ArrowUpRight } from "lucide-react";
import { Card, EmptyState, Spinner } from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { fetchAllExpenses, fetchBudgets, Expense, Budget } from "@/lib/api";
import { inr, inrShort, pct } from "@/lib/money";
import { fmtDate, fmtRelative, thisMonth, lastNDays } from "@/lib/time";
import { CATEGORY_COLORS, PAYMENT_META } from "@/lib/categories";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type Day = { date: string; total: number };

export function OverviewPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [e, b] = await Promise.all([
          fetchAllExpenses(1000),
          fetchBudgets(),
        ]);
        setExpenses(e);
        setBudgets(b);
      } catch (e: any) {
        setErr(e?.message || "Failed to load data");
      }
    })();
  }, []);

  const stats = useMemo(() => {
    if (!expenses) return null;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    const m = thisMonth(tz);
    const last = lastNDays(30);

    const mStart = m.from;
    const lastStart = last.from;

    const monthExp = expenses.filter((e) => e.spent_at >= mStart);
    const lastExp = expenses.filter((e) => e.spent_at >= lastStart);

    const monthTotal = monthExp.reduce((s, e) => s + Number(e.amount), 0);
    const lastTotal = lastExp.reduce((s, e) => s + Number(e.amount), 0);

    // Avg per day (last 30)
    const days = new Set(lastExp.map((e) => e.spent_at.slice(0, 10))).size || 1;
    const avgPerDay = lastTotal / 30;

    // Top category this month
    const byCat: Record<string, number> = {};
    for (const e of monthExp) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
    const topCatEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

    // Top merchant
    const byMerch: Record<string, number> = {};
    for (const e of monthExp) {
      const m = e.merchant || "—";
      byMerch[m] = (byMerch[m] || 0) + Number(e.amount);
    }
    const topMerchEntry = Object.entries(byMerch).sort((a, b) => b[1] - a[1])[0];

    // Daily series for the last 30 days
    const daily: Day[] = [];
    const dayMap: Record<string, number> = {};
    for (const e of lastExp) {
      const d = e.spent_at.slice(0, 10);
      dayMap[d] = (dayMap[d] || 0) + Number(e.amount);
    }
    // Fill in empty days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      daily.push({ date: d, total: dayMap[d] || 0 });
    }

    return {
      monthTotal, lastTotal, avgPerDay, monthExp, lastExp,
      topCat: topCatEntry?.[0], topCatAmt: topCatEntry?.[1] || 0,
      topMerch: topMerchEntry?.[0], topMerchAmt: topMerchEntry?.[1] || 0,
      daily, byCat,
    };
  }, [expenses]);

  if (err) {
    return <EmptyState title="Couldn't load" hint={err} icon={<Receipt className="h-8 w-8" />} />;
  }
  if (!expenses || !stats) {
    return <div className="flex items-center gap-2 text-text-3"><Spinner /> Loading…</div>;
  }
  if (!expenses.length) {
    return (
      <EmptyState
        title="No expenses yet"
        hint="Send your first one to the Telegram bot — e.g. 'Spent 200 on Zomato'. It'll show up here."
        icon={<Receipt className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Hero stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="This month"
          value={inr(stats.monthTotal)}
          icon={<Calendar className="h-3.5 w-3.5" />}
          sub={`${stats.monthExp.length} ${stats.monthExp.length === 1 ? "entry" : "entries"}`}
        />
        <StatCard
          label="Last 30 days"
          value={inr(stats.lastTotal)}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          sub={`avg ${inr(Math.round(stats.avgPerDay))}/day`}
        />
        <StatCard
          label="Top category"
          value={stats.topCat || "—"}
          sub={stats.topCat ? inr(stats.topCatAmt) : ""}
        />
        <StatCard
          label="Top merchant"
          value={stats.topMerch || "—"}
          sub={stats.topMerch && stats.topMerch !== "—" ? inr(stats.topMerchAmt) : ""}
        />
      </div>

      {/* Trend chart */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="label">Daily spend</span>
            <p className="text-text-2 text-sm mt-0.5">Last 30 days</p>
          </div>
          <div className="text-right">
            <div className="num text-num-lg" data-num>{inr(stats.lastTotal)}</div>
            <div className="text-xs text-text-3">total</div>
          </div>
        </div>
        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.daily} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="currentColor" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--border))" vertical={false} strokeDasharray="2 4" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "rgb(var(--text-3))" }}
                tickFormatter={(d) => new Date(d).getDate().toString()}
                interval={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "rgb(var(--text-3))" }}
                tickFormatter={(v) => inrShort(v)}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: "rgb(var(--surface))",
                  border: "1px solid rgb(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(d) => new Date(d as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                formatter={(v: any) => [inr(Number(v)), "Spent"]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="rgb(var(--accent))"
                fill="url(#grad)"
                strokeWidth={2}
                className="text-accent-500"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-3 lg:gap-4">
        {/* Recent */}
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
            <div>
              <span className="label">Recent</span>
              <p className="text-text-2 text-sm mt-0.5">Last 8 entries</p>
            </div>
          </div>
          <div>
            {expenses.slice(0, 8).map((e) => (
              <div key={e.id} className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border last:border-b-0">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: CATEGORY_COLORS[e.category as keyof typeof CATEGORY_COLORS] || "#71717a" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    <span className="text-text font-medium">{e.merchant || e.subcategory || e.category}</span>
                    {e.merchant && e.subcategory && <span className="text-text-3"> · {e.subcategory}</span>}
                  </div>
                  <div className="text-xs text-text-3 flex items-center gap-2 mt-0.5">
                    <span>{e.category}</span>
                    <span>·</span>
                    <span>{fmtRelative(e.spent_at)}</span>
                    {e.payment_mode && (
                      <>
                        <span>·</span>
                        <span style={{ color: PAYMENT_META[e.payment_mode as keyof typeof PAYMENT_META]?.color }}>
                          {PAYMENT_META[e.payment_mode as keyof typeof PAYMENT_META]?.label || e.payment_mode}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="num text-sm tabular shrink-0" data-num>{inr(e.amount)}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top categories */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border">
            <span className="label">This month</span>
            <p className="text-text-2 text-sm mt-0.5">By category</p>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            {Object.entries(stats.byCat)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([cat, amt]) => {
                const color = CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] || "#71717a";
                const p = pct(amt, stats.monthTotal);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text">{cat}</span>
                      <span className="num text-xs text-text-2 tabular" data-num>{inr(amt)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: p, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}
