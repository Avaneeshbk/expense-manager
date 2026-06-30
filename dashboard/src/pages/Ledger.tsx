// Ledger page — full searchable / filterable / sortable list of all expenses.

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Card, Button, EmptyState, Spinner, Badge } from "@/components/ui";
import { fetchAllExpenses, deleteExpense, Expense } from "@/lib/api";
import { inr } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import { CATEGORIES, CATEGORY_COLORS, PAYMENT_META } from "@/lib/categories";
import { cn } from "@/lib/cn";

type SortKey = "spent_at" | "amount" | "category" | "merchant";

export function LedgerPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | "">("");
  const [pay, setPay] = useState<string | "">("");
  const [sort, setSort] = useState<SortKey>("spent_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      try { setExpenses(await fetchAllExpenses(1000)); }
      catch (e: any) { setErr(e?.message || "Failed to load"); }
    })();
  }, []);

  const rows = useMemo(() => {
    if (!expenses) return [];
    let r = expenses;
    if (q) {
      const t = q.toLowerCase();
      r = r.filter((e) =>
        [e.merchant, e.subcategory, e.category, e.note]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(t))
      );
    }
    if (cat) r = r.filter((e) => e.category === cat);
    if (pay) r = r.filter((e) => (e.payment_mode || "unknown") === pay);
    r = [...r].sort((a: any, b: any) => {
      const av = a[sort]; const bv = b[sort];
      const cmp = sort === "amount" ? Number(av) - Number(bv)
        : (av || "").toString().localeCompare((bv || "").toString());
      return dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [expenses, q, cat, pay, sort, dir]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev?.filter((e) => e.id !== id) ?? null);
    } catch (e: any) {
      alert("Failed to delete: " + e.message);
    }
  };

  if (err) return <EmptyState title="Couldn't load" hint={err} />;
  if (!expenses) return <div className="flex items-center gap-2 text-text-3"><Spinner /> Loading…</div>;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search merchant, subcategory, note…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
        <Select
          value={cat}
          onChange={setCat}
          placeholder="All categories"
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Select
          value={pay}
          onChange={setPay}
          placeholder="All payments"
          options={Object.entries(PAYMENT_META).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        {(q || cat || pay) && (
          <Button variant="ghost" onClick={() => { setQ(""); setCat(""); setPay(""); }}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
        <div className="ml-auto text-xs text-text-3">
          {rows.length} of {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title="No matches"
            hint={expenses.length === 0 ? "Log your first expense via the Telegram bot." : "Try clearing filters."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-2/40">
                <tr>
                  <Th label="When"      sortKey="spent_at" sort={sort} dir={dir} onSort={setSort} onDir={setDir} />
                  <Th label="Category"  sortKey="category" sort={sort} dir={dir} onSort={setSort} onDir={setDir} />
                  <Th label="Merchant"  sortKey="merchant" sort={sort} dir={dir} onSort={setSort} onDir={setDir} />
                  <th className="text-left h-10 px-4 font-medium text-text-2 text-xs uppercase tracking-wider">Note</th>
                  <th className="text-left h-10 px-4 font-medium text-text-2 text-xs uppercase tracking-wider">Pay</th>
                  <Th label="Amount"    sortKey="amount"   sort={sort} dir={dir} onSort={setSort} onDir={setDir} align="right" />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="row-hover border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-text-2 text-xs whitespace-nowrap">{fmtDate(e.spent_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[e.category as keyof typeof CATEGORY_COLORS] || "#71717a" }} />
                        <span className="text-text">{e.category}</span>
                        {e.subcategory && <span className="text-text-3 text-xs">· {e.subcategory}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text">{e.merchant || <span className="text-text-3">—</span>}</td>
                    <td className="px-4 py-3 text-text-2 max-w-[200px] truncate">{e.note || <span className="text-text-3">—</span>}</td>
                    <td className="px-4 py-3">
                      {e.payment_mode ? (
                        <span
                          className="text-xs"
                          style={{ color: PAYMENT_META[e.payment_mode as keyof typeof PAYMENT_META]?.color || undefined }}
                        >
                          {PAYMENT_META[e.payment_mode as keyof typeof PAYMENT_META]?.label || e.payment_mode}
                        </span>
                      ) : <span className="text-text-3 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right num tabular" data-num>{inr(e.amount)}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDelete(e.id)}
                        title="Delete"
                        className="h-7 w-7 grid place-items-center rounded text-text-3 hover:text-danger-500 hover:bg-danger-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Th({
  label, sortKey, sort, dir, onSort, onDir, align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  onDir: (d: "asc" | "desc") => void;
  align?: "left" | "right";
}) {
  const active = sort === sortKey;
  return (
    <th
      onClick={() => {
        if (active) onDir(dir === "asc" ? "desc" : "asc");
        else { onSort(sortKey); onDir("desc"); }
      }}
      className={cn(
        "h-10 px-4 font-medium text-text-2 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-text",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );
}

function Select({
  value, onChange, placeholder, options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-3 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
