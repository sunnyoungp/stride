"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTaskStore } from "@/store/taskStore";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { KanbanBoard, KanbanColumn } from "@/components/KanbanBoard";
import { TaskGroup, TaskSelectionProvider, localDateStr, TaskRow, AddTaskRow } from "@/components/TaskList";
import { SortFilterPopover, type GroupBy, type SortBy } from "@/components/SortFilterPopover";
import type { Task } from "@/types/index";

function applySortBy(tasks: Task[], sortBy: SortBy): Task[] {
  switch (sortBy) {
    case "title": return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
    case "priority": {
      const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return [...tasks].sort((a, b) => (p[a.priority ?? ""] ?? 3) - (p[b.priority ?? ""] ?? 3));
    }
    case "tag":  return [...tasks].sort((a, b) => (a.tags[0] ?? "").localeCompare(b.tags[0] ?? ""));
    case "date": return [...tasks].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }
}

function SortFilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h5M2 8h8M2 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M13 6v7m0 0-2-2m2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr() { return localDateStr(new Date()); }

function dayLabel(dateStr: string, today: string): string {
  const diff = Math.round(
    (new Date(dateStr + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(dateStr + "T00:00:00")
  );
}

// ── DnD list components ───────────────────────────────────────────────────────

function SortableTaskRow({
  task,
  onTaskClick,
  onTaskRightClick,
}: {
  task: Task;
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        position: "relative",
      }}
    >
      {/* Grip handle — only this element initiates drag */}
      <div
        {...listeners}
        {...attributes}
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 20,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          color: "var(--fg-faint)",
          opacity: 0,
          zIndex: 1,
        }}
        className="task-drag-grip"
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="3" cy="2.5" r="1.1"/><circle cx="7" cy="2.5" r="1.1"/>
          <circle cx="3" cy="7" r="1.1"/><circle cx="7" cy="7" r="1.1"/>
          <circle cx="3" cy="11.5" r="1.1"/><circle cx="7" cy="11.5" r="1.1"/>
        </svg>
      </div>
      <div style={{ paddingLeft: 0 }}>
        <TaskRow task={task} onClick={onTaskClick} onRightClick={onTaskRightClick} />
      </div>
    </div>
  );
}

