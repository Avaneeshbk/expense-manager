// Sidebar — vertical navigation that collapses to a top bar on mobile.

import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ListFilter, BarChart3, Settings, Receipt } from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./ThemeToggle";
import { useState } from "react";

const NAV = [
  { to: "/",         label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/ledger",   label: "Ledger",   icon: ListFilter },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border bg-surface/50">
        <div className="h-16 flex items-center px-5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-ink-900 dark:bg-ink-50 grid place-items-center text-ink-50 dark:text-ink-900">
              <Receipt className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold tracking-tight">Ledger</span>
          </div>
        </div>
        <nav className="px-3 py-2 space-y-0.5 flex-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 h-9 px-3 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-surface-2 text-text font-medium"
                    : "text-text-2 hover:text-text hover:bg-surface-2/60"
                )
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-3">Theme</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-bg/80 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-ink-900 dark:bg-ink-50 grid place-items-center text-ink-50 dark:text-ink-900">
              <Receipt className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold tracking-tight">Ledger</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setOpen((o) => !o)}
              className="h-9 w-9 grid place-items-center rounded-md hover:bg-surface-2"
              aria-label="Menu"
            >
              <div className="space-y-1">
                <span className="block w-4 h-px bg-text" />
                <span className="block w-4 h-px bg-text" />
                <span className="block w-4 h-px bg-text" />
              </div>
            </button>
          </div>
        </div>
        {open && (
          <nav className="px-3 py-2 border-t border-border bg-bg">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 h-9 px-3 rounded-md text-sm",
                    isActive ? "bg-surface-2 text-text font-medium" : "text-text-2"
                  )
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
