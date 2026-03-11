"use client";

import { useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { CalendarView } from "@/components/CalendarView";
import { RoutineTemplateStrip } from "@/components/RoutineTemplateStrip";
import { RoutineTemplatePanel } from "@/components/RoutineTemplatePanel";
import { useTaskStore } from "@/store/taskStore";

export default function Page() {
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);
  const tasks = useTaskStore((s) => s.tasks);
  const incompleteTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

  const taskPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = taskPanelRef.current;
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
  }, [incompleteTasks]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-950">
      {/* Sidebar: Tasks panel + Routines */}
      <div className="flex w-[300px] flex-none flex-col border-r border-white/5 bg-zinc-900/10">
        {/* Draggable Tasks Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Unscheduled Tasks</h3>
          </div>
          <div ref={taskPanelRef} className="p-3">
            {incompleteTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-600 italic">No open tasks</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {incompleteTasks.map((t) => (
                  <div
                    key={t.id}
                    data-task-id={t.id}
                    data-task-title={t.title}
                    className="cursor-grab relative flex items-center p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-sm text-zinc-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 mr-3 flex-none" />
                    <span className="truncate">{t.title || "(Untitled)"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Routine Strip */}
        <div className="h-80 border-t border-white/5 bg-zinc-900/30">
          <RoutineTemplateStrip onManageTemplates={() => setRoutinePanelOpen(true)} />
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="h-full rounded-2xl border border-white/5 bg-zinc-900/20 shadow-inner overflow-hidden">
          <CalendarView hideSidebar={true} />
        </div>
      </div>

      <RoutineTemplatePanel 
        open={routinePanelOpen} 
        onClose={() => setRoutinePanelOpen(false)} 
      />
    </div>
  );
}