function DroppableDateGroup({
  date,
  label,
  tasks,
  onTaskClick,
  onTaskRightClick,
}: {
  date: string;
  label: string;
  tasks: Task[];
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const allTasks = useTaskStore((s) => s.tasks);
  // Only parent tasks are sortable; subtasks ride along with their parent
  const parentTaskIds = useMemo(() => tasks.filter((t) => !t.parentTaskId).map((t) => t.id), [tasks]);
  // Count of visible items (parents only for the header badge, to avoid confusion)
  const parentCount = tasks.filter((t) => !t.parentTaskId).length;

  return (
    <div
      ref={setNodeRef}
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: isOver ? "1px solid var(--accent)" : "1px solid var(--border)",
        boxShadow: isOver ? "0 0 0 2px var(--accent-bg-strong)" : "var(--shadow-sm)",
        overflow: "hidden",
        flexShrink: 0,
        transition: "border 120ms ease, box-shadow 120ms ease",
      }}
    >
      {/* Header */}
      <div style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", flex: 1 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 500, padding: "1px 7px", borderRadius: 10, background: "var(--bg-subtle)", color: "var(--fg-faint)" }}>
          {parentCount}
        </span>
      </div>

      {/* Rows */}
      <SortableContext items={parentTaskIds} strategy={verticalListSortingStrategy}>
        {tasks.length === 0 ? (
          <div style={{ padding: "16px", fontSize: 12, color: "var(--fg-faint)", fontStyle: "italic", textAlign: "center" }}>
            No tasks
          </div>
        ) : (
          tasks.map((task, idx) => {
            const isSubtask = !!task.parentTaskId;
            const parentTask = isSubtask
              ? allTasks.find((t) => t.id === task.parentTaskId)
              : null;
            // Is the parent also in this same date group?
            const parentInSameGroup = isSubtask && tasks.some((t) => t.id === task.parentTaskId);

            if (isSubtask) {
              // Subtask rendering: indented if parent in same group, parent link label if not
              return (
                <div
                  key={task.id}
                  style={{
                    borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {parentInSameGroup ? (
                    // Indented — simple left padding, no connector line
                    <div style={{ paddingLeft: 20 }}>
                      <TaskRow task={task} onClick={onTaskClick} onRightClick={onTaskRightClick} />
                    </div>
                  ) : (
                    // Standalone subtask with parent link label
                    <div>
                      {parentTask && (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          paddingLeft: 42,
                          paddingTop: 6,
                          paddingBottom: 0,
                        }}>
                          <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>↳</span>
                          <span style={{
                            fontSize: 10,
                            color: "var(--fg-faint)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {parentTask.title || "(Untitled)"}
                          </span>
                        </div>
                      )}
                      <TaskRow task={task} onClick={onTaskClick} onRightClick={onTaskRightClick} />
                    </div>
                  )}
                </div>
              );
            }

            // Regular parent task row (sortable)
            return (
              <div
                key={task.id}
                style={idx > 0 ? { borderTop: "1px solid var(--border)" } : {}}
                className="[&:hover_.task-drag-grip]:opacity-40"
              >
                <SortableTaskRow task={task} onTaskClick={onTaskClick} onTaskRightClick={onTaskRightClick} />
              </div>
            );
          })
        )}
      </SortableContext>

      {/* Add task */}
      <div style={{ borderTop: tasks.length > 0 ? "1px solid var(--border)" : undefined }}>
        <AddTaskRow dueDate={date} />
      </div>
    </div>
  );
}

// ── Next7Page ─────────────────────────────────────────────────────────────────

export default function Next7Page() {
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const createTask = useTaskStore((s) => s.createTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [groupBy, setGroupBy] = useState<GroupBy>("list");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortPopoverAnchor, setSortPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const [taskFontSize, setTaskFontSize] = useState<"S" | "M" | "L">("M");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("viewState_next7days");
      if (raw) {
        const s = JSON.parse(raw) as { view?: string; groupBy?: GroupBy; sortBy?: SortBy };
        if (s.view === "kanban" || s.view === "list") setView(s.view);
        if (s.groupBy) setGroupBy(s.groupBy);
        if (s.sortBy) setSortBy(s.sortBy);
      }
    } catch {}
    try {
      const stored = localStorage.getItem("stride-font-tasks");
      if (stored === "13px") setTaskFontSize("S");
      else if (stored === "17px") setTaskFontSize("L");
      else setTaskFontSize("M");
    } catch {}
  }, []);

  const applyTaskFontSize = (size: "S" | "M" | "L") => {
    const px = size === "S" ? "13px" : size === "L" ? "17px" : "15px";
    setTaskFontSize(size);
    localStorage.setItem("stride-font-tasks", px);
    document.documentElement.style.setProperty("--font-size-tasks", px);
  };

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const today = todayStr();

  const next7 = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today + "T00:00:00");
      d.setDate(d.getDate() + i);
      dates.push(localDateStr(d));
    }
    return dates;
  }, [today]);

  // All incomplete tasks including subtasks — subtasks appear in their own date groups
  const incompleteTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled"),
    [tasks]
  );

  const overdueTasks = useMemo(
    () => applySortBy(
      incompleteTasks.filter((t) => !t.parentTaskId && t.dueDate && t.dueDate < today),
      sortBy
    ),
    [incompleteTasks, today, sortBy]
  );

  // Order tasks in a date bucket: parents first, then their subtasks interleaved
  const interleaveSubtasks = (bucket: Task[]): Task[] => {
    const parents = bucket.filter((t) => !t.parentTaskId);
    const result: Task[] = [];
    const placed = new Set<string>();
    for (const parent of parents) {
      result.push(parent);
      placed.add(parent.id);
      const children = bucket.filter((t) => t.parentTaskId === parent.id);
      for (const child of children) { result.push(child); placed.add(child.id); }
    }
    for (const t of bucket) { if (!placed.has(t.id)) result.push(t); }
    return result;
  };

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const date of next7) map.set(date, []);
    for (const t of incompleteTasks) {
      if (!t.dueDate) continue;
      const d = t.dueDate.slice(0, 10);
      if (map.has(d)) map.get(d)!.push(t);
    }
    // Sort then interleave subtasks after their parent
    for (const [date, bucket] of map) {
      map.set(date, interleaveSubtasks(applySortBy(bucket, sortBy)));
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incompleteTasks, next7, sortBy]);

  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    const cols: KanbanColumn[] = [];
    if (overdueTasks.length > 0) {
      cols.push({ id: "__overdue__", title: "Overdue", color: "#ef4444", tasks: overdueTasks });
    }
    for (const date of next7) {
      cols.push({
        id: date,
        title: dayLabel(date, today),
        color: date === today ? "var(--accent)" : "#94a3b8",
        tasks: tasksByDate.get(date) ?? [],
      });
    }
    return cols;
  }, [overdueTasks, next7, tasksByDate, today]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const saveViewState = (overrides: Partial<{ view: "list" | "kanban"; groupBy: GroupBy; sortBy: SortBy }>) => {
    const current = { view, groupBy, sortBy, ...overrides };
    localStorage.setItem("viewState_next7days", JSON.stringify(current));
  };

  const handleViewChange = (v: "list" | "kanban") => {
    setView(v);
    saveViewState({ view: v });
  };

  const openSortPopover = () => {
    if (sortPopoverAnchor) { setSortPopoverAnchor(null); return; }
    const r = sortBtnRef.current?.getBoundingClientRect();
    if (r) setSortPopoverAnchor({ x: r.right, y: r.bottom });
  };

  const sortActive = sortBy !== "date" || groupBy !== "list";

  const handleTaskClick = (task: Task, pos: { x: number; y: number }) => {
    setSelectedTaskId(task.id);
    setClickPos(pos);
  };

  const handleTaskRightClick = (task: Task, pos: { x: number; y: number }) => {
    setContextMenu({ task, x: pos.x, y: pos.y });
  };

  const handleAddTask = (columnId: string, title: string) => {
    if (columnId === "__overdue__") return;
    void createTask({ title, status: "todo", dueDate: columnId });
  };

  const handleTaskMove = async (taskId: string, targetColId: string, newOrder: number) => {
    if (targetColId === "__overdue__") return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const sourceColId = task.dueDate?.slice(0, 10) ?? "__overdue__";
    if (sourceColId === targetColId) {
      const colTasks = kanbanColumns.find((c) => c.id === targetColId)?.tasks ?? [];
      const oldIdx = colTasks.findIndex((t) => t.id === taskId);
      if (oldIdx === -1) return;
      const reordered = arrayMove([...colTasks], oldIdx, newOrder);
      await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
    } else {
      await updateTask(taskId, { dueDate: targetColId });
    }
  };

  // @dnd-kit sensors for list drag-to-reschedule
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // over.id is either a date string (dropped on group) or a task.id (dropped on row)
    let targetDate = over.id as string;
    if (!next7.includes(targetDate)) {
      // Dropped on another task row — find its date group
      const overTask = tasks.find((t) => t.id === targetDate);
      targetDate = overTask?.dueDate?.slice(0, 10) ?? "";
    }

    if (targetDate && next7.includes(targetDate) && task.dueDate?.slice(0, 10) !== targetDate) {
      void updateTask(taskId, { dueDate: targetDate });
    }
  };

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
        <h1 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", margin: 0 }}>Next 7 Days</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(["S", "M", "L"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applyTaskFontSize(s)}
              className="rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150"
              style={taskFontSize === s
                ? { background: "var(--accent-bg-strong)", color: "var(--accent)" }
                : { background: "var(--bg-hover)", color: "var(--fg-muted)" }
              }
            >{s}</button>
          ))}
          <button
            ref={sortBtnRef}
            type="button"
            onClick={openSortPopover}
            className="flex items-center justify-center rounded-lg transition-all duration-150"
            style={{
              width: 32, height: 32,
              background: sortActive ? "var(--accent-bg-strong)" : "var(--bg-hover)",
              color: sortActive ? "var(--accent)" : "var(--fg-muted)",
            }}
          ><SortFilterIcon /></button>
          <ViewSwitcher view={view} onChange={handleViewChange} />
        </div>
      </div>

      {/* Content */}
      {view === "kanban" ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <KanbanBoard
            columns={kanbanColumns}
            allTasks={tasks}
            onTaskMove={(id, col, order) => void handleTaskMove(id, col, order)}
            onTaskClick={handleTaskClick}
            onTaskRightClick={handleTaskRightClick}
            onAddTask={handleAddTask}
          />
        </div>
      ) : (
        <TaskSelectionProvider
          orderedTaskIds={[
            ...overdueTasks,
            ...next7.flatMap((d) => tasksByDate.get(d) ?? []),
          ].filter((t) => !t.parentTaskId).map((t) => t.id)}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div
              className="mobile-scroll-content"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Overdue group — not droppable */}
              {overdueTasks.length > 0 && (
                <TaskGroup
                  label="Overdue"
                  tasks={overdueTasks}
                  isOverdueGroup
                  showAddTask={false}
                  onTaskClick={handleTaskClick}
                  onTaskRightClick={handleTaskRightClick}
                />
              )}

              {/* 7 day droppable groups */}
              {next7.map((date) => (
                <DroppableDateGroup
                  key={date}
                  date={date}
                  label={dayLabel(date, today)}
                  tasks={tasksByDate.get(date) ?? []}
                  onTaskClick={handleTaskClick}
                  onTaskRightClick={handleTaskRightClick}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? (
                <div
                  style={{
                    padding: "10px 16px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-mid)",
                    borderRadius: 10,
                    boxShadow: "var(--shadow-float)",
                    fontSize: 13,
                    color: "var(--fg)",
                    cursor: "grabbing",
                  }}
                >
                  {activeTask.title || "(Untitled)"}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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
      {sortPopoverAnchor && (
        <SortFilterPopover
          groupBy={groupBy}
          sortBy={sortBy}
          onGroupByChange={(g) => { setGroupBy(g); saveViewState({ groupBy: g }); }}
          onSortByChange={(s) => { setSortBy(s); saveViewState({ sortBy: s }); }}
          anchor={sortPopoverAnchor}
          onClose={() => setSortPopoverAnchor(null)}
        />
      )}
    </div>
  );
}
