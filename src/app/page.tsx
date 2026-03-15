"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import {
  Separator as ResizableHandle,
  Panel as ResizablePanel,
  Group as ResizablePanelGroup
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
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const today = new Date().toISOString().split("T")[0];

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
          extendedProps: { taskId, type: 'task' },
        };
      },
    });
    return () => draggable.destroy();
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen w-full bg-zinc-950 overflow-hidden flex">
        {/* Fixed placeholders that match requested proportions */}
        <div style={{ width: '55%' }} className="flex flex-col border-r border-white/5 h-full" />
        <div style={{ width: '45%' }} className="flex flex-col h-full bg-zinc-900/10" />
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
        {/* Left Column (55%) */}
        <ResizablePanel
          id="dashboard-left-panel"
          defaultSize={55}
          minSize={30}
          maxSize={70}
          className="flex flex-col border-r border-white/5 h-full relative"
        >
          <ResizablePanelGroup orientation="vertical" id="dashboard-left-vertical-group">
            {/* Top: Daily Note */}
            <ResizablePanel id="dashboard-daily-note-panel" defaultSize={50} minSize={20}>
              <div className="h-full overflow-y-auto pb-8">
                <DailyNote />
              </div>
            </ResizablePanel>

            <ResizableHandle
              id="dashboard-vertical-handle"
              className="relative h-2 w-full bg-transparent hover:bg-white/5 transition-colors cursor-row-resize z-[100] group"
              style={{ touchAction: 'none' }}
            >
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px w-full bg-white/10 group-hover:bg-white/20" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-1.5 w-10 rounded-full bg-white/20 border border-white/10 shadow-lg" />
              </div>
            </ResizableHandle>

            {/* Bottom: Today's Focus */}
            <ResizablePanel id="dashboard-tasks-panel" defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col overflow-hidden bg-zinc-900/50">
                <div className="p-6 pb-2">
                  <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                    Today&apos;s Focus
                  </h2>
                </div>
                <div ref={taskListRef} className="flex-1 overflow-y-auto px-3 pb-8">
                  <Suspense fallback={<div className="p-6 text-zinc-500 text-sm">Loading tasks...</div>}>
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
          style={{ touchAction: 'none' }}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/10 group-hover:bg-white/20" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-10 rounded-full bg-white/20 border border-white/10 shadow-lg" />
          </div>
        </ResizableHandle>

        {/* Right Column (45%) */}
        <ResizablePanel
          id="dashboard-right-panel"
          defaultSize={45}
          minSize={30}
          maxSize={60}
          className="flex flex-col h-full bg-zinc-900/10"
        >
          {/* Top: 1-Day Calendar */}
          <div className="flex-1 overflow-hidden p-6 pb-0">
            <div className="h-full rounded-2xl border border-white/5 bg-zinc-900/40 shadow-2xl overflow-hidden backdrop-blur-sm">
              <CalendarView
                dashboardMode={true}
                hideSidebar={true}
              />
            </div>
          </div>

          {/* Bottom: Routine Strip */}
          <div className="h-72 flex-none p-6 pt-4">
            <div className="h-full rounded-2xl border border-white/5 bg-zinc-900/40 p-1 overflow-hidden">
              <RoutineTemplateStrip onManageTemplates={() => setRoutinePanelOpen(true)} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Detail Modal Overlay */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          position={clickPos}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Slide-over panels for Routine Templates */}
      <RoutineTemplatePanel
        open={routinePanelOpen}
        onClose={() => setRoutinePanelOpen(false)}
      />
      {/* Selection detail modal for tasks */}
      {selectedTask && clickPos && (
        <TaskDetailModal
          task={selectedTask}
          position={clickPos}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
