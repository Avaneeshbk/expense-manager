// Stat card — a primary metric, optional sub-metric, and optional trend indicator.
// Used on the overview page in a 2x2 or 3-column grid.

import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  sub,
  trend,    // "+12%" or "-3%" etc.
  trendDir, // "up" | "down" | "flat"
  icon,
  intent = "neutral",  // "neutral" | "danger" — danger inverts the trend coloring
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  trend?: string;
  trendDir?: "up" | "down" | "flat";
  icon?: ReactNode;
  intent?: "neutral" | "danger";
}) {
  // For "danger" intent, an UP trend is bad (e.g. over budget) — color red.
  // For neutral intent, an UP trend is just informational — gray.
  const trendColor = (() => {
    if (!trendDir) return "text-text-3";
    if (trendDir === "flat") return "text-text-3";
    const bad = (intent === "danger" && trendDir === "up") || (intent !== "danger" && trendDir === "down");
    return bad ? "text-danger-500" : "text-accent-600 dark:text-accent-400";
  })();

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between">
        <span className="label">{label}</span>
        {icon && <span className="text-text-3">{icon}</span>}
      </div>
      <div className="num text-num-lg text-text" data-num>
        {value}
      </div>
      <div className="flex items-center justify-between text-xs">
        {sub && <span className="text-text-3">{sub}</span>}
        {trend && (
          <span className={cn("inline-flex items-center gap-0.5 num", trendColor)}>
            {trendDir === "up" && <ArrowUpRight className="h-3 w-3" />}
            {trendDir === "down" && <ArrowDownRight className="h-3 w-3" />}
            {trendDir === "flat" && <Minus className="h-3 w-3" />}
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
