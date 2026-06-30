// Dashboard data layer — talks to our own Vercel serverless functions.
// The serverless functions use the Supabase SERVICE_ROLE key, so we can
// keep RLS strict on the database and the dashboard stays simple.

export interface Expense {
  id: string;
  telegram_id: number;
  amount: number;
  currency: string;
  category: string;
  subcategory: string | null;
  merchant: string | null;
  payment_mode: string | null;
  note: string | null;
  raw_text: string | null;
  spent_at: string;
  created_at: string;
  updated_at: string;
  is_recurring: boolean;
}

export interface Budget {
  id: string;
  telegram_id: number;
  category: string;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
}

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

async function jsend<T>(url: string, method: "POST" | "DELETE", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export async function fetchExpenses(fromIso: string, toIso: string): Promise<Expense[]> {
  const params = new URLSearchParams({ from: fromIso, to: toIso });
  return jget<Expense[]>(`/api/expenses?${params.toString()}`);
}

export async function fetchAllExpenses(limit = 1000): Promise<Expense[]> {
  return jget<Expense[]>(`/api/expenses?limit=${limit}`);
}

export async function fetchBudgets(): Promise<Budget[]> {
  return jget<Budget[]>(`/api/budgets`);
}

export async function upsertBudget(category: string, monthlyLimit: number): Promise<Budget> {
  return jsend<Budget>(`/api/budgets`, "POST", { category, monthly_limit: monthlyLimit });
}

export async function deleteBudget(category: string): Promise<void> {
  await jsend(`/api/budgets?category=${encodeURIComponent(category)}`, "DELETE");
}

export async function deleteExpense(id: string): Promise<void> {
  await jsend(`/api/expenses/${id}`, "DELETE");
}
