// INR money formatting — same logic as the bot, but in TS and with more
// output options for the dashboard (compact, signed, table-cell-aligned).

export function inr(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  const parts = v.toFixed(2).split(".");
  let intPart = parts[0];
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  if (rest) intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  return `₹${intPart}.${parts[1]}`;
}

export function inrShort(n: number | null | undefined): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function pct(n: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export function signedInr(n: number): string {
  return n < 0 ? `-${inr(Math.abs(n))}` : inr(n);
}
