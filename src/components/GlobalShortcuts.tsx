"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import { useShortcutStore, normalizeKey } from "@/store/shortcutStore";

export function GlobalShortcuts() {
  const router          = useRouter();
  const openSearch      = useUIStore((s) => s.openSearch);
  const shortcuts       = useShortcutStore((s) => s.shortcuts);
  const loadFromStorage = useShortcutStore((s) => s.loadFromStorage);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const combo = normalizeKey(e);
      const tag = (e.target as HTMLElement).tagName;
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" ||
        (e.target as HTMLElement).isContentEditable;

      const match = shortcuts.find((s) => (s.customBinding ?? s.defaultBinding) === combo);
      if (!match) return;

      // These work even when editing
      if (match.action === "open-quickadd" || match.action === "new-task") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("stride:open-quickadd"));
        return;
      }
      if (match.action === "search") {
        e.preventDefault();
        openSearch();
        return;
      }

      if (isEditing) return;

      const navMap: Record<string, string> = {
        "go-dashboard":  "/",
        "go-notes":      "/notes",
        "go-inbox":      "/inbox",
        "go-next7":      "/next7",
        "go-tasks":      "/tasks",
        "go-calendar":   "/calendar",
        "go-documents":  "/documents",
        "go-settings":   "/settings",
      };

      if (navMap[match.action]) {
        e.preventDefault();
        router.push(navMap[match.action]!);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, openSearch, shortcuts]);

  return null;
}
