"use client";

import { useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import {
  Separator as ResizableHandle,
  Panel as ResizablePanel,
  Group as ResizablePanelGroup,
} from "react-resizable-panels";
import { CalendarView } from "@/components/CalendarView";
import { RoutineTemplateStrip } from "@/components/RoutineTemplateStrip";
import { RoutineTemplatePanel } from "@/components/RoutineTemplatePanel";
import { useTaskStore } from "@/store/taskStore";

export default function Page() {
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);
  const tasks = useTaskStore((s) => s.tasks);
  const incompleteTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

  const taskPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = taskPanelRef.current;
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
  }, [incompleteTasks]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden" }}>
        <div style={{ width: "28%", borderRight: "1px solid rgba(0,0,0,0.08)", height: "100%" }} />
        <div style={{ flex: 1, height: "100%" }} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100%", overflow: "hidden" }}>
      <ResizablePanelGroup
        orientation="horizontal"
        id="calendar-main-group"
        style={{ height: "100%", width: "100%" }}
      >
        {/* ── Left sidebar ── */}
        <ResizablePanel
          id="calendar-sidebar-panel"
          defaultSize="28%"
          minSize="20%"
          maxSize="45%"
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            borderRight: "1px solid var(--border, rgba(0,0,0,0.08))",
            minWidth: 0,
          }}
        >
          {/* Unscheduled tasks — scrollable */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0, minWidth: 0 }}>
            <div style={{
              padding: "12px 16px",
              position: "sticky",
              top: 0,
              zIndex: 10,
              borderBottom: "1px solid var(--border, rgba(0,0,0,0.08))",
              background: "var(--bg-sidebar, #faf9f7)",
              backdropFilter: "blur(8px)",
            }}>
              <h3 style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-muted, #888)", margin: 0 }}>
                Unscheduled Tasks
              </h3>
            </div>

            <div ref={taskPanelRef} style={{ padding: "12px", minWidth: 0 }}>
              {incompleteTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 8px", fontSize: "12px", color: "var(--fg-faint, #bbb)", fontStyle: "italic" }}>
                  No open tasks
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                  {incompleteTasks.map((t) => (
                    <div
                      key={t.id}
                      data-task-id={t.id}
                      data-task-title={t.title}
                      style={{
                        cursor: "grab",
                        display: "flex",
                        alignItems: "center",
                        minWidth: 0,
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border, rgba(0,0,0,0.08))",
                        background: "var(--bg-card, #fff)",
                        color: "var(--fg-muted, #666)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--fg-faint, #ccc)", marginRight: "10px", flexShrink: 0 }} />
                      <span style={{
                        fontSize: "13px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                        flex: 1,
                      }}>
                        {t.title || "(Untitled)"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Routine strip — fixed height at bottom */}
          <div style={{ flexShrink: 0, height: "256px", borderTop: "1px solid var(--border, rgba(0,0,0,0.08))" }}>
            <RoutineTemplateStrip onManageTemplates={() => setRoutinePanelOpen(true)} />
          </div>
        </ResizablePanel>

        {/* Horizontal resize handle */}
        <ResizableHandle
          id="calendar-h-handle"
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

        {/* ── Main calendar ── */}
        <ResizablePanel
          id="calendar-main-panel"
          defaultSize="72%"
          minSize="55%"
          style={{ overflow: "hidden", padding: "16px", height: "100%" }}
        >
          <div style={{
            height: "100%",
            borderRadius: "16px",
            overflow: "hidden",
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border, rgba(0,0,0,0.08))",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            <CalendarView hideSidebar={true} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <RoutineTemplatePanel open={routinePanelOpen} onClose={() => setRoutinePanelOpen(false)} />
    </div>
  );
}