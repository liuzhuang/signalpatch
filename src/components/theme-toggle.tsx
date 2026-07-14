"use client";

import { useState, useSyncExternalStore } from "react";

function prefersDarkTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribeToSystemTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

export function ThemeToggle() {
  const systemIsDark = useSyncExternalStore(
    subscribeToSystemTheme,
    prefersDarkTheme,
    () => false,
  );
  const [themeOverride, setThemeOverride] = useState<boolean | null>(null);
  const isDark = themeOverride ?? systemIsDark;

  function toggleTheme() {
    const nextIsDark = !isDark;
    document.documentElement.dataset.theme = nextIsDark ? "dark" : "light";
    setThemeOverride(nextIsDark);
  }

  return (
    <button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark ?? false}
      className="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
