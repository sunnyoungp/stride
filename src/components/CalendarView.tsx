"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  Draggable, type EventReceiveArg,
} from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useIsMobile } from "@/hooks/useIsMobile";
import { RoutineTemplatePanel } from "@/components/RoutineTemplatePanel";
import { RoutineTemplateStrip } from "@/components/RoutineTemplateStrip";
import { useRoutineTemplateStore } from "@/store/routineTemplateStore";
import { TimeBlockContextMenu } from "@/components/TimeBlockContextMenu";
import { TimeBlockPopover } from "@/components/TimeBlockPopover";
import { useDailyNoteStore } from "@/store/dailyNoteStore";
import { useTaskStore } from "@/store/taskStore";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import type { DailyNote, RoutineTemplate, Task, TimeBlock } from "@/types/index";

type ViewKey = "1d" | "2d" | "3d" | "4d" | "week" | "month" | "agenda";

/** Convert a hex color to rgba */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function addMins(iso: string, m: number) {
  const d = new Date(iso); d.setMinutes(d.getMinutes() + m); return d.toISOString();
}

function viewConfig(v: ViewKey): { type: string; duration?: { days?: number; weeks?: number } } {
  switch (v) {
    case "1d": return { type: "timeGridDay" };
    case "2d": return { type: "timeGrid", duration: { days: 2 } };
    case "3d": return { type: "timeGrid", duration: { days: 3 } };
    case "4d": return { type: "timeGrid", duration: { days: 4 } };
    // "week" uses a sliding 7-day window so trackpad can shift by 1 day at a time
    case "week": return { type: "timeGrid", duration: { days: 7 } };
    // "month" uses a 5-week grid so vertical trackpad shifts by 1 week at a time
    case "month": return { type: "dayGrid", duration: { weeks: 5 } };
    default: return { type: "timeGridDay" };
  }
}

/** Returns the Sunday of the week containing d */
function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

/** Default anchor date for a view — today-first, week-aligned for week/month */
function defaultStart(v: ViewKey): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (v === "week" || v === "month") ? startOfWeek(today) : today;
}

/** Default color for new time blocks — warm coral accent */
const DEFAULT_BLOCK_COLOR = "#f4714a";
const PRESET_COLORS = ["#f4714a", "#6c7ce7", "#4ecdc4", "#45b7d1", "#96ceb4", "#e8a0bf"];

type PendingBlock = { startTime: string; endTime: string; x: number; y: number };

// ─── Agenda helpers ───────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function extractPlainText(contentJson: string): string {
  try {
    const doc = JSON.parse(contentJson) as { type?: string; text?: string; content?: unknown[] };
    const walk = (node: { type?: string; text?: string; content?: unknown[] }): string => {
      if (node.type === "text") return node.text ?? "";
      return ((node.content ?? []) as { type?: string; text?: string; content?: unknown[] }[]).map(walk).join("");
    };
    return walk(doc).trim();
  } catch { return ""; }
}

