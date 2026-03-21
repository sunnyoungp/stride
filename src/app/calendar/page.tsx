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
import { useIsMobile } from "@/hooks/useIsMobile";

export default function Page() {
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);
  const [sidebarSheetOpen, setSidebarSheetOpen] = useState(false);
  const isMobile = useIsMobile();
  const [routinesExpanded, setRoutinesExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("routines-sidebar-expanded") === "true";
  });

  const tasks             = useTaskStore((s) => s.tasks);
  const updateTask        = useTaskStore((s) => s.updateTask);
  const createTask        = useTaskStore((s) => s.createTask);
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

  const handleTaskPanelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData("text/block-type");
    const taskId    = e.dataTransfer.getData("text/task-id")    || e.dataTransfer.getData("stride/taskId")    || "";
    const title     = e.dataTransfer.getData("text/task-title") || e.dataTransfer.getData("stride/taskTitle") || e.dataTransfer.getData("text/plain") || "";

    if (blockType === "task") {
      if (taskId) {
        void updateTask(taskId, { dueDate: undefined });
      } else if (title) {
        void createTask({ title, status: "todo" });
      }
    } else if (blockType === "note") {
      if (title) void createTask({ title, status: "todo" });
    } else {
      // Backward compat: old drag format without block-type
      if (taskId) {
        void updateTask(taskId, { dueDate: undefined });
      } else if (title) {
        void createTask({ title, status: "todo" });
      }
    }
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

  /* ── Sidebar content (shared between desktop panel and mobile sheet) ── */
  const sidebarContent = (
    <>
      {/* Routines */}
      <div style={{ flexShrink: 0, padding: "12px 12px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-muted, #888)" }}>
            Routines
          </span>
          <button type="button" onClick={() => setRoutinePanelOpen(true)} title="Manage Templates"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent", color: "var(--fg-faint, #bbb)", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.05))"; e.currentTarget.style.color = "var(--fg-muted, #888)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-faint, #bbb)"; }}
          >
            <Settings size={13} />
          </button>
        </div>
        <div style={{ background: "var(--bg-card, #fff)", borderRadius: 12, border: "1px solid var(--border, rgba(0,0,0,0.08))", padding: 8 }}>
          {isLoadingRoutines ? (
            <div style={{ textAlign: "center", padding: "14px 0", fontSize: "11px", color: "var(--fg-faint, #bbb)" }}>Loading…</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "14px 0", fontSize: "11px", color: "var(--fg-faint, #bbb)", fontStyle: "italic" }}>
              No templates — click ⚙ to add one
            </div>
          ) : (
            <div ref={routineContainerRef}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {pinnedTemplates.map((t) => <RoutineChip key={t.id} template={t} draggable />)}
                {overflowTemplates.length > 0 && (
                  <button type="button" onClick={toggleExpanded}
                    style={{ display: "flex", alignItems: "center", padding: "4px 8px", borderRadius: 8, border: "1px dashed var(--border, rgba(0,0,0,0.14))", background: "transparent", fontSize: "11px", fontWeight: 500, color: "var(--fg-faint, #999)", cursor: "pointer", whiteSpace: "nowrap" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {routinesExpanded ? "▾ less" : `+ ${overflowTemplates.length} more`}
                  </button>
                )}
              </div>
              <div style={{ maxHeight: routinesExpanded ? "400px" : 0, overflow: "hidden", transition: "max-height 280ms ease" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 6 }}>
                  {overflowTemplates.map((t) => <RoutineChip key={t.id} template={t} draggable />)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unscheduled tasks */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, borderTop: "1px solid var(--border, rgba(0,0,0,0.06))" }}>
        <div style={{ flexShrink: 0, padding: "10px 16px", borderBottom: "1px solid var(--border, rgba(0,0,0,0.06))", background: "var(--bg-sidebar, #faf9f7)" }}>
          <h3 style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-muted, #888)", margin: 0 }}>
            Unscheduled Tasks
          </h3>
        </div>
        <div className="task-drop-zone" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => { e.preventDefault(); e.currentTarget.setAttribute("data-drag-over", "true"); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.removeAttribute("data-drag-over"); }}
          onDrop={(e) => { e.currentTarget.removeAttribute("data-drag-over"); handleTaskPanelDrop(e); }}
        >
          <div ref={taskPanelRef} style={{ padding: "10px 12px", minWidth: 0 }}>
            {incompleteTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 8px", fontSize: "12px", color: "var(--fg-faint, #bbb)", fontStyle: "italic" }}>
                No open tasks
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                {incompleteTasks.map((t) => (
                  <div key={t.id} data-task-id={t.id} data-task-title={t.title}
                    style={{ cursor: "grab", display: "flex", alignItems: "center", minWidth: 0, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border, rgba(0,0,0,0.07))", background: "var(--bg-card, #fff)", color: "var(--fg-muted, #666)" }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--fg-faint, #ccc)", marginRight: 9, flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                      {t.title || "(Untitled)"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <div style={{ height: "100%", width: "100%", overflow: "hidden", position: "relative" }}>
        {/* Hamburger button overlay */}
        <button
          type="button"
          onClick={() => setSidebarSheetOpen(true)}
          aria-label="Open sidebar"
          style={{
            position: "absolute", top: 12, left: 12, zIndex: 10,
            width: 36, height: 36, borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--fg-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <line x1="2" y1="4.5" x2="14" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="2" y1="8"   x2="14" y2="8"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="2" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Full-screen calendar */}
        <CalendarView hideSidebar={true} />

        {/* Bottom sheet backdrop */}
        {sidebarSheetOpen && (
          <div
            onClick={() => setSidebarSheetOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50 }}
          />
        )}

        {/* Bottom sheet */}
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          zIndex: 51,
          background: "var(--bg-sidebar)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          maxHeight: "75vh",
          transform: sidebarSheetOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}>
          {/* Drag handle + close */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 16px 8px", position: "relative" }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "var(--border-strong)" }} />
            <button type="button" onClick={() => setSidebarSheetOpen(false)}
              style={{ position: "absolute", right: 12, top: 8, width: 28, height: 28, borderRadius: 8, border: "none", background: "var(--bg-hover)", color: "var(--fg-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              ×
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {sidebarContent}
          </div>
        </div>

        <RoutineTemplatePanel open={routinePanelOpen} onClose={() => setRoutinePanelOpen(false)} />
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
            {sidebarContent}
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
