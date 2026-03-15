"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  Draggable,
  type DateClickArg,
  type EventReceiveArg,
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

function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

// FIX: Return a unified object for changeView. Multi-day views need duration passed
// directly to changeView(), not as a separate setOption() call.
function viewToCalendar(view: ViewKey): { type: string; duration?: { days: number } } {
  switch (view) {
    case "1d":   return { type: "timeGridDay" };
    case "2d":   return { type: "timeGrid", duration: { days: 2 } };
    case "3d":   return { type: "timeGrid", duration: { days: 3 } };
    case "4d":   return { type: "timeGrid", duration: { days: 4 } };
    case "month": return { type: "dayGridMonth" };
    case "week":
    default:     return { type: "timeGridWeek" };
  }
}

function isIncompleteStatus(status: string): boolean {
  return status !== "done" && status !== "cancelled";
}

type Props = {
  initialView?: ViewKey;
  hideSidebar?: boolean;
  hideHeader?: boolean;
  dashboardMode?: boolean;
};

export function CalendarView({
  initialView = "week",
  hideSidebar = false,
  hideHeader = false,
  dashboardMode = false,
}: Props) {
  const [view, setView] = useState<ViewKey>(dashboardMode ? "1d" : initialView);
  const calendarRef = useRef<FullCalendar | null>(null);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [templatePrefill, setTemplatePrefill] = useState<Partial<RoutineTemplate> | null>(null);

  const timeBlocks = useTimeBlockStore((s) => s.timeBlocks);
  const loadTimeBlocks = useTimeBlockStore((s) => s.loadTimeBlocks);
  const createTimeBlock = useTimeBlockStore((s) => s.createTimeBlock);
  const updateTimeBlock = useTimeBlockStore((s) => s.updateTimeBlock);

  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const updateTask = useTaskStore((s) => s.updateTask);

  const selectedCalendarView = useMemo(() => viewToCalendar(view), [view]);

  const events = useMemo(
    () =>
      timeBlocks.map((b) => ({
        id: b.id,
        title: b.title,
        start: b.startTime,
        end: b.endTime,
        backgroundColor: b.color ?? "#52525b",
        borderColor: b.color ?? "#52525b",
        textColor: "#fafafa",
        extendedProps: {
          timeBlockType: b.type,
          taskId: b.taskId,
        },
      })),
    [timeBlocks],
  );

  useEffect(() => {
    void loadTimeBlocks();
    void loadTasks();
  }, [loadTasks, loadTimeBlocks]);

  const incompleteTasks = useMemo(() => tasks.filter((t) => isIncompleteStatus(t.status)), [tasks]);

  const taskPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = taskPanelRef.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: "[data-task-id]",
      eventData: (eventEl) => {
        const taskId = (eventEl as HTMLElement).dataset.taskId;
        const title = (eventEl as HTMLElement).dataset.taskTitle ?? "Task";
        return { title, duration: "00:30", extendedProps: { taskId } };
      },
    });
    return () => draggable.destroy();
  }, []);

  const [popover, setPopover] = useState<{ timeBlockId: string; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ timeBlockId: string; x: number; y: number } | null>(null);

  const activeBlock: TimeBlock | undefined = useMemo(() => {
    const id = popover?.timeBlockId ?? contextMenu?.timeBlockId;
    if (!id) return undefined;
    return timeBlocks.find((b) => b.id === id);
  }, [contextMenu?.timeBlockId, popover?.timeBlockId, timeBlocks]);

  const onDateClick = (arg: DateClickArg) => {
    const start = arg.date.toISOString();
    const end = addMinutes(start, 30);
    void createTimeBlock({ type: "event", title: "New Block", startTime: start, endTime: end, color: "#52525b" });
  };

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date());
  }, []);

  // FIX: changeView for multi-day views must pass duration as second arg, not setOption
  const switchView = (key: ViewKey) => {
    setView(key);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const { type, duration } = viewToCalendar(key);
    if (duration) {
      api.changeView(type, { duration });
    } else {
      api.changeView(type);
    }
  };

  const viewLabels: [ViewKey, string][] = [
    ["1d", "Day"],
    ["2d", "2D"],
    ["3d", "3D"],
    ["4d", "4D"],
    ["week", "Week"],
    ["month", "Month"],
  ];

  return (
    <div className="flex h-full w-full flex-col">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 bg-zinc-900/40 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="text-sm font-semibold text-zinc-100 tracking-tight">
              {dashboardMode ? todayLabel : "Calendar"}
            </span>
          </div>

          {!dashboardMode && (
            <div className="flex items-center gap-0.5 p-1 bg-white/5 rounded-lg border border-white/5">
              {viewLabels.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchView(key)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                    view === key
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {!hideSidebar && (
          <div className="w-[260px] flex-none border-r border-white/8 bg-zinc-950">
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Tasks
            </div>
            <div ref={taskPanelRef} className="px-2 pb-4">
              {incompleteTasks.length === 0 ? (
                <div className="px-3 py-6 text-xs text-zinc-600 text-center">No incomplete tasks</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {incompleteTasks.map((t) => (
                    <div
                      key={t.id}
                      data-task-id={t.id}
                      data-task-title={t.title}
                      className="cursor-grab rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 hover:bg-white/8 hover:border-white/15 active:cursor-grabbing transition-colors"
                    >
                      {t.title || "(Untitled)"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className="flex-1 p-2"
          style={
            {
              ["--fc-today-bg-color" as any]: "rgba(255,255,255,0.03)",
              ["--fc-border-color" as any]: "rgba(255,255,255,0.08)",
              ["--fc-neutral-bg-color" as any]: "rgba(255,255,255,0.02)",
              ["--fc-page-bg-color" as any]: "transparent",
              ["--fc-small-font-size" as any]: "0.8rem",
            } as React.CSSProperties
          }
        >
          <div className="h-full rounded-xl overflow-hidden">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={selectedCalendarView.type}
              // FIX: pass duration at init too for custom day counts
              initialDate={new Date()}
              duration={selectedCalendarView.duration}
              headerToolbar={false}
              height="100%"
              nowIndicator
              allDaySlot={false}
              slotMinTime="05:00:00"
              slotMaxTime="23:00:00"
              weekends
              editable
              droppable
              events={events}
              dateClick={onDateClick}
              eventClick={(arg) => {
                setContextMenu(null);
                setPopover({ timeBlockId: arg.event.id, x: arg.jsEvent.clientX, y: arg.jsEvent.clientY });
              }}
              eventDidMount={(info) => {
                info.el.addEventListener("contextmenu", (e) => {
                  e.preventDefault();
                  setPopover(null);
                  setContextMenu({
                    timeBlockId: info.event.id,
                    x: (e as MouseEvent).clientX,
                    y: (e as MouseEvent).clientY,
                  });
                });
              }}
              eventDrop={(arg) => {
                const start = arg.event.start?.toISOString();
                const end = arg.event.end?.toISOString();
                if (!start || !end) return;
                void updateTimeBlock(arg.event.id, { startTime: start, endTime: end });
              }}
              eventResize={(arg) => {
                const end = arg.event.end?.toISOString();
                if (!end) return;
                void updateTimeBlock(arg.event.id, { endTime: end });
              }}
              eventReceive={(info: EventReceiveArg) => {
                const start = info.event.start?.toISOString();
                const end = info.event.end?.toISOString() ?? (start ? addMinutes(start, 30) : undefined);
                const { taskId, routineTemplateId, type } = info.event.extendedProps as {
                  taskId?: string;
                  routineTemplateId?: string;
                  type?: string;
                };
                const title = info.event.title;
                const backgroundColor = info.event.backgroundColor;
                info.event.remove();
                if (!start || !end) return;

                void (async () => {
                  if (type === "routine" && routineTemplateId) {
                    await createTimeBlock({
                      type: "routine",
                      routineTemplateId,
                      title,
                      startTime: start,
                      endTime: end,
                      color: backgroundColor || "#52525b",
                    });
                  } else if (taskId) {
                    await createTimeBlock({
                      type: "task",
                      taskId,
                      title,
                      startTime: start,
                      endTime: end,
                      color: "#52525b",
                    });
                    await updateTask(taskId, { scheduledStart: start, scheduledEnd: end });
                  }
                })();
              }}
              eventClassNames={() => ["rounded-md"]}
              dayHeaderClassNames={() => ["text-zinc-400 text-xs"]}
              slotLabelClassNames={() => ["text-zinc-600 text-xs"]}
            />
          </div>
        </div>
      </div>

      {popover && activeBlock && (
        <TimeBlockPopover
          timeBlock={activeBlock}
          position={{ x: popover.x, y: popover.y }}
          onClose={() => setPopover(null)}
        />
      )}

      {contextMenu && activeBlock && (
        <TimeBlockContextMenu
          timeBlock={activeBlock}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            setContextMenu(null);
            setPopover({ timeBlockId: activeBlock.id, x: contextMenu.x, y: contextMenu.y });
          }}
          onDelete={() => {
            const blockId = activeBlock.id;
            const taskId = activeBlock.taskId;
            void (async () => {
              await useTimeBlockStore.getState().deleteTimeBlock(blockId);
              if (taskId) {
                await useTaskStore.getState().updateTask(taskId, {
                  scheduledStart: undefined,
                  scheduledEnd: undefined,
                });
              }
            })();
            setContextMenu(null);
          }}
          onSaveAsTemplate={() => {
            const start = new Date(activeBlock.startTime);
            const end = new Date(activeBlock.endTime);
            const toHHmm = (d: Date) =>
              `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            setTemplatePrefill({
              title: activeBlock.title,
              startTime: toHHmm(start),
              endTime: toHHmm(end),
              color: activeBlock.color ?? "#52525b",
              icon: "⏱️",
              daysOfWeek: [],
              isBuiltIn: false,
            });
            setRoutineOpen(true);
          }}
        />
      )}

      <RoutineTemplatePanel
        open={routineOpen}
        onClose={() => { setRoutineOpen(false); setTemplatePrefill(null); }}
        prefill={templatePrefill}
      />
    </div>
  );
}
