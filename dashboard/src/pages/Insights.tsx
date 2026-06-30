// Insights page — category breakdown, monthly trend, payment mode, top merchants.

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend } from "recharts";
import { Card, Spinner, EmptyState } from "@/components/ui";
import { fetchAllExpenses, Expense } from "@/lib/api";
import { inr, inrShort, pct } from "@/lib/money";
import { fmtMonth } from "@/lib/time";
import { CATEGORIES, CATEGORY_COLORS, PAYMENT_META } from "@/lib/categories";

export function InsightsPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setExpenses(await fetchAllExpenses(2000)); }
      catch (e: any) { setErr(e?.message || "Failed to load"); }
    })();
  }, []);

  const data = useMemo(() => {
    if (!expenses) return null;

    // By category (all time)
    const byCat: Record<string, number> = {};
    for (const e of expenses) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
    const totalAll = Object.values(byCat).reduce((s, v) => s + v, 0);

    // By month (last 12)
    const byMonth: Record<string, number> = {};
    for (const e of expenses) {
      const k = e.spent_at.slice(0, 7);
      byMonth[k] = (byMonth[k] || 0) + Number(e.amount);
    }
    const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);

    // By payment
    const byPay: Record<string, number> = {};
    for (const e of expenses) {
      const k = (e.payment_mode || "unknown").toLowerCase();
      byPay[k] = (byPay[k] || 0) + Number(e.amount);
    }

    // Top merchants (all time)
    const byMerch: Record<string, { total: number; count: number }> = {};
    for (const e of expenses) {
      const k = e.merchant || "(no merchant)";
      if (!byMerch[k]) byMerch[k] = { total: 0, count: 0 };
      byMerch[k].total += Number(e.amount);
      byMerch[k].count += 1;
    }
    const topMerchants = Object.entries(byMerch)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8);

    return { byCat, totalAll, months, byPay, topMerchants };
  }, [expenses]);

  if (err) return <EmptyState title="Couldn't load" hint={err} />;
  if (!data) return <div className="flex items-center gap-2 text-text-3"><Spinner /> Loading…</div>;

  const catData = Object.entries(data.byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => ({ name: cat, value: amt, color: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] }));

  const monthData = data.months.map(([k, v]) => ({
    name: fmtMonth(k + "-01"),
    total: v,
  }));

  const payData = Object.entries(data.byPay)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      name: PAYMENT_META[k as keyof typeof PAYMENT_META]?.label || k,
      value: v,
      color: PAYMENT_META[k as keyof typeof PAYMENT_META]?.color,
    }));

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Category pie */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <span className="label">By category</span>
            <p className="text-text-2 text-sm mt-0.5">All time · {inr(data.totalAll)}</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={catData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={1.5}
                  strokeWidth={0}
                >
                  {catData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => inr(Number(v))}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 12, color: "rgb(var(--text-2))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly bars */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <span className="label">Monthly</span>
            <p className="text-text-2 text-sm mt-0.5">Last {monthData.length} months</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgb(var(--border))" vertical={false} strokeDasharray="2 4" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "rgb(var(--text-3))" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "rgb(var(--text-3))" }} tickFormatter={(v) => inrShort(v)} width={50} />
                <Tooltip
                  cursor={{ fill: "rgb(var(--surface-2))", opacity: 0.5 }}
                  contentStyle={{
                    background: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [inr(Number(v)), "Total"]}
                />
                <Bar dataKey="total" fill="rgb(var(--accent))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Top merchants */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border">
            <span className="label">Top merchants</span>
            <p className="text-text-2 text-sm mt-0.5">All time</p>
          </div>
          <div>
            {data.topMerchants.map(([name, { total, count }], i) => (
              <div key={name} className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border last:border-b-0">
                <span className="text-text-3 text-xs num w-6">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text font-medium truncate">{name}</div>
                  <div className="text-xs text-text-3">{count} {count === 1 ? "entry" : "entries"}</div>
                </div>
                <div className="num text-sm tabular shrink-0" data-num>{inr(total)}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Payment mode */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <span className="label">Payment methods</span>
            <p className="text-text-2 text-sm mt-0.5">All time</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgb(var(--border))" horizontal={false} strokeDasharray="2 4" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "rgb(var(--text-3))" }} tickFormatter={(v) => inrShort(v)} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "rgb(var(--text-2))" }} width={80} />
                <Tooltip
                  cursor={{ fill: "rgb(var(--surface-2))", opacity: 0.5 }}
                  contentStyle={{
                    background: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [inr(Number(v)), "Total"]}
                />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {payData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
