// Small UI primitives — buttons, badges, empty states, etc.

import { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 sm:px-6 lg:px-8 py-6 lg:py-8", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 lg:mb-8">
      <div>
        <h1 className="text-display tracking-tight">{title}</h1>
        {subtitle && <p className="text-text-2 mt-1 text-sm">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" };
export function Button({ className, variant = "primary", children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-sm font-medium transition-all duration-150 ease-out-expo",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" &&
          "bg-ink-900 text-ink-50 hover:bg-ink-800 dark:bg-ink-50 dark:text-ink-900 dark:hover:bg-white",
        variant === "secondary" &&
          "bg-surface-2 text-text hover:bg-surface border border-border",
        variant === "ghost" &&
          "text-text-2 hover:text-text hover:bg-surface-2",
        variant === "danger" &&
          "bg-danger-500 text-white hover:bg-danger-600",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "accent" }) {
  const map: Record<string, string> = {
    neutral: "bg-surface-2 text-text-2 border-border",
    success: "bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:border-accent-800",
    warning: "bg-warn-400/10 text-warn-600 border-warn-400/30 dark:text-warn-400",
    danger:  "bg-danger-500/10 text-danger-600 border-danger-500/30 dark:text-danger-400",
    accent:  "bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:border-accent-800",
  };
  return (
    <span className={cn("inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium uppercase tracking-wider border", map[tone])}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-3 text-text-3">{icon}</div>}
      <p className="text-text font-medium">{title}</p>
      {hint && <p className="text-text-3 text-sm mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="inline-block h-4 w-4 border-2 border-text-3/30 border-t-text-2 rounded-full animate-spin" />
  );
}
