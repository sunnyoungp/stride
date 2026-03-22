"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useTaskStore } from "@/store/taskStore";
import { useSectionStore } from "@/store/sectionStore";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TaskGroup, TaskSelectionProvider } from "@/components/TaskList";
import type { Task } from "@/types/index";

// ── InboxPageContent ──────────────────────────────────────────────────────────

function InboxPageContent() {
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  useEffect(() => {
    const saved = localStorage.getItem("stride-tasks-view") as "list" | "kanban" | null;
    if (saved === "kanban") setView("kanban");
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "stride-tasks-view" && e.newValue) {
        setView(e.newValue as "list" | "kanban");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const incompleteTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && !t.parentTaskId),
    [tasks]
  );

  const noDateTasks = useMemo(
    () =>
      incompleteTasks
        .filter((t) => !t.dueDate)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [incompleteTasks]
  );

  const noSectionTasks = useMemo(
    () =>
      incompleteTasks
        .filter((t) => !t.sectionId && t.dueDate)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [incompleteTasks]
  );

  const totalCount = noDateTasks.length + noSectionTasks.length;

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleViewChange = (v: "list" | "kanban") => {
    setView(v);
    localStorage.setItem("stride-tasks-view", v);
  };

  const handleTaskClick = (task: Task, pos: { x: number; y: number }) => {
    setSelectedTaskId(task.id);
    setClickPos(pos);
  };

  const handleTaskRightClick = (task: Task, pos: { x: number; y: number }) => {
    setContextMenu({ task, x: pos.x, y: pos.y });
  };

  const handleTaskMove = async (taskId: string, targetColId: string, newOrder: number) => {
    const sourceIsSameAsTarget =
      (targetColId === "no-date" && noDateTasks.some((t) => t.id === taskId)) ||
      (targetColId === "no-section" && noSectionTasks.some((t) => t.id === taskId));

    if (sourceIsSameAsTarget) {
      const colTasks = targetColId === "no-date" ? noDateTasks : noSectionTasks;
      const oldIdx = colTasks.findIndex((t) => t.id === taskId);
      if (oldIdx === -1) return;
      const reordered = arrayMove([...colTasks], oldIdx, newOrder);
      await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
    }
    // Cross-column: do nothing (groups are read-only for now)
  };

  const kanbanColumns = useMemo(
    () => [
      { id: "no-date", title: "No Due Date", color: "#94a3b8", tasks: noDateTasks },
      { id: "no-section", title: "No Section", color: "#f59e0b", tasks: noSectionTasks },
    ],
    [noDateTasks, noSectionTasks]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", margin: 0 }}>Inbox</h1>
          {totalCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "1px 8px",
                borderRadius: 10,
                background: "var(--bg-subtle)",
                color: "var(--fg-faint)",
              }}
            >
              {totalCount}
            </span>
          )}
        </div>
        <ViewSwitcher view={view} onChange={handleViewChange} />
      </div>

      {/* Content */}
      {totalCount === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 28 }}>✨</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>Your inbox is clear</div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            All tasks have due dates and sections assigned.
          </div>
        </div>
      ) : view === "kanban" ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <KanbanBoard
            columns={kanbanColumns}
            allTasks={tasks}
            onTaskMove={(id, col, order) => void handleTaskMove(id, col, order)}
            onTaskClick={handleTaskClick}
            onTaskRightClick={handleTaskRightClick}
          />
        </div>
      ) : (
        <TaskSelectionProvider orderedTaskIds={[...noDateTasks, ...noSectionTasks].map((t) => t.id)}>
          <div className="mobile-scroll-content" style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <TaskGroup
              label="No Due Date"
              tasks={noDateTasks}
              onTaskClick={handleTaskClick}
              onTaskRightClick={handleTaskRightClick}
            />
            <TaskGroup
              label="No Section"
              tasks={noSectionTasks}
              onTaskClick={handleTaskClick}
              onTaskRightClick={handleTaskRightClick}
            />
          </div>
        </TaskSelectionProvider>
      )}

      {/* Modals */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          position={clickPos}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, fontSize: 13, color: "var(--fg-muted)" }}>Loading…</div>}>
      <InboxPageContent />
    </Suspense>
  );
}
