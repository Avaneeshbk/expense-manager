// Theme toggle — cycles light → dark → system.

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const next = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const label = mode === "system" ? "System theme" : mode === "dark" ? "Dark theme" : "Light theme";
  return (
    <button
      onClick={() => setMode(next)}
      title={`Theme: ${label} (click for ${next})`}
      className="inline-flex items-center justify-center h-9 w-9 rounded-md text-text-2 hover:text-text hover:bg-surface-2 transition-colors"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
