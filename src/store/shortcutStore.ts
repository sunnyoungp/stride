"use client";

import { create } from "zustand";

export type ShortcutAction =
  | "open-quickadd"
  | "new-task"
  | "search"
  | "go-dashboard"
  | "go-notes"
  | "go-inbox"
  | "go-next7"
  | "go-tasks"
  | "go-calendar"
  | "go-documents"
  | "go-settings";

export type ShortcutDef = {
  action: ShortcutAction;
  label: string;
  defaultBinding: string;  // e.g. "Meta+k"
  customBinding?: string;
};

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { action: "open-quickadd", label: "Open Quick Add",    defaultBinding: "Meta+k" },
  { action: "new-task",      label: "New Task",          defaultBinding: "Meta+n" },
  { action: "search",        label: "Search",            defaultBinding: "Meta+f" },
  { action: "go-dashboard",  label: "Go to Dashboard",   defaultBinding: "Meta+1" },
  { action: "go-notes",      label: "Go to Notes",       defaultBinding: "Meta+2" },
  { action: "go-inbox",      label: "Go to Inbox",       defaultBinding: "Meta+3" },
  { action: "go-next7",      label: "Go to Next 7 Days", defaultBinding: "Meta+4" },
  { action: "go-tasks",      label: "Go to Tasks",       defaultBinding: "Meta+5" },
  { action: "go-calendar",   label: "Go to Calendar",    defaultBinding: "Meta+6" },
  { action: "go-documents",  label: "Go to Documents",   defaultBinding: "Meta+7" },
  { action: "go-settings",   label: "Go to Settings",    defaultBinding: "Meta+," },
];

type ShortcutStore = {
  shortcuts: ShortcutDef[];
  setCustomBinding: (action: ShortcutAction, binding: string | null) => void;
  resetAll: () => void;
  loadFromStorage: () => void;
};

export const useShortcutStore = create<ShortcutStore>((set, get) => ({
  shortcuts: DEFAULT_SHORTCUTS,

  setCustomBinding: (action, binding) => {
    const shortcuts = get().shortcuts.map((s) =>
      s.action === action ? { ...s, customBinding: binding ?? undefined } : s,
    );
    set({ shortcuts });
    const saved: Record<string, string> = {};
    shortcuts.forEach((s) => { if (s.customBinding) saved[s.action] = s.customBinding; });
    if (typeof window !== "undefined") {
      localStorage.setItem("stride-shortcuts", JSON.stringify(saved));
    }
  },

  resetAll: () => {
    const shortcuts = DEFAULT_SHORTCUTS.map((s) => ({ ...s, customBinding: undefined }));
    set({ shortcuts });
    if (typeof window !== "undefined") localStorage.removeItem("stride-shortcuts");
  },

  loadFromStorage: () => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem("stride-shortcuts") ?? "{}") as Record<string, string>;
      const shortcuts = DEFAULT_SHORTCUTS.map((s) => ({
        ...s,
        customBinding: saved[s.action] ?? undefined,
      }));
      set({ shortcuts });
    } catch { /* ignore */ }
  },
}));

/** Normalize a KeyboardEvent into a binding string, e.g. "Meta+Shift+k" */
export function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("Meta");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  const k = e.key === "," ? "," : e.key.length === 1 ? e.key.toLowerCase() : e.key;
  parts.push(k);
  return parts.join("+");
}

/** Format a binding string for display, e.g. "Meta+Shift+k" → "⌘⇧K" */
export function formatBinding(binding: string): string {
  return binding
    .split("+")
    .map((p) => ({ Meta: "⌘", Shift: "⇧", Alt: "⌥", Control: "⌃" }[p] ?? p.toUpperCase()))
    .join("");
}
