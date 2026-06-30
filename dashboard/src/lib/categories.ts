// Category palette + icon mapping for the dashboard.
// Colors are picked from a 6-tone muted scale (no bright candy colors).

export const CATEGORIES = [
  "Food", "Transport", "Shopping", "Groceries", "Bills", "Entertainment",
  "Health", "Education", "Rent", "Subscriptions", "Personal", "Travel",
  "Investment", "Gifts", "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Each category gets a soft, slightly tinted color. Designed to look at home
// in both light and dark modes (we apply the right shade via CSS).
export const CATEGORY_META: Record<Category, { color: string; icon: string }> = {
  Food:          { color: "hsl(20 70% 55%)",   icon: "utensils" },
  Transport:     { color: "hsl(210 65% 55%)",  icon: "car" },
  Shopping:      { color: "hsl(330 55% 60%)",  icon: "shopping-bag" },
  Groceries:     { color: "hsl(140 45% 50%)",  icon: "leaf" },
  Bills:         { color: "hsl(40 70% 55%)",   icon: "receipt" },
  Entertainment: { color: "hsl(280 50% 60%)",  icon: "film" },
  Health:        { color: "hsl(170 50% 50%)",  icon: "heart-pulse" },
  Education:     { color: "hsl(250 55% 60%)",  icon: "book" },
  Rent:          { color: "hsl(220 15% 50%)",  icon: "home" },
  Subscriptions: { color: "hsl(190 55% 50%)",  icon: "refresh-cw" },
  Personal:      { color: "hsl(0 0% 55%)",     icon: "user" },
  Travel:        { color: "hsl(195 70% 50%)",  icon: "plane" },
  Investment:    { color: "hsl(160 60% 45%)",  icon: "trending-up" },
  Gifts:         { color: "hsl(350 60% 60%)",  icon: "gift" },
  Other:         { color: "hsl(220 10% 60%)",  icon: "circle" },
};

export const CATEGORY_COLORS = Object.fromEntries(
  CATEGORIES.map((c) => [c, CATEGORY_META[c].color])
) as Record<Category, string>;

export const PAYMENT_MODES = ["upi", "card", "cash", "wallet", "netbanking", "other", "unknown"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_META: Record<PaymentMode, { color: string; label: string }> = {
  upi:        { color: "hsl(160 60% 45%)", label: "UPI" },
  card:       { color: "hsl(220 60% 55%)", label: "Card" },
  cash:       { color: "hsl(40 70% 55%)",  label: "Cash" },
  wallet:     { color: "hsl(280 50% 60%)", label: "Wallet" },
  netbanking: { color: "hsl(200 50% 50%)", label: "Net Banking" },
  other:      { color: "hsl(220 10% 55%)", label: "Other" },
  unknown:    { color: "hsl(220 10% 40%)", label: "Unknown" },
};
