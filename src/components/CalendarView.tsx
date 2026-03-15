"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  Draggable, type DateClickArg, type EventReceiveArg,
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

type Props = {
  initialView?: ViewKey;
  hideSidebar?: boolean;
  hideHeader?: boolean;
  dashboardMode?: boolean;
};

export function CalendarView({ initialView = "week", hideSidebar = false, hideHeader = false, dashboardMode = false }: Props) {
  const [view, setView]         = useState<ViewKey>(dashboardMode ? "1d" : initialView);
  const calendarRef             = useRef<FullCalendar | null>(null);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [templatePrefill, setTemplatePrefill] = useState<Partial<RoutineTemplate> | null>(null);

  const timeBlocks     = useTimeBlockStore((s) => s.timeBlocks);
  const loadTimeBlocks = useTimeBlockStore((s) => s.loadTimeBlocks);
  const createTimeBlock = useTimeBlockStore((s) => s.createTimeBlock);
  const updateTimeBlock = useTimeBlockStore((s) => s.updateTimeBlock);

  const tasks     = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const updateTask = useTaskStore((s) => s.updateTask);

  const cfg = useMemo(() => viewConfig(view), [view]);

  const events = useMemo(() => timeBlocks.map((b) => ({
    id: b.id, title: b.title, start: b.startTime, end: b.endTime,
    backgroundColor: b.color ?? "#3f3f46", borderColor: b.color ?? "#3f3f46", textColor: "#fafafa",
    extendedProps: { timeBlockType: b.type, taskId: b.taskId },
  })), [timeBlocks]);

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

  const [popover, setPopover]       = useState<{ timeBlockId: string; x: number; y: number } | null>(null);
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
    api.changeView(type, duration ? { duration } : undefined);
  };

  const todayLabel = useMemo(() =>
    new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    []
  );

  const VIEW_LABELS: [ViewKey, string][] = [["1d","Day"],["2d","2D"],["3d","3D"],["4d","4D"],["week","Week"],["month","Month"]];

  return (
    <div className="flex h-full w-full flex-col">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-zinc-200">
              {dashboardMode ? todayLabel : "Calendar"}
            </span>
          </div>
          {!dashboardMode && (
            <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
              {VIEW_LABELS.map(([key, label]) => (
                <button key={key} type="button" onClick={() => switchView(key)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                    view === key ? "bg-white/10 text-zinc-100" : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >{label}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {!hideSidebar && (
          <div className="w-64 flex-none border-r border-white/[0.06]">
            <div className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-700">Tasks</div>
            <div ref={taskPanelRef} className="px-2 pb-4">
              {incompleteTasks.length === 0
                ? <div className="px-3 py-6 text-xs text-zinc-700 text-center">No incomplete tasks</div>
                : incompleteTasks.map((t) => (
                  <div key={t.id} data-task-id={t.id} data-task-title={t.title}
                    className="cursor-grab mb-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 active:cursor-grabbing transition-colors"
                  >{t.title || "(Untitled)"}</div>
                ))}
            </div>
          </div>
        )}

        <div className="flex-1 p-2"
          style={{
            ["--fc-today-bg-color" as any]: "rgba(255,255,255,0.025)",
            ["--fc-border-color" as any]: "rgba(255,255,255,0.07)",
            ["--fc-neutral-bg-color" as any]: "rgba(255,255,255,0.02)",
            ["--fc-page-bg-color" as any]: "transparent",
            ["--fc-small-font-size" as any]: "0.78rem",
          } as React.CSSProperties}
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
              slotMinTime="05:00:00"
              slotMaxTime="23:00:00"
              editable droppable weekends
              events={events}
              dateClick={(arg: DateClickArg) => {
                const start = arg.date.toISOString();
                void createTimeBlock({ type: "event", title: "New Block", startTime: start, endTime: addMins(start, 30), color: "#3f3f46" });
              }}
              eventClick={(arg) => {
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
                    await createTimeBlock({ type: "routine", routineTemplateId, title, startTime: start, endTime: end, color: color || "#3f3f46" });
                  } else if (taskId) {
                    await createTimeBlock({ type: "task", taskId, title, startTime: start, endTime: end, color: "#3f3f46" });
                    await updateTask(taskId, { scheduledStart: start, scheduledEnd: end });
                  }
                })();
              }}
              eventClassNames={() => ["rounded-lg"]}
              dayHeaderClassNames={() => ["text-zinc-500 text-xs"]}
              slotLabelClassNames={() => ["text-zinc-700 text-xs"]}
            />
          </div>
        </div>
      </div>

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
            setTemplatePrefill({ title: activeBlock.title, startTime: hhmm(s), endTime: hhmm(e), color: activeBlock.color ?? "#3f3f46", icon: "⏱️", daysOfWeek: [], isBuiltIn: false });
            setRoutineOpen(true);
          }}
        />
      )}
      <RoutineTemplatePanel open={routineOpen} onClose={() => { setRoutineOpen(false); setTemplatePrefill(null); }} prefill={templatePrefill} />
    </div>
  );
}
