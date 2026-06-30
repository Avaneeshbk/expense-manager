// Time helpers — IST by default, but always work in the user's timezone when known.
// All "now" defaults use `new Date()` (not `new Date(undefined)` which is Invalid).

export function dayRangeInTz(tz, date) {
  // Returns { from, to } ISO strings for the given local date in tz.
  const d = (date instanceof Date && !isNaN(date)) ? date : new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const y = p.year, m = p.month, dd = p.day;
  // Start = 00:00:00 local. End = next day 00:00:00.
  // Build a UTC instant for the local midnight by using the offset at that date.
  const offsetMin = tzOffsetMinutes(tz, new Date(Date.UTC(Number(y), Number(m) - 1, Number(dd))));
  const startUtc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(dd), 0, 0, 0) - offsetMin * 60_000);
  const endUtc   = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { from: startUtc.toISOString(), to: endUtc.toISOString() };
}

export function weekRangeInTz(tz, ref = new Date()) {
  // Last 7 days ending today (inclusive of today).
  const d = (ref instanceof Date && !isNaN(ref)) ? ref : new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const todayUtcMidnight = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  const offsetMin = tzOffsetMinutes(tz, todayUtcMidnight);
  const startLocal = new Date(todayUtcMidnight.getTime() - 6 * 24 * 60 * 60 * 1000);
  const startUtc = new Date(startLocal.getTime() - offsetMin * 60_000);
  const endUtc = new Date(todayUtcMidnight.getTime() - offsetMin * 60_000 + 24 * 60 * 60 * 1000);
  return { from: startUtc.toISOString(), to: endUtc.toISOString() };
}

export function monthRangeInTz(tz, ref = new Date()) {
  const d = (ref instanceof Date && !isNaN(ref)) ? ref : new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const y = Number(p.year), m = Number(p.month);
  const startLocal = new Date(Date.UTC(y, m - 1, 1));
  const offsetMin = tzOffsetMinutes(tz, startLocal);
  const startUtc = new Date(startLocal.getTime() - offsetMin * 60_000);
  const endLocal = new Date(Date.UTC(y, m, 1));
  const endUtc = new Date(endLocal.getTime() - offsetMin * 60_000);
  return { from: startUtc.toISOString(), to: endUtc.toISOString() };
}

function tzOffsetMinutes(tz, utcDate) {
  // Compute the offset of `tz` at `utcDate` (a UTC instant) in minutes.
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

export function formatRangeLabel(fromIso, toIso, tz) {
  const f = new Intl.DateTimeFormat("en-IN", {
    timeZone: tz, day: "numeric", month: "short", year: "numeric",
  });
  return `${f.format(new Date(fromIso))} → ${f.format(new Date(toIso))}`;
}
