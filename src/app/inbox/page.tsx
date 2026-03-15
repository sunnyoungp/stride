"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useTaskStore } from "@/store/taskStore";
import { useSectionStore } from "@/store/sectionStore";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { Task } from "@/types/index";

// ── Due date chip helper ──────────────────────────────────────────────────────

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() { return localDate(new Date()); }
function isOverdue(v: string) { return v < todayStr(); }
function isToday(v: string) { return v === todayStr(); }
function friendlyDate(v: string) {
  const diff = Math.round(
    (new Date(v + "T00:00:00").getTime() - new Date(todayStr() + "T00:00:00").getTime()) / 86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(v + "T00:00:00")
  );
}

function priorityColor(priority: Task["priority"]): string | null {
  if (priority === "high") return "var(--priority-high)";
  if (priority === "medium") return "var(--priority-medium)";
  if (priority === "low") return "var(--priority-low)";
  return null;
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onClick,
  onRightClick,
}: {
  task: Task;
  onClick: (task: Task, pos: { x: number; y: number }) => void;
  onRightClick: (task: Task, pos: { x: number; y: number }) => void;
}) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const isDone = task.status === "done";
  const pColor = priorityColor(task.priority);

  const dueDateChip = task.dueDate
    ? (() => {
        const v = task.dueDate;
        let bg: string;
        let color: string;
        if (isOverdue(v)) {
          bg = "rgba(239,68,68,0.12)";
          color = "#ef4444";
        } else if (isToday(v)) {
          bg = "rgba(232,96,60,0.12)";
          color = "var(--accent)";
        } else {
          bg = "var(--bg-subtle)";
          color = "var(--fg-muted)";
        }
        return { label: friendlyDate(v), bg, color };
      })()
    : null;

  return (
    <div
      onClick={(e) => onClick(task, { x: e.clientX, y: e.clientY })}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick(task, { x: e.clientX, y: e.clientY });
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void updateTask(task.id, { status: isDone ? "todo" : "done" });
        }}
        style={{
          flexShrink: 0,
          width: 17,
          height: 17,
          borderRadius: 4,
          border: `2px solid ${isDone ? "var(--accent)" : "var(--border-mid)"}`,
          background: isDone ? "var(--accent)" : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {isDone && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: isDone ? "var(--fg-muted)" : "var(--fg)",
          textDecoration: isDone ? "line-through" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {task.title}
      </span>

      {/* Due date chip */}
      {dueDateChip && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 6,
            background: dueDateChip.bg,
            color: dueDateChip.color,
            flexShrink: 0,
          }}
        >
          {dueDateChip.label}
        </span>
      )}

      {/* Priority dot */}
      {pColor && (
        <span
          style={{
            flexShrink: 0,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: pColor,
          }}
        />
      )}
    </div>
  );
}

// ── TaskGroup card ────────────────────────────────────────────────────────────

function TaskGroup({
  label,
  count,
  tasks,
  onTaskClick,
  onTaskRightClick,
}: {
  label: string;
  count: number;
  tasks: Task[];
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Group header */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{label}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "1px 7px",
            borderRadius: 10,
            background: "var(--bg-subtle)",
            color: "var(--fg-faint)",
          }}
        >
          {count}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)" }} />

      {/* Rows */}
      {tasks.length === 0 ? (
        <div style={{ padding: "16px", fontSize: 13, color: "var(--fg-faint)", fontStyle: "italic" }}>
          No tasks
        </div>
      ) : (
        tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onClick={onTaskClick}
            onRightClick={onTaskRightClick}
          />
        ))
      )}
    </div>
  );
}

// ── InboxPageContent ──────────────────────────────────────────────────────────

function InboxPageContent() {
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [view, setView] = useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("stride-tasks-view") as "list" | "kanban") ?? "list";
  });

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

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
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <TaskGroup
            label="No Due Date"
            count={noDateTasks.length}
            tasks={noDateTasks}
            onTaskClick={handleTaskClick}
            onTaskRightClick={handleTaskRightClick}
          />
          <TaskGroup
            label="No Section"
            count={noSectionTasks.length}
            tasks={noSectionTasks}
            onTaskClick={handleTaskClick}
            onTaskRightClick={handleTaskRightClick}
          />
        </div>
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
