"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  Draggable, type EventReceiveArg,
} from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { RoutineTemplatePanel } from "@/components/RoutineTemplatePanel";
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

function viewConfig(v: ViewKey): { type: string; duration?: { days: number } } {
  switch (v) {
    case "1d":    return { type: "timeGridDay" };
    case "2d":    return { type: "timeGrid", duration: { days: 2 } };
    case "3d":    return { type: "timeGrid", duration: { days: 3 } };
    case "4d":    return { type: "timeGrid", duration: { days: 4 } };
    case "month": return { type: "dayGridMonth" };
    default:      return { type: "timeGridWeek" };
  }
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
        padding: "3px 9px", borderRadius: 20,
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

// ─── New Event Creation Popover ───────────────────────────────────────────────

function NewEventPopover({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingBlock;
  onConfirm: (title: string, color: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(DEFAULT_BLOCK_COLOR);
  const inputRef  = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const titleRef = useRef(title);
  const colorRef = useRef(color);
  titleRef.current = title;
  colorRef.current = color;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (titleRef.current.trim()) {
          onConfirm(titleRef.current.trim(), colorRef.current);
        } else {
          onCancel();
        }
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handleMouseDown), 150);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onConfirm, onCancel]);

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));

  const mins = Math.round(
    (new Date(pending.endTime).getTime() - new Date(pending.startTime).getTime()) / 60000
  );

  const confirm = () => onConfirm(title.trim() || "New Event", colorRef.current);

  const W = 276, H = 230;
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const px = Math.max(8, Math.min(pending.x + 12, vw - W - 8));
  const py = Math.max(8, Math.min(pending.y - 20, vh - H - 8));

  return (
    <div
      ref={popoverRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed", left: px, top: py, width: W,
        zIndex: 1000,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2)",
        padding: "14px 14px 12px",
      }}
    >
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter")  confirm();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="New Event"
        style={{
          width: "100%", boxSizing: "border-box",
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: 8, padding: "6px 10px",
          fontSize: "0.875rem", fontWeight: 600,
          color: "var(--fg)", outline: "none",
          marginBottom: 10,
        }}
      />
      <div style={{
        fontSize: "0.75rem", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
      }}>
        <span style={{ color: "var(--fg)", fontWeight: 500 }}>{fmtTime(pending.startTime)}</span>
        <span style={{ color: "var(--fg-faint)" }}>→</span>
        <span style={{ color: "var(--fg)", fontWeight: 500 }}>{fmtTime(pending.endTime)}</span>
        <span style={{ color: "var(--fg-faint)" }}>{mins}min</span>
        <span style={{ color: "var(--fg-faint)", marginLeft: 2 }}>{fmtDate(pending.startTime)}</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c} type="button"
            onClick={() => setColor(c)}
            style={{
              width: 14, height: 14, borderRadius: "50%",
              background: c,
              border: color === c ? `2px solid var(--fg)` : "2px solid transparent",
              outline: color === c ? "1px solid var(--bg-card)" : "none",
              outlineOffset: "-3px",
              cursor: "pointer", padding: 0, flexShrink: 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button" onClick={onCancel}
          style={{
            padding: "5px 12px", borderRadius: 7,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--fg-muted)",
            fontSize: "0.75rem", cursor: "pointer",
          }}
        >Cancel</button>
        <button
          type="button" onClick={confirm}
          style={{
            padding: "5px 12px", borderRadius: 7,
            border: "none",
            background: color, color: "#fff",
            fontSize: "0.75rem", fontWeight: 600,
            cursor: "pointer",
          }}
        >Create</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  initialView?: ViewKey;
  hideSidebar?: boolean;
  hideHeader?: boolean;
  dashboardMode?: boolean;
  selectedDate?: string;
};

