"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
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

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-950">
      {/* Left Column (55%) */}
      <div className="flex w-[55%] flex-col border-r border-white/5 h-full overflow-hidden">
        {/* Top: Daily Note */}
        <div className="flex-1 overflow-y-auto border-b border-white/5 pb-8">
          <DailyNote />
        </div>
        
        {/* Bottom: Today's Focus */}
        <div className="h-[40%] flex flex-col overflow-hidden bg-zinc-900/50">
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
      </div>

      {/* Right Column (45%) */}
      <div className="flex w-[45%] flex-col h-full bg-zinc-900/10">
        {/* Top: 1-Day Calendar */}
        <div className="flex-1 overflow-hidden p-6 pb-0">
          <div className="h-full rounded-2xl border border-white/5 bg-zinc-900/40 shadow-2xl overflow-hidden backdrop-blur-sm">
            <CalendarView 
              initialView="1d" 
              hideSidebar={true} 
              hideHeader={true} 
            />
          </div>
        </div>
        
        {/* Bottom: Routine Strip */}
        <div className="h-72 flex-none p-6 pt-4">
          <div className="h-full rounded-2xl border border-white/5 bg-zinc-900/40 p-1">
            <RoutineTemplateStrip onManageTemplates={() => setRoutinePanelOpen(true)} />
          </div>
        </div>
      </div>

      {/* Detail Modal Overlay */}
      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          position={clickPos}
          onClose={() => setSelectedTaskId(null)} 
        />
      )}

      {/* Routine Management Panel */}
      <RoutineTemplatePanel 
        open={routinePanelOpen} 
        onClose={() => setRoutinePanelOpen(false)} 
      />
    </div>
  );
}
