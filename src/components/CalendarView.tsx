"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  Draggable, type EventReceiveArg,
} from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useEffect, useMemo, useRef, useState } from "react";

import { RoutineTemplatePanel } from "@/components/RoutineTemplatePanel";
import { TimeBlockContextMenu } from "@/components/TimeBlockContextMenu";
import { TimeBlockPopover } from "@/components/TimeBlockPopover";
import { useTaskStore } from "@/store/taskStore";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import type { RoutineTemplate, TimeBlock } from "@/types/index";

type ViewKey = "1d" | "2d" | "3d" | "4d" | "week" | "month";

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

  // Refs so mousedown handler always reads latest values without re-registering
  const titleRef = useRef(title);
  const colorRef = useRef(color);
  titleRef.current = title;
  colorRef.current = color;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Click-outside: save if title has content, cancel if empty
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
    // Delay so the same click that triggered select doesn't immediately close
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

  // Clamp popover to viewport edges
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
      {/* Title */}
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

      {/* Time range */}
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

      {/* Color picker */}
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

      {/* Action buttons */}
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
        >
          Cancel
        </button>
        <button
          type="button" onClick={confirm}
          style={{
            padding: "5px 12px", borderRadius: 7,
            border: "none",
            background: color, color: "#fff",
            fontSize: "0.75rem", fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Create
        </button>
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

  const cfg = useMemo(() => viewConfig(view), [view]);

  // Pending (ghost) block state — lives only until confirmed or cancelled
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

    // Ghost placeholder while creation popover is open
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

  useEffect(() => { void loadTimeBlocks(); void loadTasks(); }, [loadTasks, loadTimeBlocks]);

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

  // FIX: pass duration as second arg to changeView(), not setOption()
  const switchView = (key: ViewKey) => {
    setView(key);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const { type, duration } = viewConfig(key);
    api.changeView(type, duration ? ({ duration } as any) : undefined);
  };

  const todayLabel = useMemo(() =>
    new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    []
  );

  const VIEW_LABELS: [ViewKey, string][] = [["1d","Day"],["2d","2D"],["3d","3D"],["4d","4D"],["week","Week"],["month","Month"]];

  return (
    <div className="flex h-full w-full flex-col">
      {!hideHeader && !dashboardMode && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 flex-none"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            {/* Today dot — accent colored */}
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
        {!hideSidebar && (
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

        {/* Calendar — let globals.css fc variables take over, no inline overrides */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Navigation bar — hidden in dashboard mode (parent handles navigation) */}
          {!dashboardMode && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 flex-none"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {/* Prev / Next */}
            <button
              type="button"
              onClick={() => calendarRef.current?.getApi().prev()}
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
            <button
              type="button"
              onClick={() => calendarRef.current?.getApi().next()}
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

            {/* Today pill */}
            <button
              type="button"
              onClick={() => calendarRef.current?.getApi().today()}
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

            <span
              style={{
                fontSize: "0.75rem", fontWeight: 600,
                color: isViewingToday ? "var(--accent)" : "var(--fg)",
                marginLeft: 2,
              }}
            >
              {isViewingToday && (view === "1d") ? "Today" : currentTitle}
            </span>
          </div>
          )}

          <div className="flex-1 p-2 overflow-hidden">
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
              slotMinTime="05:00:00"
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
                // Dismiss previous pending block (no title = cancel)
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
                // Don't open popover on the ghost pending event
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
            const s = new Date(activeBlock.startTime), e = new Date(activeBlock.endTime);
            const hhmm = (d: Date) => `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
            setTemplatePrefill({ title: activeBlock.title, startTime: hhmm(s), endTime: hhmm(e), color: activeBlock.color ?? DEFAULT_BLOCK_COLOR, icon: "⏱️", daysOfWeek: [], isBuiltIn: false });
            setRoutineOpen(true);
          }}
        />
      )}
      <RoutineTemplatePanel open={routineOpen} onClose={() => { setRoutineOpen(false); setTemplatePrefill(null); }} prefill={templatePrefill} />
    </div>
  );
}
