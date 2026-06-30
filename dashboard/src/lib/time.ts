// Date helpers. All work in the user's local timezone (default Asia/Kolkata).
import { format, formatDistanceToNow, parseISO, startOfMonth, endOfMonth, subDays } from "date-fns";

export function dayRangeInTz(tz: string, date: Date = new Date()): { from: string; to: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const y = p.year, m = p.month, dd = p.day;
  const offset = tzOffsetMinutes(tz, new Date(Date.UTC(Number(y), Number(m) - 1, Number(dd))));
  const start = new Date(Date.UTC(Number(y), Number(m) - 1, Number(dd), 0, 0, 0) - offset * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function monthRangeInTz(tz: string, ref: Date = new Date()): { from: string; to: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(ref).map((x) => [x.type, x.value]));
  const y = Number(p.year), m = Number(p.month);
  const startLocal = new Date(Date.UTC(y, m - 1, 1));
  const offset = tzOffsetMinutes(tz, startLocal);
  const start = new Date(startLocal.getTime() - offset * 60_000);
  const endLocal = new Date(Date.UTC(y, m, 1));
  const end = new Date(endLocal.getTime() - offset * 60_000);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function allTimeRangeInTz(tz: string, fromIso: string): { from: string; to: string } {
  // Everything from `fromIso` to "now" (in the user's tz)
  return { from: fromIso, to: new Date(Date.now() + 60_000).toISOString() };
}

function tzOffsetMinutes(tz: string, utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(utcDate).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === "24" ? 0 : parts.hour),
    Number(parts.minute), Number(parts.second)
  );
  return Math.round((asUTC - utcDate.getTime()) / 60_000);
}

export function fmtDate(iso: string): string {
  try { return format(parseISO(iso), "d MMM, HH:mm"); } catch { return iso; }
}
export function fmtDay(iso: string): string {
  try { return format(parseISO(iso), "d MMM"); } catch { return iso; }
}
export function fmtMonth(iso: string): string {
  try { return format(parseISO(iso), "MMM yyyy"); } catch { return iso; }
}
export function fmtRelative(iso: string): string {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); } catch { return iso; }
}
export function fmtClock(iso: string): string {
  try { return format(parseISO(iso), "HH:mm"); } catch { return ""; }
}

export const thisMonth = (tz: string) => monthRangeInTz(tz);
export const today = (tz: string) => dayRangeInTz(tz);
export const lastNDays = (n: number) => {
  const to = new Date();
  const from = subDays(to, n - 1);
  return { from: from.toISOString(), to: to.toISOString() };
};
