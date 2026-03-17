"use client";

import { useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { Settings } from "lucide-react";
import {
  Separator as ResizableHandle,
  Panel as ResizablePanel,
  Group as ResizablePanelGroup,
} from "react-resizable-panels";
import { CalendarView } from "@/components/CalendarView";
import { RoutineTemplatePanel } from "@/components/RoutineTemplatePanel";
import { RoutineChip } from "@/components/RoutineChip";
import { useTaskStore } from "@/store/taskStore";
import { useRoutineTemplateStore } from "@/store/routineTemplateStore";

export default function Page() {
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);
  const [routinesExpanded, setRoutinesExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("routines-sidebar-expanded") === "true";
  });

  const tasks             = useTaskStore((s) => s.tasks);
  const templates         = useRoutineTemplateStore((s) => s.templates);
  const isLoadingRoutines = useRoutineTemplateStore((s) => s.isLoading);
  const loadTemplates     = useRoutineTemplateStore((s) => s.loadTemplates);

  // Unscheduled incomplete tasks only — same set as Tasks tab
  const incompleteTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled" && !t.scheduledStart,
  );

  // Built-in templates first, then custom
  const pinnedTemplates   = templates.filter((t) => t.pinned === true).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const overflowTemplates = templates.filter((t) => t.pinned !== true);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  // Draggable for routine chips (pinned + overflow share one container)
  const routineContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = routineContainerRef.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: "[data-template-id]",
      eventData: (eventEl) => {
        const ds = (eventEl as HTMLElement).dataset;
        return {
          title: ds.templateTitle || "Routine",
          duration: ds.templateDuration || "01:00",
          backgroundColor: ds.templateColor,
          borderColor: "transparent",
          extendedProps: { routineTemplateId: ds.templateId, type: "routine" },
        };
      },
    });
    return () => draggable.destroy();
  }, [templates]);

  // Draggable for unscheduled tasks
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

  const toggleExpanded = () => {
    const next = !routinesExpanded;
    setRoutinesExpanded(next);
    localStorage.setItem("routines-sidebar-expanded", String(next));
  };

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
            display: "flex", flexDirection: "column",
            height: "100%", overflow: "hidden",
            borderRight: "1px solid var(--border, rgba(0,0,0,0.08))",
            minWidth: 0,
            background: "var(--bg-sidebar, #faf9f7)",
          }}
        >
          {/* ── ROUTINES ── */}
          <div style={{ flexShrink: 0, padding: "12px 12px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-muted, #888)" }}>
                Routines
              </span>
              <button
                type="button"
                onClick={() => setRoutinePanelOpen(true)}
                title="Manage Templates"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, borderRadius: 6,
                  border: "none", background: "transparent",
                  color: "var(--fg-faint, #bbb)", cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.05))"; e.currentTarget.style.color = "var(--fg-muted, #888)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-faint, #bbb)"; }}
              >
                <Settings size={13} />
              </button>
            </div>

            <div style={{
              background: "var(--bg-card, #fff)",
              borderRadius: 12,
              border: "1px solid var(--border, rgba(0,0,0,0.08))",
              padding: 8,
            }}>
              {isLoadingRoutines ? (
                <div style={{ textAlign: "center", padding: "14px 0", fontSize: "11px", color: "var(--fg-faint, #bbb)" }}>Loading…</div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "14px 0", fontSize: "11px", color: "var(--fg-faint, #bbb)", fontStyle: "italic" }}>
                  No templates — click ⚙ to add one
                </div>
              ) : (
                /* Single ref wraps pinned + overflow so both are draggable */
                <div ref={routineContainerRef}>
                  {/* Pinned row */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pinnedTemplates.map((t) => <RoutineChip key={t.id} template={t} draggable />)}
                    {overflowTemplates.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleExpanded}
                        style={{
                          display: "flex", alignItems: "center",
                          padding: "4px 8px", borderRadius: 8,
                          border: "1px dashed var(--border, rgba(0,0,0,0.14))",
                          background: "transparent",
                          fontSize: "11px", fontWeight: 500,
                          color: "var(--fg-faint, #999)", cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        {routinesExpanded ? "▾ less" : `+ ${overflowTemplates.length} more`}
                      </button>
                    )}
                  </div>

                  {/* Expandable overflow */}
                  <div style={{
                    maxHeight: routinesExpanded ? "400px" : 0,
                    overflow: "hidden",
                    transition: "max-height 280ms ease",
                  }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 6 }}>
                      {overflowTemplates.map((t) => <RoutineChip key={t.id} template={t} draggable />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── UNSCHEDULED TASKS ── */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            overflow: "hidden", minHeight: 0,
            borderTop: "1px solid var(--border, rgba(0,0,0,0.06))",
          }}>
            <div style={{
              flexShrink: 0, padding: "10px 16px",
              borderBottom: "1px solid var(--border, rgba(0,0,0,0.06))",
              background: "var(--bg-sidebar, #faf9f7)",
            }}>
              <h3 style={{
                fontSize: "10px", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.1em",
                color: "var(--fg-muted, #888)", margin: 0,
              }}>
                Unscheduled Tasks
              </h3>
            </div>

            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              <div ref={taskPanelRef} style={{ padding: "10px 12px", minWidth: 0 }}>
                {incompleteTasks.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "28px 8px",
                    fontSize: "12px", color: "var(--fg-faint, #bbb)", fontStyle: "italic",
                  }}>
                    No open tasks
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                    {incompleteTasks.map((t) => (
                      <div
                        key={t.id}
                        data-task-id={t.id}
                        data-task-title={t.title}
                        style={{
                          cursor: "grab",
                          display: "flex", alignItems: "center",
                          minWidth: 0, padding: "8px 10px",
                          borderRadius: 9,
                          border: "1px solid var(--border, rgba(0,0,0,0.07))",
                          background: "var(--bg-card, #fff)",
                          color: "var(--fg-muted, #666)",
                        }}
                      >
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: "var(--fg-faint, #ccc)",
                          marginRight: 9, flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: "12px",
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", minWidth: 0, flex: 1,
                        }}>
                          {t.title || "(Untitled)"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        {/* Resize handle */}
        <ResizableHandle
          id="calendar-h-handle"
          style={{
            width: "8px", height: "100%", cursor: "col-resize",
            background: "transparent", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
            borderLeft: "1px solid var(--border, rgba(0,0,0,0.08))",
            borderRight: "1px solid var(--border, rgba(0,0,0,0.08))",
          }}
        >
          <div style={{ width: "3px", height: "32px", borderRadius: "9999px", background: "rgba(0,0,0,0.15)" }} />
        </ResizableHandle>

        {/* ── Main calendar ── */}
        <ResizablePanel
          id="calendar-main-panel"
          defaultSize="72%"
          minSize="55%"
          style={{ overflow: "hidden", padding: "16px", height: "100%" }}
        >
          <div style={{
            height: "100%", borderRadius: "16px", overflow: "hidden",
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