function fmtTime12(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}${m > 0 ? `:${String(m).padStart(2, "0")}` : ""} ${period}`;
}

// ─── Toggle pill ──────────────────────────────────────────────────────────────

function TogglePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 10.5, fontWeight: 500,
        padding: "3px 9px", borderRadius: 9999,
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent-bg)" : "transparent",
        color: active ? "var(--accent)" : "var(--fg-faint)",
        cursor: "pointer",
        transition: "all 150ms ease",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

// ─── AgendaDayCard ────────────────────────────────────────────────────────────

function AgendaDayCard({
  date,
  todayStr,
  timeBlocks,
  tasks,
  dailyNotes,
  showBlocks,
  showTasks,
  showNotes,
  pulse,
  cardRef,
}: {
  date: string;
  todayStr: string;
  timeBlocks: TimeBlock[];
  tasks: Task[];
  dailyNotes: DailyNote[];
  showBlocks: boolean;
  showTasks: boolean;
  showNotes: boolean;
  pulse: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const router = useRouter();
  const d = new Date(date + "T00:00:00");
  const isToday = date === todayStr;

  const dayNum = d.getDate();
  const monthStr = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
  const weekdayStr = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);

  const dayBlocks = useMemo(
    () => timeBlocks.filter(b => b.startTime.startsWith(date)).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [timeBlocks, date],
  );
  const dayTasks = useMemo(
    () => tasks.filter(t => t.dueDate === date && t.status !== "done" && t.status !== "cancelled"),
    [tasks, date],
  );

  const dayNote = dailyNotes.find(n => n.date === date);
  const noteText = dayNote ? extractPlainText(dayNote.content) : "";
  const firstLine = noteText.split("\n")[0]?.slice(0, 100) ?? "";

  const hasVisible =
    (showBlocks && dayBlocks.length > 0) ||
    (showTasks && dayTasks.length > 0) ||
    showNotes;

  return (
    <div
      ref={cardRef}
      style={{
        display: "flex",
        borderRadius: 12,
        border: `1px solid ${pulse ? "var(--accent)" : "var(--border)"}`,
        marginBottom: 8,
        overflow: "hidden",
        transition: "border-color 400ms ease",
        animation: pulse ? "agenda-pulse 1200ms ease" : undefined,
        flexShrink: 0,
      }}
    >
      {/* Left section */}
      <div style={{
        width: 90, flexShrink: 0,
        padding: "14px 10px",
        background: isToday ? "rgba(232,96,60,0.08)" : "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 2,
      }}>
        <div style={{ fontSize: 28, fontWeight: 300, lineHeight: 1, color: isToday ? "var(--accent)" : "var(--fg)" }}>
          {dayNum}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-faint)", lineHeight: 1.5 }}>{monthStr}</div>
        {isToday
          ? <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", lineHeight: 1.4 }}>Today</div>
          : <div style={{ fontSize: 11, color: "var(--fg-faint)", lineHeight: 1.4 }}>{weekdayStr}</div>
        }
      </div>

      {/* Right section */}
      <div style={{
        flex: 1, minWidth: 0,
        background: "var(--bg)",
        padding: "10px 14px",
        display: "flex", flexDirection: "column", gap: 5,
        justifyContent: "center",
      }}>
        {/* Time blocks */}
        {showBlocks && dayBlocks.map(block => (
          <div key={block.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 3, height: 16, borderRadius: 2,
              background: block.color ?? DEFAULT_BLOCK_COLOR,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12.5, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ color: block.color ?? DEFAULT_BLOCK_COLOR, fontWeight: 500 }}>
                {fmtTime12(block.startTime)}
              </span>
              {" · "}{block.title}
            </span>
          </div>
        ))}

        {/* Tasks */}
        {showTasks && dayTasks.map(task => (
          <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: "var(--fg-faint)" }}>
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span style={{ fontSize: 12.5, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {task.title || "(Untitled)"}
            </span>
          </div>
        ))}

        {/* Daily note */}
        {showNotes && (
          firstLine
            ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11.5 }}>📝</span>
                <span style={{ fontSize: 12, color: "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {firstLine}
                </span>
              </div>
            )
            : (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("stride-notes-selected-date", date);
                  }
                  void router.push("/notes");
                }}
                style={{
                  fontSize: 11.5, color: "var(--fg-faint)", background: "none",
                  border: "none", padding: 0, cursor: "pointer", textAlign: "left",
                  opacity: 0.55, transition: "opacity 150ms ease, color 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--fg-muted)"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "0.55"; e.currentTarget.style.color = "var(--fg-faint)"; }}
              >
                Write a note…
              </button>
            )
        )}

        {/* Nothing scheduled */}
        {!hasVisible && (
          <span style={{ fontSize: 12, color: "var(--fg-faint)", fontStyle: "italic" }}>Nothing scheduled</span>
        )}
      </div>
    </div>
  );
}

// ─── New Event Modal (full-featured) ─────────────────────────────────────────

type EventFormData = {
  title: string;
  color: string;
  allDay: boolean;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  date: string;      // "YYYY-MM-DD"
  repeat: "none" | "daily" | "weekly" | "monthly";
  location: string;
  description: string;
};

function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
}

function fmtDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(y ?? 2024, (m ?? 1) - 1, d ?? 1)
  );
}

function NewEventModal({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingBlock;
  onConfirm: (data: { title: string; color: string; allDay: boolean }) => void;
  onCancel: () => void;
}) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [form, setForm] = useState<EventFormData>({
    title: "",
    color: DEFAULT_BLOCK_COLOR,
    allDay: false,
    startTime: toTimeInput(pending.startTime),
    endTime: toTimeInput(pending.endTime),
    date: toDateInput(pending.startTime),
    repeat: "none",
    location: "",
    description: "",
  });

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 60); }, []);

  const set = <K extends keyof EventFormData>(key: K, val: EventFormData[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const durMins = calcDuration(form.startTime, form.endTime);

  const confirm = () => {
    onConfirm({ title: form.title.trim() || "New Event", color: form.color, allDay: form.allDay });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg-subtle)",
    border: "1px solid var(--border)",
    borderRadius: 10, padding: "8px 12px",
    fontSize: "16px", color: "var(--fg)", outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.1em", color: "var(--fg-faint)",
    display: "block", marginBottom: 5,
  };

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: isMobile ? "0 16px 16px" : "20px" }}>

      {/* Title */}
      <div>
        <input
          ref={titleRef}
          value={form.title}
          onChange={e => set("title", e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") onCancel(); }}
          placeholder="Event title"
          style={{ ...inputStyle, fontSize: "16px", fontWeight: 600 }}
        />
      </div>

      {/* Time row */}
      {!form.allDay && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="time" value={form.startTime}
            onChange={e => set("startTime", e.target.value)}
            style={{ ...inputStyle, width: "auto", flex: 1, minWidth: 100, fontSize: 14 }}
          />
          <span style={{ color: "var(--fg-faint)", fontSize: 13 }}>→</span>
          <input
            type="time" value={form.endTime}
            onChange={e => set("endTime", e.target.value)}
            style={{ ...inputStyle, width: "auto", flex: 1, minWidth: 100, fontSize: 14 }}
          />
          {durMins > 0 && (
            <span style={{ fontSize: 12, color: "var(--fg-faint)", flexShrink: 0 }}>
              {durMins >= 60
                ? `${Math.floor(durMins / 60)}h${durMins % 60 > 0 ? `${durMins % 60}m` : ""}`
                : `${durMins}min`}
            </span>
          )}
        </div>
      )}

      {/* Date */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="date" value={form.date}
          onChange={e => set("date", e.target.value)}
          style={{ ...inputStyle, width: "auto", flex: 1, fontSize: 14 }}
        />
        <span style={{ fontSize: 12, color: "var(--fg-faint)", flexShrink: 0 }}>
          {fmtDateLabel(form.date)}
        </span>
      </div>

      {/* All-day toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--fg)" }}>All day</span>
        <button
          type="button"
          onClick={() => set("allDay", !form.allDay)}
          style={{
            width: 40, height: 22, borderRadius: 9999, border: "none", cursor: "pointer",
            background: form.allDay ? "var(--accent)" : "var(--border-strong)",
            position: "relative", transition: "background 150ms ease",
          }}
        >
          <span style={{
            position: "absolute", top: 2,
            left: form.allDay ? 20 : 2,
            width: 18, height: 18, borderRadius: "50%",
            background: "white", transition: "left 150ms ease",
          }} />
        </button>
      </div>

      {/* Repeat */}
      <div>
        <label style={labelStyle}>Repeat</label>
        <select
          value={form.repeat}
          onChange={e => set("repeat", e.target.value as EventFormData["repeat"])}
          style={{ ...inputStyle, fontSize: 14, cursor: "pointer" }}
        >
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Location */}
      <div>
        <label style={labelStyle}>Location</label>
        <input
          type="text" value={form.location}
          onChange={e => set("location", e.target.value)}
          placeholder="Add location"
          style={{ ...inputStyle, fontSize: 14 }}
        />
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Add description"
          rows={3}
          style={{
            ...inputStyle, fontSize: 14,
            resize: "vertical", minHeight: 72,
          }}
        />
      </div>

      {/* Color picker */}
      <div>
        <label style={labelStyle}>Color</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => set("color", c)}
              style={{
                width: 20, height: 20, borderRadius: "50%", background: c,
                border: form.color === c ? "2.5px solid var(--fg)" : "2.5px solid transparent",
                outline: form.color === c ? "2px solid var(--bg-card)" : "none",
                outlineOffset: "-3px",
                cursor: "pointer", padding: 0, flexShrink: 0, transition: "border 120ms ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
        <button
          type="button" onClick={onCancel}
          className="rounded-xl px-4 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg)", background: "none", border: "1px solid var(--border)", cursor: "pointer" }}
        >Cancel</button>
        <button
          type="button" onClick={confirm}
          className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
          style={{ background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
        >Create</button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50 }}
          onClick={onCancel}
        />
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border-mid)",
          borderRadius: "16px 16px 0 0",
          boxShadow: "var(--shadow-float)",
          zIndex: 50,
          maxHeight: "90vh",
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "var(--border-strong)" }} />
          </div>
          <div style={{ padding: "0 0 8px", textAlign: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>New Event</span>
          </div>
          {content}
        </div>
      </>
    );
  }

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50 }}
        onClick={onCancel}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%", maxWidth: 560,
        margin: "0 16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        borderRadius: 16,
        boxShadow: "var(--shadow-float)",
        zIndex: 50,
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>New Event</span>
          <button type="button" onClick={onCancel}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--fg-faint)", lineHeight: 1 }}
          >✕</button>
        </div>
        {content}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type ExternalDropInfo = { date: Date; title: string; taskId: string; blockType: string };

type Props = {
  initialView?: ViewKey;
  hideSidebar?: boolean;
  hideHeader?: boolean;
  dashboardMode?: boolean;
  selectedDate?: string;
  onExternalDrop?: (info: ExternalDropInfo) => void;
};

function lsStr(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

export function CalendarView({ initialView = "week", hideSidebar: _hideSidebar = false, hideHeader = false, dashboardMode = false, selectedDate, onExternalDrop }: Props) {
  const [view, setView] = useState<ViewKey>(dashboardMode ? "1d" : initialView);
  const calendarRef = useRef<FullCalendar | null>(null);

  // ── Calendar settings — initialised with safe server defaults, read from
  //    localStorage in useEffect to avoid SSR/client hydration mismatches.
  const [calFirstDay, setCalFirstDay] = useState(0);
  const [calSlotDur, setCalSlotDur] = useState("00:30:00");
  const [calSlotMin, setCalSlotMin] = useState("00:00:00");
  const [calSlotMax, setCalSlotMax] = useState("24:00:00");
  const [calWeekends, setCalWeekends] = useState(true);
  const [calTimeFormat, setCalTimeFormat] = useState("12hr");

  useEffect(() => {
    // Apply persisted settings on mount (client-only)
    if (!dashboardMode) {
      const saved = localStorage.getItem("stride-calendar-view") as ViewKey | null;
      if (saved) setView(saved);
    }
    setCalFirstDay(lsStr("stride-calendar-week-start", "sunday") === "monday" ? 1 : 0);
    setCalSlotDur(lsStr("stride-slot-duration", "00:30:00"));
    setCalSlotMin(lsStr("stride-calendar-start", "00:00") + ":00");
    setCalSlotMax(lsStr("stride-calendar-end", "24:00") + ":00");
    setCalWeekends(lsStr("stride-show-weekends", "true") === "true");
    setCalTimeFormat(lsStr("stride-time-format", "12hr"));

    const handleStorage = (e: StorageEvent) => {
      switch (e.key) {
        case "stride-calendar-view":
          if (!dashboardMode && e.newValue) { setView(e.newValue as ViewKey); }
          break;
        case "stride-calendar-week-start":
          setCalFirstDay(e.newValue === "monday" ? 1 : 0);
          break;
        case "stride-slot-duration":
          if (e.newValue) setCalSlotDur(e.newValue);
          break;
        case "stride-calendar-start":
          if (e.newValue) setCalSlotMin(e.newValue + ":00");
          break;
        case "stride-calendar-end":
          if (e.newValue) setCalSlotMax(e.newValue + ":00");
          break;
        case "stride-show-weekends":
          setCalWeekends(e.newValue === "true");
          break;
        case "stride-time-format":
          if (e.newValue) setCalTimeFormat(e.newValue);
          break;
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardMode]);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [templatePrefill, setTemplatePrefill] = useState<Partial<RoutineTemplate> | null>(null);

  // Right-sidebar / mobile bottom-sheet toggle state
  const isMobile = useIsMobile();
  const [showRoutinesSidebar, setShowRoutinesSidebar] = useState(false);
  const [showTasksSidebar, setShowTasksSidebar] = useState(false);

  // Mobile routine time-picker state
  const [mobileRoutinePick, setMobileRoutinePick] = useState<RoutineTemplate | null>(null);
  const mobileTimeRef = useRef<HTMLInputElement | null>(null);
  const applyTemplatesToDay = useRoutineTemplateStore((s) => s.applyTemplatesToDay);
  const [currentTitle, setCurrentTitle] = useState("");
  const [isViewingToday, setIsViewingToday] = useState(true);

  // ── Agenda state ─────────────────────────────────────────────────────────
  const [agendaStart, setAgendaStart] = useState(0);   // day offset from today (0 = today)
  const [agendaEnd, setAgendaEnd] = useState(14);  // day offset from today
  const [showBlocks, setShowBlocks] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [todayPulse, setTodayPulse] = useState(false);
  const todayCardRef = useRef<HTMLDivElement | null>(null);
  const agendaScrollRef = useRef<HTMLDivElement | null>(null);
  const calendarBodyRef = useRef<HTMLDivElement | null>(null);
  const wheelAccum = useRef(0);
  const wheelCooldown = useRef(false);
  // Keep a live ref so the wheel handler (attached once) always sees the current view
  const viewRef = useRef<ViewKey>(dashboardMode ? "1d" : initialView);

  const [todayStr, setTodayStr] = useState("");
  useEffect(() => { setTodayStr(localDateStr(new Date())); }, []);

  const agendaDays = useMemo(() => {
    if (!todayStr) return [];
    const base = new Date(todayStr + "T00:00:00");
    const days: string[] = [];
    for (let i = agendaStart; i < agendaEnd; i++) {
      const d = new Date(base.getTime());
      d.setDate(d.getDate() + i);
      days.push(localDateStr(d));
    }
    return days;
  }, [agendaStart, agendaEnd, todayStr]);

  const scrollToToday = useCallback(() => {
    if (todayCardRef.current) {
      todayCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      agendaScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    setTodayPulse(true);
    setTimeout(() => setTodayPulse(false), 1200);
  }, []);

  // ── Fluid trackpad scroll ─────────────────────────────────────────────────
  // • Horizontal scroll → move 1 day (all non-agenda views)
  // • Vertical scroll   → move 1 week (month view only)
  // • Velocity-aware cooldown so fast swipes advance quickly
  // • preventDefault blocks macOS browser back/forward gesture
  useEffect(() => {
    const el = calendarBodyRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const currentView = viewRef.current;

      // ── Month view: vertical scroll → shift 1 week ──────────────────────
      if (currentView === "month" && absY > absX && absY > 8) {
        e.preventDefault();
        if (wheelCooldown.current) return;
        wheelCooldown.current = true;
        const api = calendarRef.current?.getApi();
        if (api) {
          const d = new Date(api.getDate());
          d.setDate(d.getDate() + (e.deltaY > 0 ? 7 : -7));
          api.gotoDate(d);
        }
        setTimeout(() => { wheelCooldown.current = false; }, 220);
        return;
      }

      // ── All views: horizontal scroll → shift 1 day ──────────────────────
      if (absX <= absY * 0.6) return;   // vertical dominates — ignore
      e.preventDefault();               // block browser back/forward swipe
      if (wheelCooldown.current) return;

      wheelAccum.current += e.deltaX;
      if (Math.abs(wheelAccum.current) < 40) return;

      const direction = wheelAccum.current > 0 ? 1 : -1;
      wheelAccum.current = 0;
      wheelCooldown.current = true;

      const api = calendarRef.current?.getApi();
      if (api) {
        const d = new Date(api.getDate());
        d.setDate(d.getDate() + direction);
        api.gotoDate(d);
      }

      // Faster swipe → shorter cooldown (feels more fluid with momentum)
      const cooldownMs = absX > 25 ? 90 : 170;
      setTimeout(() => { wheelCooldown.current = false; }, cooldownMs);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    calendarRef.current?.getApi().gotoDate(selectedDate);
  }, [selectedDate]);

  const timeBlocks = useTimeBlockStore((s) => s.timeBlocks);
  const loadTimeBlocks = useTimeBlockStore((s) => s.loadTimeBlocks);
  const createTimeBlock = useTimeBlockStore((s) => s.createTimeBlock);
  const updateTimeBlock = useTimeBlockStore((s) => s.updateTimeBlock);

  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const updateTask = useTaskStore((s) => s.updateTask);

  const dailyNotes = useDailyNoteStore((s) => s.dailyNotes);
  const loadDailyNotes = useDailyNoteStore((s) => s.loadDailyNotes);

  const cfg = useMemo(() => viewConfig(view), [view]);

  const [pendingBlock, setPendingBlock] = useState<PendingBlock | null>(null);

  const events = useMemo(() => {
    const base = timeBlocks.map((b) => {
      const color = b.color ?? DEFAULT_BLOCK_COLOR;
      return {
        id: b.id, title: b.title, start: b.startTime, end: b.endTime,
        allDay: b.allDay ?? false,
        backgroundColor: hexToRgba(color, 0.15),
        borderColor: hexToRgba(color, 0.4),
        textColor: color,
        extendedProps: { timeBlockType: b.type, taskId: b.taskId },
      };
    });
    if (pendingBlock) {
      base.push({
        id: "__pending__",
        title: "New Event",
        start: pendingBlock.startTime,
        end: pendingBlock.endTime,
        allDay: false,
        backgroundColor: hexToRgba(DEFAULT_BLOCK_COLOR, 0.08),
        borderColor: hexToRgba(DEFAULT_BLOCK_COLOR, 0.35),
        textColor: DEFAULT_BLOCK_COLOR,
        extendedProps: { isPending: true } as any,
      });
    }
    return base;
  }, [timeBlocks, pendingBlock]);

  useEffect(() => { void loadTimeBlocks(); void loadTasks(); void loadDailyNotes(); }, [loadTasks, loadTimeBlocks, loadDailyNotes]);

  // Scroll calendar to current time on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      calendarRef.current?.getApi().scrollToTime({ hours: Math.max(0, now.getHours() - 1), minutes: 0 });
    }, 120);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const incompleteTasks = useMemo(() => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled"), [tasks]);

  const taskPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = taskPanelRef.current;
    if (!el) return;
    const d = new Draggable(el, {
      itemSelector: "[data-task-id]",
      eventData: (el) => ({
        title: (el as HTMLElement).dataset.taskTitle ?? "Task",
        duration: "00:30",
        extendedProps: { taskId: (el as HTMLElement).dataset.taskId },
      }),
    });
    return () => d.destroy();
  }, []);

  const [popover, setPopover] = useState<{ timeBlockId: string; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ timeBlockId: string; x: number; y: number } | null>(null);

  const activeBlock: TimeBlock | undefined = useMemo(() => {
    const id = popover?.timeBlockId ?? contextMenu?.timeBlockId;
    return id ? timeBlocks.find((b) => b.id === id) : undefined;
  }, [contextMenu?.timeBlockId, popover?.timeBlockId, timeBlocks]);

  const switchView = (key: ViewKey) => {
    viewRef.current = key;
    setView(key);
    if (!dashboardMode) {
      localStorage.setItem("stride-calendar-view", key);
    }
    if (key === "agenda") return;
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const { type, duration } = viewConfig(key);
    api.changeView(type, duration ? ({ duration } as any) : undefined);
    // Always snap to today's default position when switching views
    api.gotoDate(defaultStart(key));
    // Scroll to current time so the indicator is always visible
    const now = new Date();
    setTimeout(() => api.scrollToTime({ hours: Math.max(0, now.getHours() - 1), minutes: 0 }), 80);
  };

  const [todayLabel, setTodayLabel] = useState("");
  useEffect(() => {
    setTodayLabel(new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()));
  }, []);

  // Scroll calendar to keep current time visible when the bottom dock opens/closes
  useEffect(() => {
    if (!isMobile) return;
    const isOpen = showRoutinesSidebar || showTasksSidebar;
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const now = new Date();
    const targetHour = Math.max(0, now.getHours() - 1);
    const timer = setTimeout(() => {
      if (isOpen) {
        api.scrollToTime({ hours: Math.min(23, now.getHours() + 1), minutes: 0 });
      } else {
        api.scrollToTime({ hours: targetHour, minutes: 0 });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [showRoutinesSidebar, showTasksSidebar, isMobile]);

  // Tell FullCalendar to re-measure after the sidebar CSS transition completes (250ms)
  // Without this it is always one step behind — measuring the pre-transition width
  useEffect(() => {
    if (isMobile) return;
    const timer = setTimeout(() => {
      calendarRef.current?.getApi().updateSize();
    }, 260);
    return () => clearTimeout(timer);
  }, [showRoutinesSidebar, showTasksSidebar, isMobile]);

  const VIEW_LABELS: [ViewKey, string][] = [["1d", "Day"], ["2d", "2D"], ["3d", "3D"], ["4d", "4D"], ["week", "Week"], ["month", "Month"], ["agenda", "Agenda"]];

  const isAgenda = view === "agenda";

  return (
    <div className="flex h-full w-full flex-col">
      {!hideHeader && !dashboardMode && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 flex-none"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
              {dashboardMode ? todayLabel : "Calendar"}
            </span>
          </div>

          {!dashboardMode && (
            <div className="flex items-center gap-2">
              {/* Right sidebar / bottom-sheet toggles */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Toggle Routines"
                  onClick={() => setShowRoutinesSidebar(v => !v)}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: showRoutinesSidebar ? "var(--accent-bg)" : "var(--bg-subtle)",
                    color: showRoutinesSidebar ? "var(--accent)" : "var(--fg-faint)",
                    transition: "background 150ms ease, color 150ms ease",
                  }}
                >
                  {/* Loop/routine icon */}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7a5 5 0 0 1 5-5h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M12 7a5 5 0 0 1-5 5H4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M9.5 2l1.5 1.5L9.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.5 12l-1.5-1.5L4.5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  title="Toggle Unscheduled Tasks"
                  onClick={() => setShowTasksSidebar(v => !v)}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: showTasksSidebar ? "var(--accent-bg)" : "var(--bg-subtle)",
                    color: showTasksSidebar ? "var(--accent)" : "var(--fg-faint)",
                    transition: "background 150ms ease, color 150ms ease",
                  }}
                >
                  {/* Unscheduled tasks list icon */}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <line x1="8.5" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <rect x="1" y="8" width="5" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <line x1="8.5" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div
                className="flex items-center gap-0.5 rounded-xl p-1"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
              >
                {VIEW_LABELS.map(([key, label]) => (
                  <button key={key} type="button" onClick={() => switchView(key)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ease-out"
                    style={view === key
                      ? { background: "var(--bg-card)", color: "var(--fg)", boxShadow: "var(--shadow-sm)" }
                      : { color: "var(--fg-faint)" }
                    }
                  >{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile routine time-picker (hidden input) */}
      <input
        ref={mobileTimeRef}
        type="time"
        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
        tabIndex={-1}
        onChange={(e) => {
          if (!mobileRoutinePick || !e.target.value) return;
          const [h, m] = e.target.value.split(":").map(Number);
          const today = new Date();
          today.setHours(h ?? 0, m ?? 0, 0, 0);
          void applyTemplatesToDay([mobileRoutinePick.id], today.toISOString().split("T")[0]!);
          setMobileRoutinePick(null);
        }}
      />

      <div className="flex flex-1 overflow-hidden" style={{ minWidth: 0 }}>
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
          {/* Navigation bar — hidden in dashboard mode */}
          {!dashboardMode && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 flex-none"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              {/* Prev */}
              <button
                type="button"
                onClick={() => {
                  if (isAgenda) { setAgendaStart(s => s - 7); return; }
                  const api = calendarRef.current?.getApi();
                  if (!api) return;
                  // Month view: jump ~1 month (4 weeks) backward
                  if (view === "month") {
                    const d = new Date(api.getDate()); d.setDate(d.getDate() - 28); api.gotoDate(d);
                  } else {
                    api.prev();
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 26, height: 26, borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-subtle)",
                  color: "var(--fg-muted)", cursor: "pointer", flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Next */}
              <button
                type="button"
                onClick={() => {
                  if (isAgenda) { setAgendaEnd(e => e + 7); return; }
                  const api = calendarRef.current?.getApi();
                  if (!api) return;
                  // Month view: jump ~1 month (4 weeks) forward
                  if (view === "month") {
                    const d = new Date(api.getDate()); d.setDate(d.getDate() + 28); api.gotoDate(d);
                  } else {
                    api.next();
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 26, height: 26, borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-subtle)",
                  color: "var(--fg-muted)", cursor: "pointer", flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Today */}
              <button
                type="button"
                onClick={() => {
                  if (isAgenda) { scrollToToday(); return; }
                  const api = calendarRef.current?.getApi();
                  if (!api) return;
                  api.gotoDate(defaultStart(view));
                  const now = new Date();
                  setTimeout(() => api.scrollToTime({ hours: Math.max(0, now.getHours() - 1), minutes: 0 }), 50);
                }}
                style={{
                  padding: "3px 10px", borderRadius: 9999,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: "0.7rem", fontWeight: 600,
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                Today
              </button>

              {/* Title area — show filter toggles in agenda mode */}
              {isAgenda ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 4, flexWrap: "wrap" }}>
                  <TogglePill label="Time Blocks" active={showBlocks} onClick={() => setShowBlocks(v => !v)} />
                  <TogglePill label="Tasks" active={showTasks} onClick={() => setShowTasks(v => !v)} />
                  <TogglePill label="Notes" active={showNotes} onClick={() => setShowNotes(v => !v)} />
                </div>
              ) : (
                <span style={{
                  fontSize: "0.75rem", fontWeight: 600,
                  color: isViewingToday ? "var(--accent)" : "var(--fg)",
                  marginLeft: 2,
                }}>
                  {isViewingToday && (view === "1d") ? "Today" : currentTitle}
                </span>
              )}
            </div>
          )}

          {/* ── Agenda layout ── */}
          {isAgenda && (
            <div
              ref={agendaScrollRef}
              style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}
            >
              {/* Show previous days */}
              <button
                type="button"
                onClick={() => setAgendaStart(s => s - 7)}
                style={{
                  display: "block", width: "100%", marginBottom: 8,
                  padding: "6px 0",
                  fontSize: 11.5, color: "var(--fg-faint)",
                  background: "none", border: "none", cursor: "pointer",
                  textAlign: "center",
                  transition: "color 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--fg-muted)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--fg-faint)"; }}
              >
                ↑ Show previous days
              </button>

              {agendaDays.map(date => (
                <AgendaDayCard
                  key={date}
                  date={date}
                  todayStr={todayStr}
                  timeBlocks={timeBlocks}
                  tasks={tasks}
                  dailyNotes={dailyNotes}
                  showBlocks={showBlocks}
                  showTasks={showTasks}
                  showNotes={showNotes}
                  pulse={date === todayStr && todayPulse}
                  cardRef={date === todayStr ? (el) => { todayCardRef.current = el; } : undefined}
                />
              ))}
            </div>
          )}

          {/* ── FullCalendar (hidden when agenda) ── */}
          <div
            ref={calendarBodyRef}
            className="flex-1 p-2 overflow-hidden"
            style={{ display: isAgenda ? "none" : undefined, overscrollBehaviorX: "none", fontSize: "11px", paddingBottom: isMobile ? "calc(8px + env(safe-area-inset-bottom))" : undefined }}
          >
            <div className="h-full rounded-xl overflow-hidden">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={cfg.type}
                duration={cfg.duration}
                headerToolbar={false}
                height="100%"
                nowIndicator
                allDaySlot
                firstDay={calFirstDay}
                slotDuration={calSlotDur}
                slotMinTime={calSlotMin}
                slotMaxTime={calSlotMax}
                weekends={calWeekends}
                eventTimeFormat={calTimeFormat === "24hr"
                  ? { hour: "2-digit", minute: "2-digit", hour12: false }
                  : { hour: "numeric", minute: "2-digit", hour12: true }
                }
                datesSet={(arg) => {
                  setCurrentTitle(arg.view.title);
                  const todayMidnight = new Date();
                  todayMidnight.setHours(0, 0, 0, 0);
                  setIsViewingToday(todayMidnight >= arg.start && todayMidnight < arg.end);
                }}
                editable droppable
                selectable
                selectMinDistance={5}
                unselectAuto={false}
                events={events}
                select={(arg) => {
                  setPendingBlock(null);
                  const x = arg.jsEvent?.clientX ?? window.innerWidth / 2;
                  const y = arg.jsEvent?.clientY ?? window.innerHeight / 2;
                  calendarRef.current?.getApi().unselect();
                  setPendingBlock({
                    startTime: arg.start.toISOString(),
                    endTime: arg.end.toISOString(),
                    x, y,
                  });
                }}
                eventClick={(arg) => {
                  if (arg.event.extendedProps.isPending) return;
                  setContextMenu(null);
                  setPopover({ timeBlockId: arg.event.id, x: arg.jsEvent.clientX, y: arg.jsEvent.clientY });
                }}
                eventDidMount={(info) => {
                  info.el.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    setPopover(null);
                    setContextMenu({ timeBlockId: info.event.id, x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
                  });
                }}
                eventDrop={(arg) => {
                  const s = arg.event.start?.toISOString(), e = arg.event.end?.toISOString();
                  if (s && e) void updateTimeBlock(arg.event.id, { startTime: s, endTime: e });
                }}
                eventResize={(arg) => {
                  const e = arg.event.end?.toISOString();
                  if (e) void updateTimeBlock(arg.event.id, { endTime: e });
                }}
                drop={(info) => {
                  const dt = (info.jsEvent as DragEvent | null)?.dataTransfer;
                  if (!dt || !onExternalDrop) return;
                  const blockType = dt.getData("text/block-type") || "note";
                  const title = dt.getData("text/task-title") || dt.getData("text/plain") || "";
                  const taskId = dt.getData("text/task-id") || "";
                  if (title) onExternalDrop({ date: info.date, title, taskId, blockType });
                }}
                eventReceive={(info: EventReceiveArg) => {
                  const start = info.event.start?.toISOString();
                  const end = info.event.end?.toISOString() ?? (start ? addMins(start, 30) : undefined);
                  const { taskId, routineTemplateId, type } = info.event.extendedProps as any;
                  const title = info.event.title;
                  const color = info.event.backgroundColor;
                  info.event.remove();
                  if (!start || !end) return;
                  void (async () => {
                    if (type === "routine" && routineTemplateId) {
                      await createTimeBlock({ type: "routine", routineTemplateId, title, startTime: start, endTime: end, color: color || DEFAULT_BLOCK_COLOR });
                    } else if (taskId) {
                      await createTimeBlock({ type: "task", taskId, title, startTime: start, endTime: end, color: DEFAULT_BLOCK_COLOR });
                      await updateTask(taskId, { scheduledStart: start, scheduledEnd: end });
                    }
                  })();
                }}
                eventContent={(arg) => (
                  <div style={{
                    padding: "2px 6px", overflow: "hidden", height: "100%",
                    opacity: arg.event.extendedProps.isPending ? 0.5 : 1,
                  }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {arg.event.title}
                    </div>
                  </div>
                )}
                eventClassNames={() => ["rounded-xl"]}
                dayHeaderClassNames={() => ["text-xs"]}
                slotLabelClassNames={() => ["text-xs"]}
              />
            </div>
          </div>
        </div>

        {/* ── Right sidebar: Routines ── desktop only, slides in from right */}
        {!isAgenda && (
          <div
            className="hidden md:flex flex-col overflow-hidden"
            style={{
              flexShrink: 0,
              width: showRoutinesSidebar ? 260 : 0,
              transition: "width 250ms cubic-bezier(0.4,0,0.2,1)",
              borderLeft: showRoutinesSidebar ? "1px solid var(--border)" : "none",
              minWidth: 0,
            }}
          >
            <div style={{ width: 260, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px 6px", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-faint)" }}>
                  Routines
                </span>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <RoutineTemplateStrip onManageTemplates={() => setRoutineOpen(true)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Right sidebar: Unscheduled Tasks ── desktop only, slides in from right */}
        {!isAgenda && (
          <div
            className="hidden md:flex flex-col overflow-hidden"
            style={{
              flexShrink: 0,
              width: showTasksSidebar ? 260 : 0,
              transition: "width 250ms cubic-bezier(0.4,0,0.2,1)",
              borderLeft: showTasksSidebar ? "1px solid var(--border)" : "none",
              minWidth: 0,
            }}
          >
            <div ref={taskPanelRef} style={{ width: 260, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px 6px", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-faint)" }}>
                  Unscheduled
                </span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 16px" }}>
                {incompleteTasks.length === 0 ? (
                  <div style={{ padding: "24px 12px", fontSize: 12, color: "var(--fg-faint)", textAlign: "center" }}>
                    No incomplete tasks
                  </div>
                ) : incompleteTasks.map((t) => (
                  <div
                    key={t.id}
                    data-task-id={t.id}
                    data-task-title={t.title}
                    style={{
                      marginBottom: 4, padding: "8px 12px", borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      color: "var(--fg-muted)",
                      fontSize: 13, cursor: "grab",
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-card)")}
                  >{t.title || "(Untitled)"}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {pendingBlock && (
        <NewEventModal
          pending={pendingBlock}
          onConfirm={({ title, color, allDay }) => {
            void createTimeBlock({
              type: "event", title,
              startTime: pendingBlock.startTime,
              endTime: pendingBlock.endTime,
              color,
              allDay,
            });
            setPendingBlock(null);
          }}
          onCancel={() => setPendingBlock(null)}
        />
      )}

      {popover && activeBlock && (
        <TimeBlockPopover timeBlock={activeBlock} position={{ x: popover.x, y: popover.y }} onClose={() => setPopover(null)} />
      )}
      {contextMenu && activeBlock && (
        <TimeBlockContextMenu
          timeBlock={activeBlock}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onEdit={() => { setContextMenu(null); setPopover({ timeBlockId: activeBlock.id, x: contextMenu.x, y: contextMenu.y }); }}
          onDelete={() => {
            const blockId = activeBlock.id, taskId = activeBlock.taskId;
            void (async () => {
              await useTimeBlockStore.getState().deleteTimeBlock(blockId);
              if (taskId) await useTaskStore.getState().updateTask(taskId, { scheduledStart: undefined, scheduledEnd: undefined });
            })();
            setContextMenu(null);
          }}
          onSaveAsTemplate={() => {
            const s = new Date(activeBlock.startTime);
            const dur = Math.max(1, Math.round((new Date(activeBlock.endTime).getTime() - s.getTime()) / 60_000));
            const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            setTemplatePrefill({ title: activeBlock.title, durationMinutes: dur, defaultStartTime: hhmm(s), color: activeBlock.color ?? DEFAULT_BLOCK_COLOR, icon: "⏱️", daysOfWeek: [], isBuiltIn: false, order: 0 });
            setRoutineOpen(true);
          }}
        />
      )}
      {/* ── Mobile bottom sheet: Routines ── */}
      {/* ── Mobile bottom dock: pushes calendar up ── */}
      {isMobile && (
        <>
        
          {/* Routines dock */}
          <div style={{
            flexShrink: 0,
            height: (showRoutinesSidebar || showTasksSidebar) ? "40%" : 0,
            overflow: "hidden",
            transition: "height 280ms cubic-bezier(0.32, 0.72, 0, 1)",
            background: "var(--bg-card)",
            borderTop: (showRoutinesSidebar || showTasksSidebar) ? "1px solid var(--border-mid)" : "none",
            display: "flex",
            flexDirection: "column",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}>
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: "var(--border-strong)" }} />
            </div>

            {/* Routines panel */}
            <div style={{
              display: showRoutinesSidebar ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              overflow: "hidden",
            }}>
              <div style={{ padding: "4px 16px 10px", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-faint)" }}>
                  Routines
                </span>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <RoutineTemplateStrip onManageTemplates={() => setRoutineOpen(true)} />
              </div>
            </div>

            {/* Unscheduled tasks panel */}
            <div style={{
              display: showTasksSidebar ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              overflow: "hidden",
            }}>
              <div style={{ padding: "4px 16px 10px", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-faint)" }}>
                  Unscheduled Tasks
                </span>
              </div>
              <div ref={taskPanelRef} style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
                {incompleteTasks.length === 0 ? (
                  <div style={{ padding: "24px 12px", fontSize: 12, color: "var(--fg-faint)", textAlign: "center" }}>
                    No incomplete tasks
                  </div>
                ) : incompleteTasks.map((t) => (
                  <div
                    key={t.id}
                    data-task-id={t.id}
                    data-task-title={t.title}
                    style={{
                      marginBottom: 4, padding: "10px 12px", borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      color: "var(--fg-muted)",
                      fontSize: 14, cursor: "grab",
                    }}
                  >{t.title || "(Untitled)"}</div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <RoutineTemplatePanel open={routineOpen} onClose={() => { setRoutineOpen(false); setTemplatePrefill(null); }} prefill={templatePrefill} />

    </div>
  );
}