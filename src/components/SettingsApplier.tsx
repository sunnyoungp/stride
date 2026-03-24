"use client";

import { useEffect } from "react";
import { applyTheme, getThemeById } from "@/lib/theme-utils";

export function SettingsApplier() {
  useEffect(() => {
    // Apply full theme (all CSS tokens)
    const themeSetting = localStorage.getItem("stride-theme") ?? "neutral-dark";
    applyTheme(getThemeById(themeSetting));

    // Per-user overrides applied after the theme
    const accent = localStorage.getItem("stride-accent");
    if (accent) document.documentElement.style.setProperty("--accent", accent);

    const fontSize = localStorage.getItem("stride-font-size") ?? "14px";
    document.documentElement.style.setProperty("--font-size-base", fontSize);

    const sidebarWidth = localStorage.getItem("stride-sidebar-width") ?? "220px";
    document.documentElement.style.setProperty("--sidebar-width", sidebarWidth);

    const compact = localStorage.getItem("stride-compact") === "true";
    document.documentElement.setAttribute("data-compact", String(compact));

    const noteBase = parseInt(fontSize, 10) || 14;
    document.documentElement.style.setProperty("--note-font-size", `${noteBase + 3}px`);
  }, []);

  return null;
}