export function CalendarView({ initialView = "week", hideSidebar = false, hideHeader = false, dashboardMode = false, selectedDate }: Props) {
  const [view, setView]               = useState<ViewKey>(dashboardMode ? "1d" : initialView);
  const calendarRef                   = useRef<FullCalendar | null>(null);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [templatePrefill, setTemplatePrefill] = useState<Partial<RoutineTemplate> | null>(null);
  const [currentTitle, setCurrentTitle] = useState("");
  const [isViewingToday, setIsViewingToday] = useState(true);

  // ── Agenda state ─────────────────────────────────────────────────────────
  const [agendaStart, setAgendaStart] = useState(0);   // day offset from today (0 = today)
  const [agendaEnd, setAgendaEnd]     = useState(14);  // day offset from today
  const [showBlocks, setShowBlocks]   = useState(true);
  const [showTasks, setShowTasks]     = useState(true);
  const [showNotes, setShowNotes]     = useState(true);
  const [todayPulse, setTodayPulse]   = useState(false);
  const todayCardRef    = useRef<HTMLDivElement | null>(null);
  const agendaScrollRef = useRef<HTMLDivElement | null>(null);
  const calendarBodyRef = useRef<HTMLDivElement | null>(null);
  const wheelAccum      = useRef(0);
  const wheelCooldown   = useRef(false);

  const todayStr = useMemo(() => localDateStr(new Date()), []);

  const agendaDays = useMemo(() => {
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

  // ── Horizontal trackpad scroll → move 1 day at a time ───────────────────
  useEffect(() => {
    const el = calendarBodyRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Ignore when vertical scroll dominates (normal scrolling)
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 0.6) return;

      // Prevent browser back/forward navigation swipe
      e.preventDefault();

      if (wheelCooldown.current) return;

      wheelAccum.current += e.deltaX;

      const THRESHOLD = 40;
      if (Math.abs(wheelAccum.current) < THRESHOLD) return;

      const direction = wheelAccum.current > 0 ? 1 : -1;
      wheelAccum.current = 0;
      wheelCooldown.current = true;

      const api = calendarRef.current?.getApi();
      if (api) {
        const next = new Date(api.getDate());
        next.setDate(next.getDate() + direction);
        api.gotoDate(next);
      }

      setTimeout(() => { wheelCooldown.current = false; }, 180);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    calendarRef.current?.getApi().gotoDate(selectedDate);
  }, [selectedDate]);

  const timeBlocks      = useTimeBlockStore((s) => s.timeBlocks);
  const loadTimeBlocks  = useTimeBlockStore((s) => s.loadTimeBlocks);
  const createTimeBlock = useTimeBlockStore((s) => s.createTimeBlock);
  const updateTimeBlock = useTimeBlockStore((s) => s.updateTimeBlock);

  const tasks      = useTaskStore((s) => s.tasks);
  const loadTasks  = useTaskStore((s) => s.loadTasks);
  const updateTask = useTaskStore((s) => s.updateTask);

  const dailyNotes     = useDailyNoteStore((s) => s.dailyNotes);
  const loadDailyNotes = useDailyNoteStore((s) => s.loadDailyNotes);

  const cfg = useMemo(() => viewConfig(view), [view]);

  const [pendingBlock, setPendingBlock] = useState<PendingBlock | null>(null);

  const events = useMemo(() => {
    const base = timeBlocks.map((b) => {
      const color = b.color ?? DEFAULT_BLOCK_COLOR;
      return {
        id: b.id, title: b.title, start: b.startTime, end: b.endTime,
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
        backgroundColor: hexToRgba(DEFAULT_BLOCK_COLOR, 0.08),
        borderColor: hexToRgba(DEFAULT_BLOCK_COLOR, 0.35),
        textColor: DEFAULT_BLOCK_COLOR,
        extendedProps: { isPending: true } as any,
      });
    }
    return base;
  }, [timeBlocks, pendingBlock]);

  useEffect(() => { void loadTimeBlocks(); void loadTasks(); void loadDailyNotes(); }, [loadTasks, loadTimeBlocks, loadDailyNotes]);

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

  const [popover, setPopover]         = useState<{ timeBlockId: string; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ timeBlockId: string; x: number; y: number } | null>(null);

  const activeBlock: TimeBlock | undefined = useMemo(() => {
    const id = popover?.timeBlockId ?? contextMenu?.timeBlockId;
    return id ? timeBlocks.find((b) => b.id === id) : undefined;
  }, [contextMenu?.timeBlockId, popover?.timeBlockId, timeBlocks]);

  const switchView = (key: ViewKey) => {
    setView(key);
    if (key === "agenda") return;  // no FullCalendar API call for agenda
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const { type, duration } = viewConfig(key);
    api.changeView(type, duration ? ({ duration } as any) : undefined);
    // 1D–4D toggle views always reset to today; week/month go to today's range too
    api.today();
  };

  const todayLabel = useMemo(() =>
    new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    []
  );

  const VIEW_LABELS: [ViewKey, string][] = [["1d","Day"],["2d","2D"],["3d","3D"],["4d","4D"],["week","Week"],["month","Month"],["agenda","Agenda"]];

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
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Tasks sidebar — hidden in agenda mode */}
        {!hideSidebar && !isAgenda && (
          <div className="w-64 flex-none overflow-y-auto" style={{ borderRight: "1px solid var(--border)" }}>
            <div
              className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--fg-faint)" }}
            >
              Tasks
            </div>
            <div ref={taskPanelRef} className="px-2 pb-4">
              {incompleteTasks.length === 0
                ? (
                  <div className="px-3 py-6 text-xs text-center" style={{ color: "var(--fg-faint)" }}>
                    No incomplete tasks
                  </div>
                )
                : incompleteTasks.map((t) => (
                  <div key={t.id} data-task-id={t.id} data-task-title={t.title}
                    className="cursor-grab mb-1 rounded-xl px-3 py-2 text-sm transition-all duration-150 ease-out active:cursor-grabbing hover:bg-[var(--bg-hover)]"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--bg-subtle)",
                      color: "var(--fg-muted)",
                    }}
                  >{t.title || "(Untitled)"}</div>
                ))
              }
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Navigation bar — hidden in dashboard mode */}
          {!dashboardMode && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 flex-none"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              {/* Prev */}
              <button
                type="button"
                onClick={() => isAgenda
                  ? setAgendaStart(s => s - 7)
                  : calendarRef.current?.getApi().prev()
                }
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 26, height: 26, borderRadius: 7,
                  border: "1px solid var(--border)",
                  background: "var(--bg-subtle)",
                  color: "var(--fg-muted)", cursor: "pointer", flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Next */}
              <button
                type="button"
                onClick={() => isAgenda
                  ? setAgendaEnd(e => e + 7)
                  : calendarRef.current?.getApi().next()
                }
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 26, height: 26, borderRadius: 7,
                  border: "1px solid var(--border)",
                  background: "var(--bg-subtle)",
                  color: "var(--fg-muted)", cursor: "pointer", flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Today */}
              <button
                type="button"
                onClick={() => isAgenda
                  ? scrollToToday()
                  : calendarRef.current?.getApi().today()
                }
                style={{
                  padding: "3px 10px", borderRadius: 20,
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
                  <TogglePill label="Tasks"       active={showTasks}  onClick={() => setShowTasks(v => !v)} />
                  <TogglePill label="Notes"       active={showNotes}  onClick={() => setShowNotes(v => !v)} />
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
            style={{ display: isAgenda ? "none" : undefined, overscrollBehaviorX: "none" }}
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
                allDaySlot={false}
                slotMinTime="00:00:00"
                slotMaxTime="24:00:00"
                datesSet={(arg) => {
                  setCurrentTitle(arg.view.title);
                  const todayMidnight = new Date();
                  todayMidnight.setHours(0, 0, 0, 0);
                  setIsViewingToday(todayMidnight >= arg.start && todayMidnight < arg.end);
                }}
                editable droppable weekends
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
                eventReceive={(info: EventReceiveArg) => {
                  const start = info.event.start?.toISOString();
                  const end   = info.event.end?.toISOString() ?? (start ? addMins(start, 30) : undefined);
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
      </div>

      {pendingBlock && (
        <NewEventPopover
          pending={pendingBlock}
          onConfirm={(title, color) => {
            void createTimeBlock({
              type: "event", title,
              startTime: pendingBlock.startTime,
              endTime: pendingBlock.endTime,
              color,
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
            const s   = new Date(activeBlock.startTime);
            const dur = Math.max(1, Math.round((new Date(activeBlock.endTime).getTime() - s.getTime()) / 60_000));
            const hhmm = (d: Date) => `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
            setTemplatePrefill({ title: activeBlock.title, durationMinutes: dur, defaultStartTime: hhmm(s), color: activeBlock.color ?? DEFAULT_BLOCK_COLOR, icon: "⏱️", daysOfWeek: [], isBuiltIn: false, order: 0 });
            setRoutineOpen(true);
          }}
        />
      )}
      <RoutineTemplatePanel open={routineOpen} onClose={() => { setRoutineOpen(false); setTemplatePrefill(null); }} prefill={templatePrefill} />
    </div>
  );
}
