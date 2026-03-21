"use client";

import { useEffect } from "react";

export function SettingsApplier() {
  useEffect(() => {
    const accent = localStorage.getItem("stride-accent") ?? "#e8603c";
    document.documentElement.style.setProperty("--accent", accent);

    const fontSize = localStorage.getItem("stride-font-size") ?? "14px";
    document.documentElement.style.setProperty("--font-size-base", fontSize);

    const sidebarWidth = localStorage.getItem("stride-sidebar-width") ?? "220px";
    document.documentElement.style.setProperty("--sidebar-width", sidebarWidth);

    const compact = localStorage.getItem("stride-compact") === "true";
    document.documentElement.setAttribute("data-compact", String(compact));

    const theme = localStorage.getItem("stride-theme") ?? "light";
    document.documentElement.setAttribute("data-theme", theme);

    const noteFontSize = localStorage.getItem("stride-note-font-size") ?? "14px";
    document.documentElement.style.setProperty("--note-font-size", noteFontSize);
  }, []);

  return null;
}
