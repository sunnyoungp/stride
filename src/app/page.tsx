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
  const [selectedTaskId, setSelectedTaskId]     = useState<string | null>(null);
  const [clickPos, setClickPos]                 = useState({ x: 0, y: 0 });
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);

  const tasks        = useTaskStore((s) => s.tasks);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const today        = new Date().toISOString().split("T")[0]!;

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

  if (!mounted) return <div className="h-screen w-full" />;

  const todayTaskCount = tasks.filter(
    (t) => t.dueDate?.startsWith(today) && t.status !== "done" && t.status !== "cancelled" && !t.parentTaskId,
  ).length;

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden" }}>
      {/* ── Left column (55%) ── */}
      <ResizablePanelGroup
        orientation="horizontal"
        id="dashboard-main-group"
        style={{ flex: 1, height: "100%" }}
      >
        <ResizablePanel
          id="dashboard-left-panel"
          defaultSize="55%"
          minSize="35%"
          maxSize="70%"
          style={{ display: "flex", flexDirection: "column", height: "100%", borderRight: "1px solid var(--border, rgba(0,0,0,0.08))" }}
        >
          {/* Inner vertical split */}
          <ResizablePanelGroup
            orientation="vertical"
            id="dashboard-left-vertical"
            style={{ flex: 1, height: "100%" }}
          >
            {/* Daily Note */}
            <ResizablePanel
              id="dashboard-note-panel"
              defaultSize="50%"
              minSize="20%"
              style={{ overflow: "auto" }}
            >
              <DailyNote />
            </ResizablePanel>

            {/* Vertical handle */}
            <ResizableHandle
              id="dashboard-v-handle"
              style={{
                height: "8px",
                width: "100%",
                cursor: "row-resize",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                borderTop: "1px solid var(--border, rgba(0,0,0,0.08))",
                borderBottom: "1px solid var(--border, rgba(0,0,0,0.08))",
              }}
            >
              <div style={{
                width: "32px",
                height: "3px",
                borderRadius: "9999px",
                background: "rgba(0,0,0,0.15)",
              }} />
            </ResizableHandle>

            {/* Today's Focus */}
            <ResizablePanel
              id="dashboard-tasks-panel"
              defaultSize="50%"
              minSize="20%"
              style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <div style={{ flexShrink: 0, display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "20px 24px 12px" }}>
                <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint, #999)" }}>
                  Today&apos;s Focus
                </h2>
                {todayTaskCount > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--fg-faint, #999)" }}>{todayTaskCount}</span>
                )}
              </div>
              <div ref={taskListRef} style={{ flex: 1, overflowY: "auto" }}>
                <Suspense fallback={<div style={{ padding: "16px 24px", fontSize: "12px", color: "#999" }}>Loading…</div>}>
                  <TaskListView
                    filterDate={today}
                    onTaskClick={(task, pos) => { setSelectedTaskId(task.id); setClickPos(pos); }}
                  />
                </Suspense>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        {/* Horizontal handle */}
        <ResizableHandle
          id="dashboard-h-handle"
          style={{
            width: "8px",
            height: "100%",
            cursor: "col-resize",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            borderLeft: "1px solid var(--border, rgba(0,0,0,0.08))",
            borderRight: "1px solid var(--border, rgba(0,0,0,0.08))",
          }}
        >
          <div style={{
            width: "3px",
            height: "32px",
            borderRadius: "9999px",
            background: "rgba(0,0,0,0.15)",
          }} />
        </ResizableHandle>

        {/* ── Right column (45%) ── */}
        <ResizablePanel
          id="dashboard-right-panel"
          defaultSize="45%"
          minSize="30%"
          maxSize="65%"
          style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
        >
          {/* Calendar card */}
          <div style={{ flex: 1, overflow: "hidden", padding: "12px 12px 8px" }}>
            <div style={{
              height: "100%",
              borderRadius: "16px",
              overflow: "hidden",
              background: "var(--bg-card, #fff)",
              border: "1px solid var(--border, rgba(0,0,0,0.08))",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <CalendarView dashboardMode={true} hideSidebar={true} />
            </div>
          </div>

          {/* Routine strip */}
          <div style={{ flexShrink: 0, height: "240px", padding: "0 12px 12px" }}>
            <div style={{
              height: "100%",
              borderRadius: "16px",
              overflow: "hidden",
              background: "var(--bg-card, #fff)",
              border: "1px solid var(--border, rgba(0,0,0,0.08))",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <RoutineTemplateStrip onManageTemplates={() => setRoutinePanelOpen(true)} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

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