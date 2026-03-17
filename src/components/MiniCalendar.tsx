"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DailyNote } from "@/types/index";

// ─── helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS  = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(s: string): Date {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function hasRealContent(contentJson: string): boolean {
  try {
    const doc = JSON.parse(contentJson) as { content?: { content?: { text?: string }[] }[] };
    const text = (doc?.content ?? [])
      .map(n => (n?.content ?? []).map(c => c?.text ?? "").join(""))
      .join("")
      .trim();
    return text.length > 0;
  } catch {
    return false;
  }
}

type Cell = { date: string; day: number; overflow: boolean };

// ─── MonthNavBtn ──────────────────────────────────────────────────────────────

function MonthNavBtn({ onClick, dir }: { onClick: () => void; dir: "prev" | "next" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 7, border: "none",
        background: "transparent", cursor: "pointer",
        fontSize: 18, lineHeight: 1, color: "var(--fg-faint)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 120ms ease, color 120ms ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--fg)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-faint)"; }}
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}

// ─── MiniCalendar ─────────────────────────────────────────────────────────────

export function MiniCalendar({
  selectedDate,
  onDateChange,
  dailyNotes,
  onTaskDrop,
}: {
  selectedDate: string;
  onDateChange: (date: string) => void;
  dailyNotes: DailyNote[];
  onTaskDrop?: (taskId: string, taskTitle: string, date: string) => void;
}) {
  const today = useMemo(() => localDateString(new Date()), []);

  const initParsed              = parseLocalDate(selectedDate);
  const [viewYear, setViewYear] = useState(initParsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(initParsed.getMonth());
  const [hovered, setHovered]   = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // When selectedDate changes via editor chevrons, navigate to that month
  useEffect(() => {
    const d = parseLocalDate(selectedDate);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [selectedDate]);

  // Dates that have real note content → show dot
  const noteDates = useMemo(() => {
    const s = new Set<string>();
    for (const note of dailyNotes) {
      if (note.content && hasRealContent(note.content)) s.add(note.date);
    }
    return s;
  }, [dailyNotes]);

  // 42-cell grid (6 rows × 7 cols)
  const cells = useMemo((): Cell[] => {
    const firstDow       = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthTotal = new Date(viewYear, viewMonth, 0).getDate();
    const result: Cell[] = [];

    for (let i = firstDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthTotal - i);
      result.push({ date: localDateString(d), day: prevMonthTotal - i, overflow: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ date: localDateString(new Date(viewYear, viewMonth, d)), day: d, overflow: false });
    }
    for (let d = 1; result.length < 42; d++) {
      result.push({ date: localDateString(new Date(viewYear, viewMonth + 1, d)), day: d, overflow: true });
    }
    return result;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const handleDragOver = useCallback((e: React.DragEvent, date: string) => {
    if (!onTaskDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(date);
  }, [onTaskDrop]);

  const handleDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, date: string) => {
    if (!onTaskDrop) return;
    e.preventDefault();
    setDragOver(null);
    const taskId    = e.dataTransfer.getData("stride/taskId")    ?? "";
    const taskTitle = e.dataTransfer.getData("stride/taskTitle") ?? e.dataTransfer.getData("text/plain") ?? "";
    if (taskTitle) onTaskDrop(taskId, taskTitle, date);
  }, [onTaskDrop]);

  const goToToday = () => {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    onDateChange(today);
  };

  return (
    <div style={{ padding: "16px 14px", userSelect: "none" }}>
      {/* Month / year header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <MonthNavBtn onClick={prevMonth} dir="prev" />
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={goToToday}
            style={{
              fontSize: 10, fontWeight: 500, lineHeight: 1,
              padding: "2px 7px", borderRadius: 5, cursor: "pointer",
              background: "var(--accent-bg)", color: "var(--accent)",
              border: "1px solid var(--accent-bg-strong)",
            }}
          >
            Today
          </button>
        </div>
        <MonthNavBtn onClick={nextMonth} dir="next" />
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
        {DAY_LABELS.map(l => (
          <div key={l} style={{
            textAlign: "center", fontSize: 9, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.06em",
            color: "var(--fg-faint)", padding: "4px 0",
          }}>
            {l}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 1 }}>
        {cells.map(({ date, day, overflow }) => {
          const isToday    = date === today;
          const isSelected = date === selectedDate;
          const hasContent = !overflow && noteDates.has(date);
          const isHovered  = hovered === date && !isToday;
          const isDragOver = dragOver === date && !overflow;

          const bg = isDragOver
            ? "color-mix(in srgb, var(--accent) 15%, transparent)"
            : isToday
            ? "var(--accent)"
            : isHovered
            ? "var(--bg-hover)"
            : "transparent";

          const fg = isToday ? "white" : isSelected ? "var(--accent)" : "var(--fg)";

          const borderStyle = isDragOver
            ? "1.5px solid var(--accent)"
            : isSelected && !isToday
            ? "1.5px solid var(--accent)"
            : "1.5px solid transparent";

          return (
            <div
              key={date}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              onDragOver={(e) => handleDragOver(e, date)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, date)}
            >
              <button
                type="button"
                onClick={() => onDateChange(date)}
                onMouseEnter={() => setHovered(date)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: "relative",
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: borderStyle,
                  background: bg,
                  color: fg,
                  fontSize: 12,
                  fontWeight: isToday || isSelected ? 600 : 400,
                  opacity: overflow ? 0.3 : 1,
                  cursor: "pointer",
                  lineHeight: 1,
                  transition: "background 100ms ease, border-color 100ms ease",
                }}
              >
                {day}
                {hasContent && (
                  <span style={{
                    position: "absolute", bottom: 4,
                    width: 4, height: 4, borderRadius: "50%",
                    background: isToday ? "rgba(255,255,255,0.75)" : "var(--accent)",
                  }} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
