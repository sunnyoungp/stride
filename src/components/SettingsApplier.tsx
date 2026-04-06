"use client";

import { useEffect } from "react";
import { applyTheme, getThemeById } from "@/lib/theme-utils";

export function SettingsApplier() {
  useEffect(() => {
    // Apply full theme (all CSS tokens)
    const themeSetting = localStorage.getItem("stride-theme") ?? "neutral-dark";
    applyTheme(getThemeById(themeSetting));

    // Custom tint override — applied after theme so it wins
    const tintH = localStorage.getItem("stride-tint-h");
    const tintS = localStorage.getItem("stride-tint-s");
    if (tintH) document.documentElement.style.setProperty("--tint-h", tintH);
    if (tintS) document.documentElement.style.setProperty("--tint-s", tintS);

    // Per-user accent override — only applied if still stored (cleared on theme switch)
    const accent = localStorage.getItem("stride-accent");
    if (accent) document.documentElement.style.setProperty("--accent", accent);


    // Interface font size (sidebar, nav, labels) — new key, falls back to legacy
    const uiFont = localStorage.getItem("stride-font-ui") ?? localStorage.getItem("stride-font-size") ?? "14px";
    document.documentElement.style.setProperty("--font-size-ui", uiFont);
    document.documentElement.style.setProperty("--font-size-base", uiFont); // legacy alias

    // Task content font size (task list titles, kanban cards)
    const tasksFont = localStorage.getItem("stride-font-tasks") ?? "15px";
    document.documentElement.style.setProperty("--font-size-tasks", tasksFont);

    // Apply font family lazily
    const fontPref = localStorage.getItem("stride-font-preference") ?? "system";
    const fontMap: Record<string, string> = {
      system: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      inter: "Inter, sans-serif",
      serif: "Georgia, serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    };
    
    if (fontPref === "inter" && !document.getElementById("inter-font")) {
      const link = document.createElement("link");
      link.id = "inter-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
    
    document.documentElement.style.setProperty("--font-app", fontMap[fontPref] || fontMap.system);

    // Notes editor font size is handled per-editor via --font-size-notes default

    const sidebarWidth = localStorage.getItem("stride-sidebar-width") ?? "220px";
    document.documentElement.style.setProperty("--sidebar-width", sidebarWidth);

    const compact = localStorage.getItem("stride-compact") === "true";
    document.documentElement.setAttribute("data-compact", String(compact));
  }, []);

  return null;
}
