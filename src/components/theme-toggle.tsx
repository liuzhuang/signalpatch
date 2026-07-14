"use client";

import { useState, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function subscribeToSystemTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

export function ThemeToggle() {
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "light",
  );
  const [override, setOverride] = useState<Theme | null>(null);
  const theme = override ?? systemTheme;

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setOverride(nextTheme);
  }

  return (
    <button
      aria-checked={theme === "dark"}
      aria-label={`切换为${theme === "dark" ? "浅色" : "深色"}主题`}
      className="theme-toggle"
      onClick={toggleTheme}
      role="switch"
      type="button"
    >
      {theme === "dark" ? "☼ 浅色" : "☾ 深色"}
    </button>
  );
}
