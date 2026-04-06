"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { type ThemeId } from "@/lib/themes";
import { applyTheme, getThemeById } from "@/lib/theme-utils";
import { saveSettings } from "@/lib/settings";

type ThemeContextValue = {
  currentTheme: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  currentTheme: "neutral-dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("neutral-dark");

  useEffect(() => {
    const saved = localStorage.getItem("stride-theme") ?? "neutral-dark";
    const id = getThemeById(saved);
    setCurrentTheme(id);
    applyTheme(id);
    // Re-apply accent override if user has a custom one
    const accent = localStorage.getItem("stride-accent");
    if (accent) document.documentElement.style.setProperty("--accent", accent);
  }, []);

  // Re-apply when settings are loaded from Supabase (storage event from loadSettings)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "stride-theme" && e.newValue) {
        const id = getThemeById(e.newValue);
        setCurrentTheme(id);
        applyTheme(id);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setCurrentTheme(id);
    // Clear any stored accent so the theme's own accent takes effect
    localStorage.removeItem("stride-accent");
    applyTheme(id);
    void saveSettings("stride-theme", id);
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
