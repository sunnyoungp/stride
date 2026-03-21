"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useShortcutStore, DEFAULT_SHORTCUTS, normalizeKey, formatBinding, type ShortcutAction } from "@/store/shortcutStore";
import { saveSettings } from "@/lib/settings";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = { id: string; label: string; href: string; visible: boolean; order: number };

const DEFAULT_NAV: NavItem[] = [
  { id: "/",          label: "Dashboard",   href: "/",          visible: true, order: 0 },
  { id: "/notes",     label: "Notes",       href: "/notes",     visible: true, order: 1 },
  { id: "/inbox",     label: "Inbox",       href: "/inbox",     visible: true, order: 2 },
  { id: "/next7",     label: "Next 7 Days", href: "/next7",     visible: true, order: 3 },
  { id: "/tasks",     label: "Tasks",       href: "/tasks",     visible: true, order: 4 },
  { id: "/calendar",  label: "Calendar",    href: "/calendar",  visible: true, order: 5 },
  { id: "/documents", label: "Documents",   href: "/documents", visible: true, order: 6 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ls(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function setCSSVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function SettingCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{
      borderRadius: 16,
      border: "1px solid var(--border)",
      padding: 24,
      marginBottom: 24,
      background: "var(--bg-card)",
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 20 }}>{title}</h2>
      {children}
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--fg)" }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", background: "var(--bg-subtle)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            padding: "5px 12px",
            fontSize: 12.5, fontWeight: 500,
            border: "none",
            background: value === o.value ? "var(--bg-card)" : "transparent",
            color: value === o.value ? "var(--fg)" : "var(--fg-faint)",
            cursor: "pointer",
            boxShadow: value === o.value ? "var(--shadow-sm)" : "none",
            borderRadius: value === o.value ? 8 : 0,
            margin: value === o.value ? 2 : 0,
            transition: "all 120ms ease",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        border: "none", cursor: "pointer", padding: 2,
        background: value ? "var(--accent)" : "var(--border-mid)",
        transition: "background 200ms ease",
        display: "flex", alignItems: "center",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "#fff",
        transform: value ? "translateX(18px)" : "translateX(0)",
        transition: "transform 200ms ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

// ─── Appearance card ──────────────────────────────────────────────────────────

const ACCENT_PRESETS = [
  { label: "Coral",   hex: "#e8603c" },
  { label: "Blue",    hex: "#3b82f6" },
  { label: "Violet",  hex: "#7c3aed" },
  { label: "Emerald", hex: "#10b981" },
  { label: "Amber",   hex: "#f59e0b" },
  { label: "Rose",    hex: "#f43f5e" },
  { label: "Sky",     hex: "#0ea5e9" },
  { label: "Slate",   hex: "#64748b" },
];

function AppearanceCard() {
  const [theme,        setThemeState]  = useState(() => ls("stride-theme",         "light"));
  const [accent,       setAccentState] = useState(() => ls("stride-accent",        "#e8603c"));
  const [font,         setFontState]   = useState(() => ls("stride-font",          "geist"));
  const [fontSize,     setFontSize]    = useState(() => ls("stride-font-size",     "14px"));
  const [sidebarWidth, setSidebarW]    = useState(() => ls("stride-sidebar-width", "220"));
  const [compact,      setCompact]     = useState(() => ls("stride-compact",       "false") === "true");
  const colorInputRef = useRef<HTMLInputElement>(null);

  const applyTheme = (t: string) => {
    setThemeState(t);
    void saveSettings("stride-theme", t);
    if (t === "dark")   { document.documentElement.classList.add("dark");    document.documentElement.classList.remove("light"); }
    if (t === "light")  { document.documentElement.classList.remove("dark"); document.documentElement.classList.add("light"); }
    if (t === "system") {
      const prefer = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefer);
    }
    document.documentElement.setAttribute("data-theme", t);
  };

  const applyAccent = (hex: string) => {
    setAccentState(hex);
    void saveSettings("stride-accent", hex);
    setCSSVar("--accent", hex);
  };

  const applyFont = (f: string) => {
    setFontState(f);
    void saveSettings("stride-font", f);
    const fontMap: Record<string, string> = {
      geist: "var(--font-geist-sans)",
      inter: "Inter, sans-serif",
      system: "system-ui, sans-serif",
      georgia: "Georgia, serif",
    };
    setCSSVar("--font-body", fontMap[f] ?? "var(--font-geist-sans)");
  };

  const applyFontSize = (sz: string) => {
    setFontSize(sz);
    void saveSettings("stride-font-size", sz);
    setCSSVar("--font-size-base", sz);
  };

  const applySidebarWidth = (w: string) => {
    setSidebarW(w);
    void saveSettings("stride-sidebar-width", w + "px");
    setCSSVar("--sidebar-width", w + "px");
  };

  const applyCompact = (v: boolean) => {
    setCompact(v);
    void saveSettings("stride-compact", String(v));
    document.documentElement.setAttribute("data-compact", String(v));
  };

  return (
    <SettingCard id="appearance" title="Appearance">
      <SettingRow label="Theme">
        <PillGroup
          options={[{ label: "Light", value: "light" }, { label: "Dark", value: "dark" }, { label: "System", value: "system" }]}
          value={theme}
          onChange={applyTheme}
        />
      </SettingRow>

      <SettingRow label="Accent color">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.label}
              onClick={() => applyAccent(p.hex)}
              style={{
                width: 22, height: 22, borderRadius: "50%",
                background: p.hex, border: "none", cursor: "pointer", padding: 0,
                outline: accent === p.hex ? `2px solid var(--fg)` : "2px solid transparent",
                outlineOffset: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "outline 120ms ease",
              }}
            >
              {accent === p.hex && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
          {/* Custom color picker */}
          <button
            type="button"
            title="Custom color"
            onClick={() => colorInputRef.current?.click()}
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)`,
              border: "2px solid var(--border-mid)", cursor: "pointer", padding: 0,
              flexShrink: 0,
            }}
          />
          <input
            ref={colorInputRef}
            type="color"
            value={accent}
            onChange={(e) => applyAccent(e.target.value)}
            style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
          />
        </div>
      </SettingRow>

      <SettingRow label="Font">
        <PillGroup
          options={[
            { label: "Geist",     value: "geist" },
            { label: "Inter",     value: "inter" },
            { label: "System UI", value: "system" },
            { label: "Georgia",   value: "georgia" },
          ]}
          value={font}
          onChange={applyFont}
        />
      </SettingRow>

      <SettingRow label="Font size">
        <PillGroup
          options={[{ label: "Small", value: "13px" }, { label: "Medium", value: "14px" }, { label: "Large", value: "16px" }]}
          value={fontSize}
          onChange={applyFontSize}
        />
      </SettingRow>

      <SettingRow label="Sidebar width" description={`${sidebarWidth}px`}>
        <input
          type="range"
          min={180} max={300} step={4}
          value={sidebarWidth}
          onChange={(e) => applySidebarWidth(e.target.value)}
          style={{ width: 120, accentColor: "var(--accent)" }}
        />
      </SettingRow>

      <SettingRow label="Compact mode" description="Tighter spacing throughout the app">
        <Toggle value={compact} onChange={applyCompact} />
      </SettingRow>
    </SettingCard>
  );
}

// ─── Navigation card ──────────────────────────────────────────────────────────

function SortableNavRow({ item, onToggle }: { item: NavItem; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 0", borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        {...attributes} {...listeners}
        style={{ cursor: "grab", color: "var(--fg-faint)", fontSize: 14, lineHeight: 1, touchAction: "none" }}
        title="Drag to reorder"
      >
        ⠿
      </div>
      <span style={{ flex: 1, fontSize: 13.5, color: item.visible ? "var(--fg)" : "var(--fg-faint)" }}>
        {item.label}
      </span>
      <Toggle value={item.visible} onChange={onToggle} />
    </div>
  );
}

function NavigationCard() {
  const [items, setItems] = useState<NavItem[]>(() => {
    if (typeof window === "undefined") return DEFAULT_NAV;
    try {
      const raw = localStorage.getItem("stride-nav-config");
      if (raw) return JSON.parse(raw) as NavItem[];
    } catch { /* */ }
    return DEFAULT_NAV;
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const saveItems = (next: NavItem[]) => {
    const ordered = next.map((it, i) => ({ ...it, order: i }));
    setItems(ordered);
    void saveSettings("stride-nav-config", JSON.stringify(ordered));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    saveItems(arrayMove(items, oldIdx, newIdx));
  };

  const toggleVisible = (id: string) => {
    const visible = items.filter((i) => i.visible);
    const target = items.find((i) => i.id === id);
    if (target?.visible && visible.length <= 1) return; // keep at least one
    saveItems(items.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)));
  };

  return (
    <SettingCard id="navigation" title="Navigation">
      <p style={{ fontSize: 12, color: "var(--fg-faint)", marginBottom: 12 }}>
        Drag to reorder. At least one item must stay visible.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableNavRow key={item.id} item={item} onToggle={() => toggleVisible(item.id)} />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={() => saveItems(DEFAULT_NAV)}
        style={{
          marginTop: 12, fontSize: 12, color: "var(--fg-faint)",
          background: "none", border: "1px solid var(--border)",
          borderRadius: 8, padding: "4px 12px", cursor: "pointer",
        }}
      >
        Reset to defaults
      </button>
    </SettingCard>
  );
}

// ─── Keyboard Shortcuts card ──────────────────────────────────────────────────

function ShortcutsCard() {
  const shortcuts        = useShortcutStore((s) => s.shortcuts);
  const setCustomBinding = useShortcutStore((s) => s.setCustomBinding);
  const resetAll         = useShortcutStore((s) => s.resetAll);
  const loadFromStorage  = useShortcutStore((s) => s.loadFromStorage);

  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [conflicts,  setConflicts] = useState<Set<string>>(new Set());

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  // Detect conflicts
  useEffect(() => {
    const seen = new Map<string, string>();
    const dups = new Set<string>();
    for (const s of shortcuts) {
      const key = s.customBinding ?? s.defaultBinding;
      if (seen.has(key)) {
        dups.add(key);
        dups.add(seen.get(key)!);
      }
      seen.set(key, s.action);
    }
    setConflicts(dups);
  }, [shortcuts]);

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") { setRecording(null); return; }
      const mod = e.metaKey || e.ctrlKey || e.altKey;
      if (!mod) return; // require modifier
      const combo = normalizeKey(e);
      setCustomBinding(recording, combo);
      setRecording(null);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [recording, setCustomBinding]);

  return (
    <SettingCard id="shortcuts" title="Keyboard Shortcuts">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 150px 28px", gap: "0 12px", marginBottom: 4 }}>
        {["Action", "Default", "Custom", ""].map((h) => (
          <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.07em", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
            {h}
          </div>
        ))}
      </div>
      {shortcuts.map((s) => {
        const active = s.customBinding ?? s.defaultBinding;
        const isConflict = conflicts.has(active) && s.customBinding;
        return (
          <div
            key={s.action}
            style={{ display: "grid", gridTemplateColumns: "1fr 100px 150px 28px", gap: "0 12px", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--border)" }}
          >
            <span style={{ fontSize: 13, color: "var(--fg)" }}>{s.label}</span>

            <kbd style={{
              fontSize: 11.5, padding: "2px 7px", borderRadius: 6,
              background: "var(--bg-subtle)", border: "1px solid var(--border-mid)",
              color: "var(--fg-muted)", fontFamily: "monospace",
            }}>
              {formatBinding(s.defaultBinding)}
            </kbd>

            <button
              type="button"
              onClick={() => setRecording(s.action)}
              style={{
                fontSize: 11.5, padding: "4px 10px", borderRadius: 8,
                border: `1px solid ${recording === s.action ? "var(--accent)" : isConflict ? "#ef4444" : "var(--border)"}`,
                background: recording === s.action ? "var(--accent-bg)" : "var(--bg-subtle)",
                color: recording === s.action ? "var(--accent)" : isConflict ? "#ef4444" : s.customBinding ? "var(--fg)" : "var(--fg-faint)",
                cursor: "pointer", textAlign: "left",
                fontFamily: s.customBinding || recording === s.action ? "monospace" : "inherit",
              }}
            >
              {recording === s.action ? "Press keys…" : s.customBinding ? formatBinding(s.customBinding) : "—"}
            </button>

            <button
              type="button"
              onClick={() => setCustomBinding(s.action, null)}
              title="Clear custom"
              style={{
                opacity: s.customBinding ? 1 : 0,
                pointerEvents: s.customBinding ? "auto" : "none",
                fontSize: 14, color: "var(--fg-faint)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      {conflicts.size > 0 && (
        <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
          ⚠ Conflicting shortcuts detected — only the first match will fire.
        </p>
      )}
      <button
        type="button"
        onClick={resetAll}
        style={{
          marginTop: 12, fontSize: 12, color: "var(--fg-faint)",
          background: "none", border: "1px solid var(--border)",
          borderRadius: 8, padding: "4px 12px", cursor: "pointer",
        }}
      >
        Reset all to defaults
      </button>
    </SettingCard>
  );
}

// ─── Daily Note card ──────────────────────────────────────────────────────────

function DailyNoteCard() {
  const [linked,       setLinked]       = useState(() => ls("stride-note-linked-mode", "true") === "true");
  const [noteFontSize, setNoteFontSize] = useState(() => ls("stride-note-font-size",   "14px"));
  const [showHeading,  setShowHeading]  = useState(() => ls("stride-note-show-heading","true") === "true");
  const [autoCreate,   setAutoCreate]   = useState(() => ls("stride-note-auto-create", "true") === "true");
  const [weekStart,    setWeekStart]    = useState(() => ls("stride-week-start",        "sunday"));

  return (
    <SettingCard id="daily-note" title="Daily Note">
      <SettingRow label="Link checklist to Task Manager" description="New checkboxes automatically create tasks">
        <Toggle value={linked} onChange={(v) => { setLinked(v); void saveSettings("stride-note-linked-mode", String(v)); }} />
      </SettingRow>
      <SettingRow label="Editor font size">
        <PillGroup
          options={[{ label: "Small", value: "13px" }, { label: "Medium", value: "14px" }, { label: "Large", value: "16px" }]}
          value={noteFontSize}
          onChange={(v) => { setNoteFontSize(v); void saveSettings("stride-note-font-size", v); setCSSVar("--note-font-size", v); }}
        />
      </SettingRow>
      <SettingRow label="Show date heading in note">
        <Toggle value={showHeading} onChange={(v) => { setShowHeading(v); void saveSettings("stride-note-show-heading", String(v)); }} />
      </SettingRow>
      <SettingRow label="Auto-create today's note on open">
        <Toggle value={autoCreate} onChange={(v) => { setAutoCreate(v); void saveSettings("stride-note-auto-create", String(v)); }} />
      </SettingRow>
      <SettingRow label="Start of week">
        <PillGroup
          options={[{ label: "Sunday", value: "sunday" }, { label: "Monday", value: "monday" }]}
          value={weekStart}
          onChange={(v) => { setWeekStart(v); void saveSettings("stride-week-start", v); }}
        />
      </SettingRow>
    </SettingCard>
  );
}

// ─── Tasks card ───────────────────────────────────────────────────────────────

function TasksCard() {
  const [tasksView,      setTasksView]      = useState(() => ls("stride-tasks-view",        "list"));
  const [showCompleted,  setShowCompleted]  = useState(() => ls("stride-show-completed",    "false") === "true");
  const [autoRollover,   setAutoRollover]   = useState(() => ls("stride-auto-rollover",     "true") === "true");
  const [defaultPriority,setDefaultPriority]= useState(() => ls("stride-default-priority",  "none"));
  const [nextWeekStart,  setNextWeekStart]  = useState(() => ls("stride-next-week-start",   "monday"));

  return (
    <SettingCard id="tasks" title="Tasks">
      <SettingRow label="Default task view">
        <PillGroup
          options={[{ label: "List", value: "list" }, { label: "Kanban", value: "kanban" }]}
          value={tasksView}
          onChange={(v) => { setTasksView(v); void saveSettings("stride-tasks-view", v); }}
        />
      </SettingRow>
      <SettingRow label="Show completed tasks by default">
        <Toggle value={showCompleted} onChange={(v) => { setShowCompleted(v); void saveSettings("stride-show-completed", String(v)); }} />
      </SettingRow>
      <SettingRow label="Auto-rollover overdue tasks" description="Moves past-due tasks to today on open">
        <Toggle value={autoRollover} onChange={(v) => { setAutoRollover(v); void saveSettings("stride-auto-rollover", String(v)); }} />
      </SettingRow>
      <SettingRow label="Default priority">
        <PillGroup
          options={[
            { label: "None",   value: "none"   },
            { label: "Low",    value: "low"    },
            { label: "Medium", value: "medium" },
            { label: "High",   value: "high"   },
          ]}
          value={defaultPriority}
          onChange={(v) => { setDefaultPriority(v); void saveSettings("stride-default-priority", v); }}
        />
      </SettingRow>
      <SettingRow label={'First day of \u201cNext Week\u201d'}>
        <PillGroup
          options={[{ label: "Monday", value: "monday" }, { label: "Sunday", value: "sunday" }]}
          value={nextWeekStart}
          onChange={(v) => { setNextWeekStart(v); void saveSettings("stride-next-week-start", v); }}
        />
      </SettingRow>
    </SettingCard>
  );
}

// ─── Calendar card ────────────────────────────────────────────────────────────

function CalendarCard() {
  const [calView,      setCalView]     = useState(() => ls("stride-calendar-view",       "week"));
  const [weekStart,    setWeekStart]   = useState(() => ls("stride-calendar-week-start", "sunday"));
  const [slotDur,      setSlotDur]     = useState(() => ls("stride-slot-duration",       "00:30:00"));
  const [calStart,     setCalStart]    = useState(() => ls("stride-calendar-start",      "06:00"));
  const [calEnd,       setCalEnd]      = useState(() => ls("stride-calendar-end",        "23:00"));
  const [showWeekends, setShowWeekends]= useState(() => ls("stride-show-weekends",       "true") === "true");
  const [timeFormat,   setTimeFormat]  = useState(() => ls("stride-time-format",         "12hr"));

  return (
    <SettingCard id="calendar" title="Calendar">
      <SettingRow label="Default view">
        <PillGroup
          options={[
            { label: "Day",    value: "1d"     },
            { label: "Week",   value: "week"   },
            { label: "Month",  value: "month"  },
            { label: "Agenda", value: "agenda" },
          ]}
          value={calView}
          onChange={(v) => { setCalView(v); void saveSettings("stride-calendar-view", v); }}
        />
      </SettingRow>
      <SettingRow label="Start of week">
        <PillGroup
          options={[{ label: "Sunday", value: "sunday" }, { label: "Monday", value: "monday" }]}
          value={weekStart}
          onChange={(v) => { setWeekStart(v); void saveSettings("stride-calendar-week-start", v); }}
        />
      </SettingRow>
      <SettingRow label="Slot duration">
        <PillGroup
          options={[
            { label: "15 min", value: "00:15:00" },
            { label: "30 min", value: "00:30:00" },
            { label: "1 hr",   value: "01:00:00" },
          ]}
          value={slotDur}
          onChange={(v) => { setSlotDur(v); void saveSettings("stride-slot-duration", v); }}
        />
      </SettingRow>
      <SettingRow label="Calendar start time">
        <input
          type="time"
          value={calStart}
          onChange={(e) => { setCalStart(e.target.value); void saveSettings("stride-calendar-start", e.target.value); }}
          style={{
            fontSize: 13, padding: "4px 8px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-subtle)",
            color: "var(--fg)", outline: "none",
          }}
        />
      </SettingRow>
      <SettingRow label="Calendar end time">
        <input
          type="time"
          value={calEnd}
          onChange={(e) => { setCalEnd(e.target.value); void saveSettings("stride-calendar-end", e.target.value); }}
          style={{
            fontSize: 13, padding: "4px 8px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-subtle)",
            color: "var(--fg)", outline: "none",
          }}
        />
      </SettingRow>
      <SettingRow label="Show weekends">
        <Toggle value={showWeekends} onChange={(v) => { setShowWeekends(v); void saveSettings("stride-show-weekends", String(v)); }} />
      </SettingRow>
      <SettingRow label="Time format">
        <PillGroup
          options={[{ label: "12-hour", value: "12hr" }, { label: "24-hour", value: "24hr" }]}
          value={timeFormat}
          onChange={(v) => { setTimeFormat(v); void saveSettings("stride-time-format", v); }}
        />
      </SettingRow>
    </SettingCard>
  );
}

// ─── General card ─────────────────────────────────────────────────────────────

function GeneralCard() {
  const [appName,      setAppName]     = useState(() => ls("stride-app-name", "Stride"));
  const [confirmText,  setConfirmText] = useState("");
  const [importStatus, setImportStatus]= useState<"idle" | "ok" | "err">("idle");

  const applyAppName = (name: string) => {
    setAppName(name);
    void saveSettings("stride-app-name", name);
    document.title = name;
  };

  const exportData = async () => {
    const { db } = await import("@/db/index");
    const data = {
      tasks:            await db.tasks.toArray(),
      sections:         await db.sections.toArray(),
      timeBlocks:       await db.timeBlocks.toArray(),
      dailyNotes:       await db.dailyNotes.toArray(),
      documents:        await db.documents.toArray(),
      projects:         await db.projects.toArray(),
      routineTemplates: await db.routineTemplates.toArray(),
      taskSubsections:  await db.taskSubsections.toArray(),
      deletedSections:  await db.deletedSections.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `stride-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Record<string, unknown[]>;
        if (!window.confirm("Import data? This will add to your existing data, not replace it.")) return;
        const { db } = await import("@/db/index");
        if (data.tasks?.length)            await db.tasks.bulkPut(data.tasks as any);
        if (data.sections?.length)         await db.sections.bulkPut(data.sections as any);
        if (data.timeBlocks?.length)       await db.timeBlocks.bulkPut(data.timeBlocks as any);
        if (data.dailyNotes?.length)       await db.dailyNotes.bulkPut(data.dailyNotes as any);
        if (data.documents?.length)        await db.documents.bulkPut(data.documents as any);
        if (data.projects?.length)         await db.projects.bulkPut(data.projects as any);
        if (data.routineTemplates?.length) await db.routineTemplates.bulkPut(data.routineTemplates as any);
        if (data.taskSubsections?.length)  await db.taskSubsections.bulkPut(data.taskSubsections as any);
        if (data.deletedSections?.length)  await db.deletedSections.bulkPut(data.deletedSections as any);
        setImportStatus("ok");
        setTimeout(() => setImportStatus("idle"), 3000);
      } catch {
        setImportStatus("err");
        setTimeout(() => setImportStatus("idle"), 4000);
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = async () => {
    if (confirmText.trim() !== "delete my data") {
      alert('Please type "delete my data" to confirm.');
      return;
    }
    const { Dexie } = await import("dexie");
    await Dexie.delete("StrideDB");
    window.location.reload();
  };

  return (
    <SettingCard id="general" title="General">
      <SettingRow label="App name">
        <input
          value={appName}
          onChange={(e) => applyAppName(e.target.value)}
          style={{
            fontSize: 13, padding: "5px 10px", borderRadius: 8, width: 160,
            border: "1px solid var(--border)", background: "var(--bg-subtle)",
            color: "var(--fg)", outline: "none",
          }}
        />
      </SettingRow>

      <SettingRow label="Export all data" description="Downloads a JSON file with all your data">
        <button
          type="button"
          onClick={() => void exportData()}
          style={{
            fontSize: 12.5, padding: "5px 14px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-subtle)",
            color: "var(--fg-muted)", cursor: "pointer",
          }}
        >
          Export JSON
        </button>
      </SettingRow>

      <SettingRow label="Import data" description="Merges a JSON backup into your current data">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{
            fontSize: 12.5, padding: "5px 14px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-subtle)",
            color: "var(--fg-muted)", cursor: "pointer",
          }}>
            Choose file
            <input
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }}
            />
          </label>
          {importStatus === "ok"  && <span style={{ fontSize: 12, color: "var(--accent)" }}>✓ Imported</span>}
          {importStatus === "err" && <span style={{ fontSize: 12, color: "#ef4444" }}>✗ Invalid file</span>}
        </div>
      </SettingRow>

      <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "#ef4444", marginBottom: 8 }}>Danger zone</div>
        <p style={{ fontSize: 12.5, color: "var(--fg-faint)", marginBottom: 10 }}>
          Type <kbd style={{ fontFamily: "monospace", fontSize: 11, padding: "1px 5px", borderRadius: 4, background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>delete my data</kbd> then click Clear.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete my data"
            style={{
              fontSize: 13, padding: "5px 10px", borderRadius: 8, flex: 1, maxWidth: 200,
              border: "1px solid #fca5a5", background: "var(--bg-subtle)",
              color: "var(--fg)", outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => void clearAllData()}
            disabled={confirmText.trim() !== "delete my data"}
            style={{
              fontSize: 12.5, padding: "5px 14px", borderRadius: 8,
              border: "1px solid #ef4444",
              background: confirmText.trim() === "delete my data" ? "#ef4444" : "var(--bg-subtle)",
              color: confirmText.trim() === "delete my data" ? "#fff" : "#fca5a5",
              cursor: confirmText.trim() === "delete my data" ? "pointer" : "not-allowed",
              transition: "all 200ms ease",
            }}
          >
            Clear all data
          </button>
        </div>
      </div>

      <div style={{ paddingTop: 16, fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, color: "var(--fg-muted)", marginBottom: 4 }}>About Stride</div>
        <div>Version 0.1.0</div>
        <div>Built with Next.js 15, TipTap 3, FullCalendar 6, Dexie 4, Zustand 5, @dnd-kit</div>
        <div style={{ marginTop: 4 }}>All data is stored locally in IndexedDB — nothing is sent to a server.</div>
      </div>
    </SettingCard>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "appearance",  label: "Appearance"         },
  { id: "navigation",  label: "Navigation"         },
  { id: "shortcuts",   label: "Keyboard Shortcuts" },
  { id: "daily-note",  label: "Daily Note"         },
  { id: "tasks",       label: "Tasks"              },
  { id: "calendar",    label: "Calendar"           },
  { id: "general",     label: "General"            },
];

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [active,  setActive]  = useState("appearance");

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div style={{ height: "100vh" }} />;

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── Left category sidebar ── */}
      <div style={{
        width: 200, flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--bg-sidebar)",
        display: "flex", flexDirection: "column",
        padding: "24px 0",
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.09em", padding: "0 16px 12px" }}>
          Settings
        </div>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => scrollTo(cat.id)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "7px 16px",
              fontSize: 13.5, fontWeight: active === cat.id ? 600 : 400,
              color: active === cat.id ? "var(--accent)" : "var(--fg-muted)",
              background: active === cat.id ? "var(--bg-active)" : "transparent",
              border: "none", cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Right scrollable content ── */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}
        onScroll={(e) => {
          // Update active category based on scroll position
          const container = e.currentTarget;
          for (const cat of [...CATEGORIES].reverse()) {
            const el = document.getElementById(cat.id);
            if (el && el.getBoundingClientRect().top <= container.getBoundingClientRect().top + 80) {
              setActive(cat.id);
              break;
            }
          }
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 300, color: "var(--fg)", marginBottom: 32, letterSpacing: "-0.02em" }}>
          Settings
        </h1>

        <AppearanceCard />
        <NavigationCard />
        <ShortcutsCard />
        <DailyNoteCard />
        <TasksCard />
        <CalendarCard />
        <GeneralCard />
      </div>
    </div>
  );
}
