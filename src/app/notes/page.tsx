"use client";

import { useEffect, useRef, useState } from "react";
import { DailyNote } from "@/components/DailyNote";
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

function formatNoteDate(date: string, today: string): string {
  const d = new Date(date + "T00:00:00");
  const dayStr = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
  }).format(d);
  const diff = Math.round(
    (new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000,
  );
  if (diff === 0)  return `Today, ${dayStr}`;
  if (diff === -1) return `Yesterday, ${dayStr}`;
  if (diff === 1)  return `Tomorrow, ${dayStr}`;
  return dayStr;
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
  const dailyNoteMoveRef = useRef<((title: string, taskId: string | null, targetDate: string) => Promise<void>) | null>(null);

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

  const handleBlockDrop = (blockType: "task" | "note", title: string, taskId: string | null, date: string) => {
    if (!title) return;
    // handleMoveItem handles both the note content move AND dueDate update internally
    void dailyNoteMoveRef.current?.(title, taskId, date);
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

  const dateNav = (
    <div style={{ flexShrink: 0, padding: "20px 40px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, paddingBottom: 16 }}>
        <ChevronBtn dir="prev" label="Previous day" onClick={() => setSelectedDate(prev => shiftDate(prev, -1))} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 210, justifyContent: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 500, textAlign: "center", color: isOffToday ? "var(--fg-muted)" : "var(--fg)", userSelect: "none" }}>
            {formatNoteDate(selectedDate, today)}
          </span>
          {isOffToday && (
            <button type="button" onClick={() => setSelectedDate(today)} title="Return to today"
              style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "var(--accent)", border: "none", cursor: "pointer", padding: 0 }} />
          )}
        </div>
        <ChevronBtn dir="next" label="Next day" onClick={() => setSelectedDate(prev => shiftDate(prev, 1))} />
      </div>
      <div style={{ height: 1, background: "var(--border)" }} />
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
            paddingBottom: calendarOpen ? 0 : "calc(56px + env(safe-area-inset-bottom))",
          }}>
            <DailyNote selectedDate={selectedDate} onDateChange={setSelectedDate} hideHeader moveItemRef={dailyNoteMoveRef} />
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
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── Page header ── */}
      <div style={{
        flexShrink: 0, height: 44,
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "0 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        {calendarToggleBtn}
      </div>

      {/* ── Content row ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Note editor zone */}
        <div style={{ flex: 1, padding: 16, display: "flex", overflow: "hidden", minWidth: 0 }}>
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            {dateNav}
            {/* Editor body */}
            <div style={{ flex: 1, overflow: "auto" }}>
              <DailyNote selectedDate={selectedDate} onDateChange={setSelectedDate} hideHeader moveItemRef={dailyNoteMoveRef} />
            </div>
          </div>
        </div>

        {/* Mini calendar panel — collapses to width 0 when closed */}
        <div style={{
          flexShrink: 0,
          width: calendarOpen ? 296 : 0,
          opacity: calendarOpen ? 1 : 0,
          overflow: "hidden",
          transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease",
        }}>
          {/* Inner is fixed 296px so it doesn't reflow as width animates */}
          <div style={{ width: 296, height: "100%", padding: "16px 16px 16px 0" }}>
            <div style={{
              width: 280, height: "100%", overflow: "auto",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <MiniCalendar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                dailyNotes={dailyNotes}
                onTaskDrop={handleTaskDrop}
                onBlockDrop={handleBlockDrop}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}