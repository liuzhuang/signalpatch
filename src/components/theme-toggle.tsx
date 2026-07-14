"use client";

import { useEffect } from "react";

const THEME_STORAGE_KEY = "signalpatch-theme";
type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme | null) {
  const root = document.documentElement;
  if (theme) {
    root.dataset.theme = theme;
  } else {
    root.removeAttribute("data-theme");
  }
}

export function ThemeToggle() {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    applyTheme(
      savedTheme === "light" || savedTheme === "dark" ? savedTheme : null,
    );
  }, []);

  function toggleTheme() {
    const currentTheme =
      (document.documentElement.dataset.theme as Theme | undefined) ??
      getSystemTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="切换亮色/深色模式"
      onClick={toggleTheme}
    >
      切换主题
    </button>
  );
}
