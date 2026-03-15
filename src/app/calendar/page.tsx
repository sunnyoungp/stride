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
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);

  const tasks = useTaskStore((s) => s.tasks);
  // FIX: derive selectedTask reactively from tasks store, not a stale local copy
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
        const title = (eventEl as HTMLElement).dataset.taskTitle ?? "Task";
        return {
          title,
          duration: "00:30",
          extendedProps: { taskId, type: "task" },
        };
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
        <div style={{ width: "45%" }} className="flex flex-col h-full bg-zinc-900/10" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-950 overflow-hidden">
      <ResizablePanelGroup
        orientation="horizontal"
        id="dashboard-main-group"
        className="h-full w-full"
      >
        {/* Left Column */}
        <ResizablePanel
          id="dashboard-left-panel"
          defaultSize={55}
          minSize={30}
          maxSize={70}
          className="flex flex-col border-r border-white/5 h-full relative"
        >
          <ResizablePanelGroup orientation="vertical" id="dashboard-left-vertical-group">
            {/* Daily Note */}
            <ResizablePanel id="dashboard-daily-note-panel" defaultSize={50} minSize={20}>
              <div className="h-full overflow-y-auto pb-8">
                <DailyNote />
              </div>
            </ResizablePanel>

            <ResizableHandle
              id="dashboard-vertical-handle"
              className="relative h-2 w-full bg-transparent hover:bg-white/5 transition-colors cursor-row-resize z-[100] group"
              style={{ touchAction: "none" }}
            >
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px w-full bg-white/8 group-hover:bg-white/20" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-1 w-8 rounded-full bg-white/15 border border-white/10" />
              </div>
            </ResizableHandle>

            {/* Today's Focus */}
            <ResizablePanel id="dashboard-tasks-panel" defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col overflow-hidden bg-zinc-900/30">
                <div className="px-6 pt-5 pb-2 flex items-center justify-between flex-none border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1 h-5 bg-blue-500 rounded-full" />
                    <h2 className="text-sm font-semibold text-zinc-200 tracking-tight">Today&apos;s Focus</h2>
                  </div>
                  <span className="text-[11px] text-zinc-600 tabular-nums">
                    {tasks.filter((t) => t.dueDate?.startsWith(today) && t.status !== "done" && t.status !== "cancelled").length} tasks
                  </span>
                </div>
                <div ref={taskListRef} className="flex-1 overflow-y-auto">
                  <Suspense fallback={<div className="p-6 text-zinc-600 text-xs">Loading…</div>}>
                    <TaskListView
                      filterDate={today}
                      onTaskClick={(task, pos) => {
                        setSelectedTaskId(task.id);
                        setClickPos(pos);
                      }}
                    />
                  </Suspense>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle
          id="dashboard-horizontal-handle"
          className="relative w-2 h-full bg-transparent hover:bg-white/5 transition-colors cursor-col-resize z-[100] group"
          style={{ touchAction: "none" }}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/8 group-hover:bg-white/20" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-1 h-8 rounded-full bg-white/15 border border-white/10" />
          </div>
        </ResizableHandle>

        {/* Right Column */}
        <ResizablePanel
          id="dashboard-right-panel"
          defaultSize={45}
          minSize={30}
          maxSize={60}
          className="flex flex-col h-full bg-zinc-900/10"
        >
          {/* Calendar */}
          <div className="flex-1 overflow-hidden p-4 pb-0">
            <div className="h-full rounded-2xl border border-white/5 bg-zinc-900/40 shadow-2xl overflow-hidden">
              <CalendarView dashboardMode={true} hideSidebar={true} />
            </div>
          </div>

          {/* Routine Strip */}
          <div className="h-64 flex-none p-4 pt-3">
            <div className="h-full rounded-2xl border border-white/5 bg-zinc-900/40 overflow-hidden">
              <RoutineTemplateStrip onManageTemplates={() => setRoutinePanelOpen(true)} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* FIX: Only one TaskDetailModal, not two */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          position={clickPos}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      <RoutineTemplatePanel
        open={routinePanelOpen}
        onClose={() => setRoutinePanelOpen(false)}
      />
    </div>
  );
}
