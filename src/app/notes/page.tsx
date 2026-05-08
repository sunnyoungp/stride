"use client";

import { useEffect, useRef, useState } from "react";
import { DailyNote, type MoveItemFn, type MoveItemsFn } from "@/components/DailyNote";
import type { JSONContent } from "@tiptap/core";
import { MiniCalendar } from "@/components/MiniCalendar";
import { useDailyNoteStore } from "@/store/dailyNoteStore";
import { useTaskStore } from "@/store/taskStore";
import { useIsMobile } from "@/hooks/useIsMobile";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

function getDateTitle(date: string, today: string): { label: string; accent: boolean } {
  const diff = Math.round(
    (new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000,
  );
  if (diff === 0)  return { label: "Today", accent: true };
  if (diff === -1) return { label: "Yesterday", accent: true };
  if (diff === 1)  return { label: "Tomorrow", accent: true };
  const d = new Date(date + "T00:00:00");
  return {
    label: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(d),
    accent: false,
  };
}

function getDateTitleSuffix(date: string, today: string): string {
  const diff = Math.round(
    (new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000,
  );
  if (diff < -1 || diff > 1) return "";
  const d = new Date(date + "T00:00:00");
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(d);
}

function getDateSubtitle(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(date + "T00:00:00")
  );
}

// ─── Chevron button ───────────────────────────────────────────────────────────

function ChevronBtn({ dir, onClick, label }: { dir: "prev" | "next"; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        fontSize: 20, lineHeight: 1,
        color: "var(--fg-faint)", cursor: "pointer",
        border: "none", background: "transparent",
        padding: "4px 8px", borderRadius: 6,
        transition: "color 120ms ease, background 120ms ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.color = "var(--fg)"; e.currentTarget.style.background = "var(--bg-hover)"; }}
      onMouseLeave={e => { e.currentTarget.style.color = "var(--fg-faint)"; e.currentTarget.style.background = "transparent"; }}
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}

// ─── Calendar icon ────────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="4.5" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
      <rect x="9.1" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
      <line x1="1" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="5"   cy="9.5" r="1" fill="currentColor" opacity=".6"/>
      <circle cx="7.5" cy="9.5" r="1" fill="currentColor" opacity=".6"/>
      <circle cx="10"  cy="9.5" r="1" fill="currentColor" opacity=".6"/>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  const [today] = useState(() => localDateString(new Date()));

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window === "undefined") return localDateString(new Date());
    // When auto-create is on, always open on today
    if (localStorage.getItem("stride-note-auto-create") !== "false") {
      return localDateString(new Date());
    }
    const saved = localStorage.getItem("stride-notes-selected-date");
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
    return localDateString(new Date());
  });

  const [calendarOpen, setCalendarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("stride-notes-calendar-open") === "true";
  });

  const dailyNotes     = useDailyNoteStore(s => s.dailyNotes);
  const loadDailyNotes = useDailyNoteStore(s => s.loadDailyNotes);

  const updateTask = useTaskStore(s => s.updateTask);
  const createTask = useTaskStore(s => s.createTask);
  const tasks      = useTaskStore(s => s.tasks);

  // Ref to DailyNote's internal handleMoveItem so MiniCalendar drops can trigger it
  const dailyNoteMoveRef = useRef<MoveItemFn | null>(null);
  const dailyNoteMoveItemsRef = useRef<MoveItemsFn | null>(null);

  const handleTaskDrop = (taskId: string, taskTitle: string, date: string) => {
    if (taskId) {
      void updateTask(taskId, { dueDate: date });
    } else {
      // No linked task — create one with the given due date
      const existing = tasks.find(t => t.title.trim() === taskTitle.trim());
      if (existing) {
        void updateTask(existing.id, { dueDate: date });
      } else {
        void createTask({ title: taskTitle, status: "todo", dueDate: date });
      }
    }
  };

  const handleBlockDrop = (blockType: "task" | "note", title: string, taskId: string | null, date: string, json?: unknown) => {
    if (!title) return;
    void dailyNoteMoveRef.current?.(title, taskId, date, (json as JSONContent) ?? null);
  };

  const handleMultiBlockDrop = (blocks: Array<{ title: string; taskId: string | null; json?: unknown; pos?: number }>, date: string) => {
    if (blocks.length === 0) return;
    void dailyNoteMoveItemsRef.current?.(
      blocks.map(b => ({ title: b.title, taskId: b.taskId, json: (b.json as JSONContent) ?? null, pos: b.pos })),
      date
    );
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { void loadDailyNotes(); }, [loadDailyNotes]);
  useEffect(() => { localStorage.setItem("stride-notes-selected-date", selectedDate); }, [selectedDate]);
  useEffect(() => { localStorage.setItem("stride-notes-calendar-open", String(calendarOpen)); }, [calendarOpen]);

  if (!mounted) return <div style={{ height: "100vh" }} />;

  const isOffToday = selectedDate !== today;

  const calendarToggleBtn = (
    <button
      type="button"
      onClick={() => setCalendarOpen(v => !v)}
      title="Toggle calendar"
      style={{
        width: 32, height: 32, borderRadius: 8, border: "none",
        background: calendarOpen ? "var(--accent-bg)" : "transparent",
        color: calendarOpen ? "var(--accent)" : "var(--fg-faint)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 150ms ease, color 150ms ease",
      }}
      onMouseEnter={e => { if (!calendarOpen) { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--fg-muted)"; } }}
      onMouseLeave={e => { if (!calendarOpen) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-faint)"; } }}
    >
      <CalendarIcon />
    </button>
  );

  const titleInfo = getDateTitle(selectedDate, today);
  const titleSuffix = getDateTitleSuffix(selectedDate, today);

  const dateNav = (
    <div style={{ flexShrink: 0, padding: "24px 20px 16px" }}>
      {/* Line 1: Large title */}
      <div style={{ textAlign: "center", marginBottom: 6, userSelect: "none" }}>
        <span style={{
          fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em",
          color: titleInfo.accent ? "var(--accent)" : "var(--fg)",
        }}>
          {titleInfo.label}
        </span>
        {titleSuffix && (
          <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", color: "var(--fg)" }}>
            {", "}{titleSuffix}
          </span>
        )}
      </div>
      {/* Line 2: Subtitle with arrows */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <ChevronBtn dir="prev" label="Previous day" onClick={() => setSelectedDate(prev => shiftDate(prev, -1))} />
        <span style={{ fontSize: 14, fontWeight: 400, color: "var(--fg-muted)", userSelect: "none" }}>
          {getDateSubtitle(selectedDate)}
        </span>
        {isOffToday && (
          <button type="button" onClick={() => setSelectedDate(today)} title="Return to today"
            style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "var(--accent)", border: "none", cursor: "pointer", padding: 0 }} />
        )}
        <ChevronBtn dir="next" label="Next day" onClick={() => setSelectedDate(prev => shiftDate(prev, 1))} />
        {!isMobile && calendarToggleBtn}
      </div>
    </div>
  );

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg)" }}>
        {/* Header */}
        <div style={{ flexShrink: 0, height: 44, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 16px", borderBottom: "1px solid var(--border)" }}>
          {calendarToggleBtn}
        </div>

        {/* Editor — scrollable above the calendar sheet */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-card)" }}>
          {dateNav}
          <div style={{
            flex: 1, overflow: "auto",
            paddingBottom: calendarOpen ? 0 : "calc(var(--tab-bar-h) + env(safe-area-inset-bottom))",
          }}>
            <DailyNote selectedDate={selectedDate} onDateChange={setSelectedDate} moveItemRef={dailyNoteMoveRef} moveItemsRef={dailyNoteMoveItemsRef} isMobile={isMobile} />
          </div>
        </div>

        {/* Persistent bottom sheet calendar */}
        {calendarOpen && (
          <div style={{
            flexShrink: 0,
            height: "42vh",
            background: "var(--bg-card)",
            borderTop: "1px solid var(--border-mid)",
            overflowY: "auto",
            paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
            position: "relative",
            zIndex: 60, 
            boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
          }}>
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: "var(--border-strong)" }} />
            </div>
            <MiniCalendar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              dailyNotes={dailyNotes}
              onTaskDrop={handleTaskDrop}
              onBlockDrop={handleBlockDrop}
              onMultiBlockDrop={handleMultiBlockDrop}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", padding: 16, gap: 0 }}>

      {/* ── Note editor ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
        borderRight: calendarOpen ? "0px solid var(--border)" : undefined,
      }}>
        {dateNav}
        <div style={{ flex: 1, overflow: "auto" }}>
          <DailyNote selectedDate={selectedDate} onDateChange={setSelectedDate} moveItemRef={dailyNoteMoveRef} moveItemsRef={dailyNoteMoveItemsRef} isMobile={isMobile} />
        </div>
      </div>

      {/* ── Mini calendar — flush against editor ── */}
      <div style={{
        flexShrink: 0,
        width: calendarOpen ? 280 : 0,
        opacity: calendarOpen ? 1 : 0,
        overflow: "hidden",
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease",
      }}>
        {/* Fixed-width inner so content doesn't reflow as width animates */}
        <div style={{
          width: 280,
          height: "100%",
          overflow: "auto",
          background: "var(--bg-card)",
          backdropFilter: "var(--glass-blur-card)",
          WebkitBackdropFilter: "var(--glass-blur-card)",
          border: "1px solid var(--glass-border)",
          borderTop: "1px solid var(--glass-border-top)",
          borderRadius: 16,
          boxShadow: "var(--glass-shadow-card)",
        }}>
          <MiniCalendar
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            dailyNotes={dailyNotes}
            onTaskDrop={handleTaskDrop}
            onBlockDrop={handleBlockDrop}
            onMultiBlockDrop={handleMultiBlockDrop}
          />
        </div>
      </div>

    </div>
  );
}