"use client";

import { useEffect, useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useTaskStore } from "@/store/taskStore";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { KanbanBoard, KanbanColumn } from "@/components/KanbanBoard";
import { TaskGroup, TaskSelectionProvider, localDateStr } from "@/components/TaskList";
import type { Task } from "@/types/index";

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

// ── Next7Page ─────────────────────────────────────────────────────────────────

export default function Next7Page() {
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const updateTask = useTaskStore((s) => s.updateTask);
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

  const incompleteTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && !t.parentTaskId),
    [tasks]
  );

  const overdueTasks = useMemo(
    () =>
      incompleteTasks
        .filter((t) => t.dueDate && t.dueDate < today)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [incompleteTasks, today]
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const date of next7) map.set(date, []);
    for (const t of incompleteTasks) {
      if (!t.dueDate) continue;
      const d = t.dueDate.slice(0, 10);
      if (map.has(d)) map.get(d)!.push(t);
    }
    return map;
  }, [incompleteTasks, next7]);

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
        <ViewSwitcher view={view} onChange={handleViewChange} />
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
          />
        </div>
      ) : (
        <TaskSelectionProvider
          orderedTaskIds={[
            ...overdueTasks,
            ...next7.flatMap((d) => tasksByDate.get(d) ?? []),
          ].map((t) => t.id)}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Overdue group */}
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

            {/* 7 day groups */}
            {next7.map((date) => (
              <TaskGroup
                key={date}
                label={dayLabel(date, today)}
                tasks={tasksByDate.get(date) ?? []}
                defaultDueDate={date}
                onTaskClick={handleTaskClick}
                onTaskRightClick={handleTaskRightClick}
              />
            ))}
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
