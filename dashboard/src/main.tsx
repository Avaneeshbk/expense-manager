import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Anti-flash: set the theme class on <html> BEFORE React mounts,
// using the same logic as ThemeProvider. This prevents a flash of light
// theme on first paint when the user prefers dark.
(function () {
  try {
    const m = localStorage.getItem("ledger:theme") || "system";
    const isDark = m === "dark"
      || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
  } catch {}
})();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
