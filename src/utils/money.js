// INR money formatting + parsing helpers.

export function inr(n) {
  // Indian numbering: 1,23,456.78
  const v = Number(n) || 0;
  const parts = v.toFixed(2).split(".");
  let intPart = parts[0];
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  if (rest) intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  return `₹${intPart}.${parts[1]}`;
}

export function inrShort(n) {
  // Compact: ₹1.2K, ₹3.4L, ₹1.2Cr
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`;
  return `₹${v.toFixed(0)}`;
}

const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine",
              "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen",
              "seventeen","eighteen","nineteen"];
const TENS = ["", "", "twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

export function pct(n, total) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export function smallNumberToInt(s) {
  // very small utility: parse "two fifty" -> 250, "twenty five" -> 25, "two thousand five hundred" -> 2500
  // We let the LLM handle most of this; this is just a defensive fallback.
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  return null;
}
