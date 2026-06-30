// Settings page — manage budgets per category, with progress bars vs actual spend.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Card, Button, Spinner, EmptyState } from "@/components/ui";
import { fetchAllExpenses, fetchBudgets, upsertBudget, deleteBudget, Expense, Budget } from "@/lib/api";
import { inr } from "@/lib/money";
import { thisMonth } from "@/lib/time";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/cn";

export function SettingsPage() {
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draftCat, setDraftCat] = useState<string>(CATEGORIES[0]);
  const [draftAmt, setDraftAmt] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [b, e] = await Promise.all([fetchBudgets(), fetchAllExpenses(2000)]);
        setBudgets(b); setExpenses(e);
      } catch (e: any) { setErr(e?.message || "Failed to load"); }
    })();
  }, []);

  const spendByCat = useMemo(() => {
    if (!expenses) return {};
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    const m = thisMonth(tz);
    const out: Record<string, number> = {};
    for (const e of expenses) {
      if (e.spent_at < m.from) continue;
      out[e.category] = (out[e.category] || 0) + Number(e.amount);
    }
    return out;
  }, [expenses]);

  const handleAdd = async () => {
    const amt = Number(draftAmt);
    if (!(amt > 0)) return;
    setSaving(true);
    try {
      const b = await upsertBudget(draftCat, amt);
      setBudgets((prev) => {
        const others = (prev || []).filter((x) => x.category !== b.category);
        return [...others, b].sort((a, c) => a.category.localeCompare(c.category));
      });
      setDraftAmt("");
    } catch (e: any) {
      alert("Failed: " + e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (cat: string) => {
    if (!confirm(`Remove budget for ${cat}?`)) return;
    try {
      await deleteBudget(cat);
      setBudgets((prev) => (prev || []).filter((b) => b.category !== cat));
    } catch (e: any) { alert("Failed: " + e.message); }
  };

  if (err) return <EmptyState title="Couldn't load" hint={err} />;
  if (!budgets || !expenses) return <div className="flex items-center gap-2 text-text-3"><Spinner /> Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <span className="label">Add a budget</span>
          <p className="text-text-2 text-sm mt-0.5">Set a monthly limit for any category</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={draftCat}
            onChange={(e) => setDraftCat(e.target.value)}
            className="h-10 px-3 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent sm:w-48"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 text-sm">₹</span>
            <input
              value={draftAmt}
              onChange={(e) => setDraftAmt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              type="number"
              min="0"
              placeholder="e.g. 5000"
              className="w-full h-10 pl-7 pr-3 bg-surface border border-border rounded-md text-sm num tabular focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <Button onClick={handleAdd} disabled={saving || !draftAmt || !(Number(draftAmt) > 0)}>
            {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </Card>

      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="label">Your budgets</span>
            <p className="text-text-2 text-sm mt-0.5">{budgets.length} {budgets.length === 1 ? "category" : "categories"}</p>
          </div>
        </div>

        {budgets.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              title="No budgets set"
              hint="Add a budget above to start tracking your spending against a monthly limit."
            />
          </Card>
        ) : (
          <Card className="overflow-hidden divide-y divide-border">
            {budgets.map((b) => {
              const spent = spendByCat[b.category] || 0;
              const limit = Number(b.monthly_limit);
              const pctVal = Math.min(100, Math.round((spent / limit) * 100));
              const over = spent > limit;
              const color = CATEGORY_META[b.category as keyof typeof CATEGORY_META]?.color || "#71717a";
              return (
                <div key={b.id} className="p-4 sm:p-5 flex items-center gap-4">
                  <div className="h-9 w-9 rounded-md grid place-items-center shrink-0"
                       style={{ background: `${color}22` }}>
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-text font-medium">{b.category}</span>
                        <span className="text-text-3 text-xs ml-2">/ month</span>
                      </div>
                      <div className="num text-sm tabular flex items-baseline gap-1.5" data-num>
                        <span className="text-text">{inr(spent)}</span>
                        <span className="text-text-3">/ {inr(limit)}</span>
                        <span className={cn("text-xs", over ? "text-danger-500" : "text-text-3")}>
                          ({pctVal}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", over && "!bg-danger-500")}
                        style={{ width: pctVal + "%", background: over ? undefined : color }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(b.category)}
                    className="h-8 w-8 grid place-items-center rounded text-text-3 hover:text-danger-500 hover:bg-danger-500/10"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
