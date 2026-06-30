// Theme management. Persists to localStorage, respects system preference on
// first load. No flash of wrong theme — applied via inline script in index.html
// before React mounts.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Mode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const STORAGE_KEY = "ledger:theme";

function getSystemPref(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(mode: Mode): Resolved {
  return mode === "system" ? getSystemPref() : mode;
}

function applyClass(resolved: Resolved) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

type Ctx = {
  mode: Mode;
  resolved: Resolved;
  setMode: (m: Mode) => void;
  cycle: () => void;     // light → dark → system → light
};
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    if (typeof window === "undefined") return "system";
    return ((localStorage.getItem(STORAGE_KEY) as Mode) || "system");
  });
  const [resolved, setResolved] = useState<Resolved>(() => resolve(mode));

  useEffect(() => {
    const r = resolve(mode);
    setResolved(r);
    applyClass(r);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // React to system preference changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = resolve("system");
      setResolved(r);
      applyClass(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = (m: Mode) => setModeState(m);
  const cycle = () =>
    setModeState((m) => (m === "light" ? "dark" : m === "dark" ? "system" : "light"));

  return (
    <ThemeCtx.Provider value={{ mode, resolved, setMode, cycle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme must be used inside <ThemeProvider>");
  return c;
}
