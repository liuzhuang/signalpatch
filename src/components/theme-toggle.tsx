"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "signalpatch-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme: Theme | null) {
  if (theme) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      queueMicrotask(() => setTheme(storedTheme));
      applyTheme(storedTheme);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const syncSystemTheme = () => {
      const nextTheme = systemTheme();
      queueMicrotask(() => setTheme(nextTheme));
      applyTheme(null);
    };

    syncSystemTheme();
    mediaQuery.addEventListener("change", syncSystemTheme);
    return () => mediaQuery.removeEventListener("change", syncSystemTheme);
  }, []);

  function selectTheme(nextTheme: Theme) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className="theme-toggle" aria-label="主题模式" role="group">
      <span>主题</span>
      <button
        aria-label="亮色模式"
        aria-pressed={theme === "light"}
        onClick={() => selectTheme("light")}
        type="button"
      >
        亮色
      </button>
      <button
        aria-label="深色模式"
        aria-pressed={theme === "dark"}
        onClick={() => selectTheme("dark")}
        type="button"
      >
        深色
      </button>
    </div>
  );
}
