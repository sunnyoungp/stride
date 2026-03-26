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

    // Interface font size (sidebar, nav, labels) — new key, falls back to legacy
    const uiFont = localStorage.getItem("stride-font-ui") ?? localStorage.getItem("stride-font-size") ?? "14px";
    document.documentElement.style.setProperty("--font-size-ui", uiFont);
    document.documentElement.style.setProperty("--font-size-base", uiFont); // legacy alias

    // Task content font size (task list titles, kanban cards)
    const tasksFont = localStorage.getItem("stride-font-tasks") ?? "15px";
    document.documentElement.style.setProperty("--font-size-tasks", tasksFont);

    // Notes editor font size is handled per-editor via --font-size-notes default

    const sidebarWidth = localStorage.getItem("stride-sidebar-width") ?? "220px";
    document.documentElement.style.setProperty("--sidebar-width", sidebarWidth);

    const compact = localStorage.getItem("stride-compact") === "true";
    document.documentElement.setAttribute("data-compact", String(compact));
  }, []);

  return null;
}
