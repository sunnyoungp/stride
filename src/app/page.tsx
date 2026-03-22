"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
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
import { useTimeBlockStore } from "@/store/timeBlockStore";
import { useIsMobile } from "@/hooks/useIsMobile";

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDashboardDate(date: string, today: string): string {
  const d = new Date(date + "T00:00:00");
  const dayStr = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
  }).format(d);
  const diff = Math.round(
    (new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000,
  );
  if (diff === 0)  return `Today, ${dayStr}`;
  if (diff === -1) return `Yesterday, ${dayStr}`;
  if (diff === 1)  return `Tomorrow, ${dayStr}`;
  return dayStr;
}

export default function Page() {
  const [selectedTaskId, setSelectedTaskId]     = useState<string | null>(null);
  const [clickPos, setClickPos]                 = useState({ x: 0, y: 0 });
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);
  const [mobileTab, setMobileTab]               = useState<"note" | "tasks" | "calendar">("note");
  const isMobile = useIsMobile();

  const tasks             = useTaskStore((s) => s.tasks);
  const updateTask        = useTaskStore((s) => s.updateTask);
  const createTask        = useTaskStore((s) => s.createTask);
  const createTimeBlock   = useTimeBlockStore((s) => s.createTimeBlock);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const [today, setToday] = useState<string>(() => localDateString(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const now = localDateString(new Date());
      setToday((prev) => (prev !== now ? now : prev));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(today);
  useEffect(() => { setSelectedDate(today); }, [today]);

  const [contentDimmed, setContentDimmed] = useState(false);
  useEffect(() => {
    setContentDimmed(true);
    const t = setTimeout(() => setContentDimmed(false), 150);
    return () => clearTimeout(t);
  }, [selectedDate]);

  const taskListRef = useRef<HTMLDivElement>(null);

  const handleTaskPanelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData("text/block-type");
    const taskId    = e.dataTransfer.getData("text/task-id")    || e.dataTransfer.getData("stride/taskId")    || "";
    const title     = e.dataTransfer.getData("text/task-title") || e.dataTransfer.getData("stride/taskTitle") || e.dataTransfer.getData("text/plain") || "";

    if (blockType === "task") {
      if (taskId) {
        void updateTask(taskId, { dueDate: selectedDate });
      } else if (title) {
        void createTask({ title, status: "todo", dueDate: selectedDate });
      }
    } else if (blockType === "note") {
      if (title) void createTask({ title, status: "todo", dueDate: selectedDate });
    } else {
      // Backward compat: old drag format without block-type
      if (taskId) {
        void updateTask(taskId, { dueDate: selectedDate });
      } else if (title) {
        void createTask({ title, status: "todo", dueDate: selectedDate });
      }
    }
  };

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

  const selectedDateTaskCount = tasks.filter(
    (t) => t.dueDate?.startsWith(selectedDate) && t.status !== "done" && t.status !== "cancelled" && !t.parentTaskId,
  ).length;

  /* ── Mobile single-column layout ── */
  if (isMobile) {
    const TABS = [
      { id: "note" as const,     label: "Notes"    },
      { id: "tasks" as const,    label: "Tasks"    },
      { id: "calendar" as const, label: "Calendar" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Date nav */}
        <div style={{ flexShrink: 0, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button type="button" onClick={() => setSelectedDate((p) => shiftDate(p, -1))} aria-label="Previous day"
              style={{ fontSize: "18px", lineHeight: 1, color: "rgba(0,0,0,0.3)", cursor: "pointer", border: "none", background: "transparent", padding: "4px 8px", borderRadius: 6 }}>‹</button>
            <span onDoubleClick={() => setSelectedDate(today)} style={{ fontSize: "14px", fontWeight: 500, minWidth: 180, textAlign: "center", display: "inline-block", color: selectedDate !== today ? "rgba(0,0,0,0.38)" : "var(--fg, #1a1a1a)", userSelect: "none" }}>
              {formatDashboardDate(selectedDate, today)}
            </span>
            <button type="button" onClick={() => setSelectedDate((p) => shiftDate(p, 1))} aria-label="Next day"
              style={{ fontSize: "18px", lineHeight: 1, color: "rgba(0,0,0,0.3)", cursor: "pointer", border: "none", background: "transparent", padding: "4px 8px", borderRadius: 6 }}>›</button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ flexShrink: 0, display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setMobileTab(tab.id)}
              style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: mobileTab === tab.id ? 600 : 400,
                color: mobileTab === tab.id ? "var(--accent)" : "var(--fg-muted)",
                background: "transparent", border: "none", borderBottom: mobileTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer", transition: "all 120ms ease" }}>
              {tab.label}{tab.id === "tasks" && selectedDateTaskCount > 0 ? ` (${selectedDateTaskCount})` : ""}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "hidden", opacity: contentDimmed ? 0.6 : 1, transition: "opacity 150ms ease" }}>
          {mobileTab === "note" && (
            <div style={{ height: "100%", overflowY: "auto" }}>
              <DailyNote selectedDate={selectedDate} onDateChange={setSelectedDate} />
            </div>
          )}
          {mobileTab === "tasks" && (
            <div ref={taskListRef} className="task-drop-zone mobile-scroll-content" style={{ height: "100%", overflowY: "auto" }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => { e.preventDefault(); e.currentTarget.setAttribute("data-drag-over", "true"); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.removeAttribute("data-drag-over"); }}
              onDrop={(e) => { e.currentTarget.removeAttribute("data-drag-over"); handleTaskPanelDrop(e); }}
            >
              <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint, #999)" }}>
                  {selectedDate === today ? "Today's Focus" : "Tasks"}
                </h2>
                {selectedDateTaskCount > 0 && <span style={{ fontSize: "11px", color: "var(--fg-faint, #999)" }}>{selectedDateTaskCount}</span>}
              </div>
              <Suspense fallback={<div style={{ padding: "16px", fontSize: "12px", color: "#999" }}>Loading…</div>}>
                <TaskListView filterDate={selectedDate} onTaskClick={(task, pos) => { setSelectedTaskId(task.id); setClickPos(pos); }} />
              </Suspense>
            </div>
          )}
          {mobileTab === "calendar" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px" }}>
              <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <CalendarView dashboardMode={true} hideSidebar={true} selectedDate={selectedDate}
                  onExternalDrop={({ date, title, taskId, blockType }) => {
                    const startTime = date.toISOString();
                    const endTime   = new Date(date.getTime() + 30 * 60_000).toISOString();
                    void (async () => {
                      if (taskId) {
                        await createTimeBlock({ type: "task", taskId, title, startTime, endTime, color: "#f4714a" });
                        await updateTask(taskId, { scheduledStart: startTime, scheduledEnd: endTime, dueDate: selectedDate });
                      } else if (title) {
                        await createTimeBlock({ type: "event", title, startTime, endTime, color: "#f4714a" });
                        if (blockType === "note") await createTask({ title, status: "todo", dueDate: selectedDate });
                      }
                    })();
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {selectedTask && (
          <TaskDetailModal task={selectedTask} position={clickPos} onClose={() => setSelectedTaskId(null)} />
        )}
        <RoutineTemplatePanel open={routinePanelOpen} onClose={() => setRoutinePanelOpen(false)} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>

      {/* ── Date navigation header ── */}
      <div style={{
        flexShrink: 0, height: 44,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Left chevron */}
          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
            aria-label="Previous day"
            style={{
              fontSize: "18px", lineHeight: 1,
              color: "rgba(0,0,0,0.3)", cursor: "pointer",
              border: "none", background: "transparent",
              padding: "4px 8px", borderRadius: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(0,0,0,0.7)"; e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(0,0,0,0.3)"; e.currentTarget.style.background = "transparent"; }}
          >‹</button>

          {/* Date label */}
          <span
            onDoubleClick={() => setSelectedDate(today)}
            title={selectedDate !== today ? "Double-click to return to today" : undefined}
            style={{
              fontSize: "14px", fontWeight: 500,
              minWidth: 180, textAlign: "center", display: "inline-block",
              color: selectedDate !== today ? "rgba(0,0,0,0.38)" : "var(--fg, #1a1a1a)",
              cursor: selectedDate !== today ? "default" : "default",
              userSelect: "none",
            }}
          >
            {formatDashboardDate(selectedDate, today)}
          </span>

          {/* Right chevron */}
          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
            aria-label="Next day"
            style={{
              fontSize: "18px", lineHeight: 1,
              color: "rgba(0,0,0,0.3)", cursor: "pointer",
              border: "none", background: "transparent",
              padding: "4px 8px", borderRadius: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(0,0,0,0.7)"; e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(0,0,0,0.3)"; e.currentTarget.style.background = "transparent"; }}
          >›</button>
        </div>
      </div>

      {/* ── Panels ── */}
      <ResizablePanelGroup
        orientation="horizontal"
        id="dashboard-main-group"
        style={{ flex: 1, overflow: "hidden" }}
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
              <div style={{ opacity: contentDimmed ? 0.6 : 1, transition: "opacity 150ms ease" }}>
                <DailyNote selectedDate={selectedDate} onDateChange={setSelectedDate} />
              </div>
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

            {/* Focus tasks for selected date */}
            <ResizablePanel
              id="dashboard-tasks-panel"
              defaultSize="50%"
              minSize="20%"
              style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <div style={{ flexShrink: 0, display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "20px 24px 12px" }}>
                <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint, #999)" }}>
                  {selectedDate === today ? "Today's Focus" : "Tasks"}
                </h2>
                {selectedDateTaskCount > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--fg-faint, #999)" }}>{selectedDateTaskCount}</span>
                )}
              </div>
              <div
                ref={taskListRef}
                className="task-drop-zone"
                style={{ flex: 1, overflowY: "auto", opacity: contentDimmed ? 0.6 : 1, transition: "opacity 150ms ease" }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => { e.preventDefault(); e.currentTarget.setAttribute("data-drag-over", "true"); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.removeAttribute("data-drag-over"); }}
                onDrop={(e) => { e.currentTarget.removeAttribute("data-drag-over"); handleTaskPanelDrop(e); }}
              >
                <Suspense fallback={<div style={{ padding: "16px 24px", fontSize: "12px", color: "#999" }}>Loading…</div>}>
                  <TaskListView
                    filterDate={selectedDate}
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
              <CalendarView
                dashboardMode={true}
                hideSidebar={true}
                selectedDate={selectedDate}
                onExternalDrop={({ date, title, taskId, blockType }) => {
                  const startTime = date.toISOString();
                  const endTime   = new Date(date.getTime() + 30 * 60_000).toISOString();
                  void (async () => {
                    if (taskId) {
                      await createTimeBlock({ type: "task", taskId, title, startTime, endTime, color: "#f4714a" });
                      await updateTask(taskId, { scheduledStart: startTime, scheduledEnd: endTime, dueDate: selectedDate });
                    } else if (title) {
                      await createTimeBlock({ type: "event", title, startTime, endTime, color: "#f4714a" });
                      if (blockType === "note") await createTask({ title, status: "todo", dueDate: selectedDate });
                    }
                  })();
                }}
              />
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