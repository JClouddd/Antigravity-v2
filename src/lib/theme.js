"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({});

const THEMES = ["light", "dark", "system"];

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getResolvedTheme(preference) {
  if (preference === "system") return getSystemTheme();
  return preference;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState("system");
  const [resolved, setResolved] = useState("light");

  // Load saved preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme_preference");
      if (saved && THEMES.includes(saved)) {
        setPreference(saved);
      }
    } catch {}
  }, []);

  // Apply theme to document
  useEffect(() => {
    const theme = getResolvedTheme(preference);
    setResolved(theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [preference]);

  // Listen for system theme changes
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(getSystemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  const setTheme = (theme) => {
    if (THEMES.includes(theme)) {
      setPreference(theme);
      try {
        localStorage.setItem("theme_preference", theme);
      } catch {}
    }
  };

  return (
    <ThemeContext.Provider value={{ theme: resolved, preference, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
