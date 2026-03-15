"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import {
  Separator as ResizableHandle,
  Panel as ResizablePanel,
  Group as ResizablePanelGroup,
} from "react-resizable-panels";
import { DailyNote } from "@/components/DailyNote";
import { TaskListView } from "@/components/TaskListView";
import { CalendarView } from "@/components/CalendarView";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { RoutineTemplateStrip } from "@/components/RoutineTemplateStrip";
import { RoutineTemplatePanel } from "@/components/RoutineTemplatePanel";
import { useTaskStore } from "@/store/taskStore";

export default function Page() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clickPos, setClickPos]             = useState({ x: 0, y: 0 });
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);

  const tasks = useTaskStore((s) => s.tasks);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const today = new Date().toISOString().split("T")[0]!;

  const taskListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = taskListRef.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: "[data-task-id]",
      eventData: (eventEl) => {
        const taskId = (eventEl as HTMLElement).dataset.taskId;
        const title  = (eventEl as HTMLElement).dataset.taskTitle ?? "Task";
        return { title, duration: "00:30", extendedProps: { taskId, type: "task" } };
      },
    });
    return () => draggable.destroy();
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="h-screen w-full bg-zinc-950 overflow-hidden flex">
        <div style={{ width: "55%" }} className="flex flex-col border-r border-white/5 h-full" />
        <div style={{ width: "45%" }} className="flex flex-col h-full" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-950 overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" id="dashboard-main-group" className="h-full w-full">

        {/* ── Left column ── */}
        <ResizablePanel id="dashboard-left-panel" defaultSize={55} minSize={30} maxSize={70}
          className="flex flex-col border-r border-white/[0.06] h-full"
        >
          <ResizablePanelGroup orientation="vertical" id="dashboard-left-vertical">

            {/* Daily Note */}
            <ResizablePanel id="dashboard-note-panel" defaultSize={50} minSize={20}>
              <div className="h-full overflow-y-auto">
                <DailyNote />
              </div>
            </ResizablePanel>

            <ResizableHandle id="dashboard-v-handle"
              className="relative h-px w-full bg-white/[0.06] hover:bg-white/10 transition-colors cursor-row-resize z-10"
              style={{ touchAction: "none" }}
            />

            {/* Today's Focus */}
            <ResizablePanel id="dashboard-tasks-panel" defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-2 flex items-center justify-between flex-none">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
                    Today&apos;s Focus
                  </h2>
                  <span className="text-[11px] text-zinc-700 tabular-nums">
                    {tasks.filter((t) =>
                      t.dueDate?.startsWith(today) &&
                      t.status !== "done" &&
                      t.status !== "cancelled" &&
                      !t.parentTaskId
                    ).length} tasks
                  </span>
                </div>
                <div ref={taskListRef} className="flex-1 overflow-y-auto">
                  <Suspense fallback={<div className="p-6 text-zinc-700 text-xs">Loading…</div>}>
                    <TaskListView
                      filterDate={today}
                      onTaskClick={(task, pos) => { setSelectedTaskId(task.id); setClickPos(pos); }}
                    />
                  </Suspense>
                </div>
              </div>
            </ResizablePanel>

          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle id="dashboard-h-handle"
          className="relative w-px h-full bg-white/[0.06] hover:bg-white/10 transition-colors cursor-col-resize z-10"
          style={{ touchAction: "none" }}
        />

        {/* ── Right column ── */}
        <ResizablePanel id="dashboard-right-panel" defaultSize={45} minSize={30} maxSize={60}
          className="flex flex-col h-full"
        >
          {/* Calendar */}
          <div className="flex-1 overflow-hidden p-4 pb-2">
            <div className="h-full rounded-2xl border border-white/[0.06] bg-zinc-900/30 overflow-hidden">
              <CalendarView dashboardMode={true} hideSidebar={true} />
            </div>
          </div>

          {/* Routine strip */}
          <div className="h-64 flex-none px-4 pb-4">
            <div className="h-full rounded-2xl border border-white/[0.06] bg-zinc-900/30 overflow-hidden">
              <RoutineTemplateStrip onManageTemplates={() => setRoutinePanelOpen(true)} />
            </div>
          </div>
        </ResizablePanel>

      </ResizablePanelGroup>

      {/* FIX: exactly ONE TaskDetailModal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          position={clickPos}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      <RoutineTemplatePanel open={routinePanelOpen} onClose={() => setRoutinePanelOpen(false)} />
    </div>
  );
}
