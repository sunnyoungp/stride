"use client";

import { useState, useMemo, CSSProperties } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types/index";

// ── Date helpers ──────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

export type KanbanColumn = {
  id: string;
  title: string;
  icon?: string;
  color?: string;
  tasks: Task[];
};

type Props = {
  columns: KanbanColumn[];
  allTasks: Task[];
  onTaskMove: (taskId: string, targetColumnId: string, newOrder: number) => void;
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
  onAddTask?: (columnId: string) => void;
};

// ── Priority dot color ────────────────────────────────────────────────────────

function priorityColor(priority: Task["priority"]): string | null {
  if (priority === "high") return "var(--priority-high)";
  if (priority === "medium") return "var(--priority-medium)";
  if (priority === "low") return "var(--priority-low)";
  return null;
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

function KanbanCardVisual({
  task,
  accentColor,
  style,
}: {
  task: Task;
  accentColor: string;
  style?: CSSProperties;
}) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const allTasks = useTaskStore((s) => s.tasks);

  const isDone = task.status === "done";
  const subtasks = allTasks.filter((t) => t.parentTaskId === task.id);
  const doneSubs = subtasks.filter((t) => t.status === "done").length;

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
          bg = "rgba(var(--accent-rgb, 232,96,60),0.12)";
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
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        padding: "12px 14px",
        borderLeft: `3px solid ${accentColor}`,
        transition: "all 150ms ease",
        cursor: "grab",
        userSelect: "none",
        ...style,
      }}
    >
      {/* Top: title + checkbox */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--fg)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.4,
          }}
        >
          {task.title}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void updateTask(task.id, { status: isDone ? "todo" : "done" });
          }}
          style={{
            flexShrink: 0,
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: `2px solid ${isDone ? accentColor : "var(--border-mid)"}`,
            background: isDone ? accentColor : "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          {isDone && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Subtasks badge */}
      {subtasks.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--fg-faint)" }}>
          {doneSubs}/{subtasks.length} subtasks
        </div>
      )}

      {/* Source document indicator */}
      {task.sourceDocumentId && (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg-faint)" }}>
          📄 {task.sourceDocumentTitle ?? "Document"}
        </div>
      )}

      {/* Bottom row: due date chip + priority dot */}
      {(dueDateChip || pColor) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <div>
            {dueDateChip && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: dueDateChip.bg,
                  color: dueDateChip.color,
                }}
              >
                {dueDateChip.label}
              </span>
            )}
          </div>
          <div>
            {pColor && (
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: pColor,
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanCard({
  task,
  accentColor,
  onTaskClick,
  onTaskRightClick,
}: {
  task: Task;
  accentColor: string;
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const [hovered, setHovered] = useState(false);

  const wrapperStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const cardStyle: CSSProperties = {
    boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.11)" : "0 1px 3px rgba(0,0,0,0.07)",
    transform: hovered ? "translateY(-1px)" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      {...attributes}
      {...listeners}
      onClick={(e) => onTaskClick(task, { x: e.clientX, y: e.clientY })}
      onContextMenu={(e) => {
        e.preventDefault();
        onTaskRightClick(task, { x: e.clientX, y: e.clientY });
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <KanbanCardVisual task={task} accentColor={accentColor} style={cardStyle} />
    </div>
  );
}

// ── KanbanColumnView ──────────────────────────────────────────────────────────

function KanbanColumnView({
  column,
  onTaskClick,
  onTaskRightClick,
  onAddTask,
}: {
  column: KanbanColumn;
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
  onAddTask?: (columnId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });
  const color = column.color ?? "#94a3b8";
  const taskIds = useMemo(() => column.tasks.map((t) => t.id), [column.tasks]);

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 280,
        maxWidth: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        background: "var(--bg-subtle)",
        border: isOver ? `2px solid var(--accent)` : "1px solid var(--border)",
        transition: "border 150ms ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderTop: `3px solid ${color}`,
          background: `${color}14`,
          padding: "12px 16px",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {column.icon && (
            <span style={{ fontSize: 14 }}>{column.icon}</span>
          )}
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--fg)", flex: 1 }}>
            {column.title}
          </span>
          <span style={{ fontSize: 12, color: "var(--fg-faint)", fontWeight: 500 }}>
            {column.tasks.length}
          </span>
        </div>
      </div>

      {/* Tasks area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 80,
        }}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--fg-faint)",
                fontSize: 13,
                fontStyle: "italic",
                padding: "16px 0",
              }}
            >
              No tasks
            </div>
          ) : (
            column.tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                accentColor={color}
                onTaskClick={onTaskClick}
                onTaskRightClick={onTaskRightClick}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Footer: Add Task */}
      {onAddTask && (
        <div style={{ padding: "8px 12px 12px" }}>
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            style={{
              width: "100%",
              padding: "7px 0",
              borderRadius: 8,
              border: "1px dashed var(--border-mid)",
              background: "transparent",
              color: "var(--fg-faint)",
              fontSize: 12,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--fg-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--fg-faint)";
            }}
          >
            + Add Task
          </button>
        </div>
      )}
    </div>
  );
}

// ── KanbanBoard ───────────────────────────────────────────────────────────────

export function KanbanBoard({ columns, allTasks, onTaskMove, onTaskClick, onTaskRightClick, onAddTask }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const col of columns) {
      const found = col.tasks.find((t) => t.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, columns]);

  const activeColumn = useMemo(() => {
    if (!activeTask) return null;
    return columns.find((c) => c.tasks.some((t) => t.id === activeTask.id)) ?? null;
  }, [activeTask, columns]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    if (taskId === overId) return;

    const sourceCol = columns.find((c) => c.tasks.some((t) => t.id === taskId));
    if (!sourceCol) return;

    const isOverColumn = columns.some((c) => c.id === overId);
    const targetColId = isOverColumn
      ? overId
      : (columns.find((c) => c.tasks.some((t) => t.id === overId))?.id ?? sourceCol.id);
    const targetCol = columns.find((c) => c.id === targetColId);
    if (!targetCol) return;

    let newOrder: number;
    if (isOverColumn) {
      newOrder = targetCol.tasks.length;
    } else {
      let idx = targetCol.tasks.findIndex((t) => t.id === overId);
      if (idx === -1) idx = targetCol.tasks.length;
      if (sourceCol.id === targetColId) {
        const oldIdx = sourceCol.tasks.findIndex((t) => t.id === taskId);
        if (oldIdx < idx) idx = Math.max(0, idx - 1);
      }
      newOrder = idx;
    }

    onTaskMove(taskId, targetColId, newOrder);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: "flex",
          gap: 20,
          overflowX: "auto",
          overflowY: "hidden",
          padding: 16,
          height: "100%",
          alignItems: "flex-start",
        }}
      >
        {columns.map((col) => (
          <KanbanColumnView
            key={col.id}
            column={col}
            onTaskClick={onTaskClick}
            onTaskRightClick={onTaskRightClick}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && activeColumn ? (
          <div style={{ transform: "scale(0.95)", boxShadow: "var(--shadow-float)" }}>
            <KanbanCardVisual
              task={activeTask}
              accentColor={activeColumn.color ?? "#94a3b8"}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
