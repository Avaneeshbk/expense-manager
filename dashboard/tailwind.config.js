/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        // Tight, technical-feeling display sizes
        "display-lg": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "600" }],
        "display":    ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "600" }],
        "title":      ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "label":      ["0.6875rem", { lineHeight: "1", letterSpacing: "0.08em", fontWeight: "600" }],
        "num":        ["0.9375rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "500" }],
        "num-lg":     ["1.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
      },
      colors: {
        // Neutral palette — designed to feel "expensive" and not loud
        ink: {
          50:  "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
        // Single accent — emerald feels "money/finance" without being clichéd
        accent: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
        // Status colors
        warn: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        danger: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
        // Semantic tokens — defined in :root via CSS variables
        bg:       "rgb(var(--bg) / <alpha-value>)",
        surface:  "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border:   "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        text:     "rgb(var(--text) / <alpha-value>)",
        "text-2": "rgb(var(--text-2) / <alpha-value>)",
        "text-3": "rgb(var(--text-3) / <alpha-value>)",
        accent:   "rgb(var(--accent) / <alpha-value>)",
        "accent-2": "rgb(var(--accent-2) / <alpha-value>)",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
      },
      boxShadow: {
        // Subtle, layered shadows — not the default Tailwind mega-shadows
        "soft": "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)",
        "card": "0 1px 3px rgb(0 0 0 / 0.04), 0 0 0 1px rgb(0 0 0 / 0.04)",
        "pop":  "0 4px 12px rgb(0 0 0 / 0.08), 0 0 0 1px rgb(0 0 0 / 0.04)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
