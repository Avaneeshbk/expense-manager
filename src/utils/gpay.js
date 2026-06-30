// Strips the boilerplate text that GPay adds when you share a receipt.
//
// GPay's share flow attaches a caption like:
//
//   Paid using Google Pay! ✅
//
//   Crores of Indians trust Google Pay for their daily UPI payments -
//   it's fast, simple, and incredibly reliable. Tap to check your
//   updated bank balance.
//
//   https://gpay.app.goo.gl/Check_your_balance
//
// We want to drop all of that and keep only what the user actually typed.
// If the remaining text is empty or trivial, return an empty string — the
// caller should treat that as "no caption".

// Each pattern matches a specific boilerplate phrase. We replace with a space
// (not empty string) so subsequent passes still work on the remaining text.
const PATTERNS = [
  /paid using google pay!?\s*\u2705?/gi,
  /crores of indians trust google pay[^.]*\./gi,
  /it'?s? fast,? simple,? and incredibly reliable[^.]*\./gi,
  /tap to check your updated bank balance[^.]*\./gi,
  /https:\/\/gpay\.app\.goo\.gl\/\S+/gi,
];

export function stripGpayBoilerplate(caption) {
  if (!caption) return "";
  let s = caption;
  for (const pat of PATTERNS) {
    s = s.replace(pat, " ");
  }
  // Collapse whitespace, trim
  s = s.replace(/\s+/g, " ").trim();
  // If what remains is just punctuation or a few common filler words, ignore
  if (!s) return "";
  if (/^(ok|okay|done|sent|paid)\.?$/i.test(s)) return "";
  return s;
}
