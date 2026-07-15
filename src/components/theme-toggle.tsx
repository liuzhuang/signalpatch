"use client";

import { useState } from "react";

type Theme = "light" | "dark" | "blue" | "black";
type ThemePreference = Theme | "system";

export function ThemeToggle() {
  const [override, setOverride] = useState<Theme | null>(null);

  function setThemePreference(preference: ThemePreference) {
    if (preference === "system") {
      delete document.documentElement.dataset.theme;
      setOverride(null);
      return;
    }

    document.documentElement.dataset.theme = preference;
    setOverride(preference);
  }

  return (
    <select
      aria-label="主题皮肤"
      className="theme-toggle"
      onChange={(event) =>
        setThemePreference(event.target.value as ThemePreference)
      }
      value={override ?? "system"}
    >
      <option value="system">跟随系统</option>
      <option value="light">浅色</option>
      <option value="dark">深色</option>
      <option value="blue">蓝色</option>
      <option value="black">黑色</option>
    </select>
  );
}
