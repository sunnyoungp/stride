"use client";

import { useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { 
  Separator as ResizableHandle, 
  Panel as ResizablePanel, 
  Group as ResizablePanelGroup 
} from "react-resizable-panels";
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen w-full bg-zinc-950 overflow-hidden flex">
        <div style={{ width: '25%' }} className="border-r border-white/5 bg-zinc-900/10 h-full overflow-hidden" />
        <div className="flex-1 h-full" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-950 overflow-hidden relative">
      <ResizablePanelGroup 
        orientation="horizontal" 
        id="calendar-main-group"
        className="h-full w-full"
      >
        {/* Sidebar: Tasks panel + Routines */}
        <ResizablePanel 
          id="calendar-sidebar-panel"
          defaultSize={25} 
          minSize={15} 
          maxSize={40}
          className="flex flex-col border-r border-white/5 bg-zinc-900/10 h-full relative"
        >
          {/* Draggable Tasks Panel */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-white/5 sticky top-0 bg-zinc-900/90 backdrop-blur z-10">
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
          <div className="h-80 border-t border-white/5 bg-zinc-900/30 flex-none">
            <RoutineTemplateStrip onManageTemplates={() => setRoutinePanelOpen(true)} />
          </div>
        </ResizablePanel>

        <ResizableHandle 
          id="calendar-horizontal-handle"
          className="relative w-2 h-full bg-transparent hover:bg-white/5 transition-colors cursor-col-resize z-[100] group"
          style={{ touchAction: 'none' }}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/10 group-hover:bg-white/20" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-10 rounded-full bg-white/20 border border-white/10 shadow-lg" />
          </div>
        </ResizableHandle>

        {/* Main Calendar Area */}
        <ResizablePanel 
          id="calendar-main-panel"
          defaultSize={75} 
          minSize={40} 
          className="flex-1 overflow-hidden p-4 h-full"
        >
          <div className="h-full rounded-2xl border border-white/5 bg-zinc-900/20 shadow-inner overflow-hidden">
            <CalendarView hideSidebar={true} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <RoutineTemplatePanel
        open={routinePanelOpen}
        onClose={() => setRoutinePanelOpen(false)}
      />
    </div>
  );
}
