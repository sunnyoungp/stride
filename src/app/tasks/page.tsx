"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useSearchParams } from "next/navigation";
import { useTaskStore } from "@/store/taskStore";
import { useSectionStore } from "@/store/sectionStore";
import { TaskListView } from "@/components/TaskListView";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { KanbanBoard, KanbanColumn } from "@/components/KanbanBoard";
import type { Task, TaskSection } from "@/types/index";

const PALETTE = [
  "#6366f1", "#22c55e", "#f59e0b", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#ef4444",
];

function getSectionAccent(s: TaskSection): string {
  if (s.color) return s.color;
  let h = 0;
  for (let i = 0; i < s.id.length; i++) h = s.id.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

// ── Inner component that reads searchParams (must be in Suspense) ─────────────

function TasksPageInner({
  view,
  onTaskClick,
}: {
  view: "list" | "kanban";
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
}) {
  const searchParams = useSearchParams();
  const sectionIdFilter = searchParams?.get("sectionId") ?? null;

  const tasks = useTaskStore((s) => s.tasks);
  const createTask = useTaskStore((s) => s.createTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);
  const sections = useSectionStore((s) => s.sections);
  const subsections = useSectionStore((s) => s.subsections);

  const incompleteTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.parentTaskId && t.status !== "done" && t.status !== "cancelled")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [tasks]
  );

  // Build kanban columns
  const kanbanColumns = useMemo((): KanbanColumn[] => {
    if (sectionIdFilter && sectionIdFilter !== "unsorted") {
      // Section view: columns = subsections + "General"
      const sectionTasks = incompleteTasks.filter((t) => t.sectionId === sectionIdFilter);
      const subs = subsections
        .filter((s) => s.sectionId === sectionIdFilter)
        .sort((a, b) => a.order - b.order);
      const cols: KanbanColumn[] = subs.map((sub) => ({
        id: sub.id,
        title: sub.title,
        color: sub.color ?? "#94a3b8",
        tasks: sectionTasks.filter((t) => t.subsectionId === sub.id),
      }));
      cols.push({
        id: "__general__",
        title: "General",
        color: "#94a3b8",
        tasks: sectionTasks.filter((t) => !t.subsectionId),
      });
      return cols;
    }
    // All sections view
    const cols: KanbanColumn[] = sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        title: s.title,
        icon: s.icon,
        color: getSectionAccent(s),
        tasks: incompleteTasks.filter((t) => t.sectionId === s.id),
      }));
    cols.push({
      id: "__unsorted__",
      title: "Inbox",
      color: "#94a3b8",
      tasks: incompleteTasks.filter((t) => !t.sectionId),
    });
    return cols;
  }, [incompleteTasks, sections, subsections, sectionIdFilter]);

  const handleKanbanMove = async (taskId: string, targetColId: string, newOrder: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (sectionIdFilter && sectionIdFilter !== "unsorted") {
      // Subsection context
      const newSubId = targetColId === "__general__" ? undefined : targetColId;
      const isIntraCol =
        (task.subsectionId ?? "__general__") === (newSubId ?? "__general__");
      if (isIntraCol) {
        const colTasks = kanbanColumns.find((c) => c.id === targetColId)?.tasks ?? [];
        const old = colTasks.findIndex((t) => t.id === taskId);
        if (old === -1) return;
        const reordered = arrayMove([...colTasks], old, newOrder);
        await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
      } else {
        await updateTask(taskId, { subsectionId: newSubId, order: newOrder });
      }
    } else {
      // Section context
      const newSecId = targetColId === "__unsorted__" ? undefined : targetColId;
      const isIntraCol =
        (task.sectionId ?? "__unsorted__") === (newSecId ?? "__unsorted__");
      if (isIntraCol) {
        const colTasks = kanbanColumns.find((c) => c.id === targetColId)?.tasks ?? [];
        const old = colTasks.findIndex((t) => t.id === taskId);
        if (old === -1) return;
        const reordered = arrayMove([...colTasks], old, newOrder);
        await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
      } else {
        await reorderTasks([{ id: taskId, order: newOrder, sectionId: newSecId }]);
      }
    }
  };

  const handleAddTask = async (columnId: string) => {
    if (sectionIdFilter && sectionIdFilter !== "unsorted") {
      const subsectionId = columnId === "__general__" ? undefined : columnId;
      await createTask({ title: "New Task", sectionId: sectionIdFilter, subsectionId, status: "todo" });
    } else {
      const sectionId = columnId === "__unsorted__" ? undefined : columnId;
      await createTask({ title: "New Task", sectionId, status: "todo" });
    }
  };

  if (view === "kanban") {
    return (
      <div style={{ height: "100%", overflow: "hidden" }}>
        <KanbanBoard
          columns={kanbanColumns}
          allTasks={tasks}
          onTaskMove={(id, col, order) => void handleKanbanMove(id, col, order)}
          onTaskClick={onTaskClick}
          onTaskRightClick={() => {}}
          onAddTask={handleAddTask}
        />
      </div>
    );
  }

  return <TaskListView onTaskClick={onTaskClick} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [view, setView] = useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("stride-tasks-view") as "list" | "kanban") ?? "list";
  });

  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

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

  const handleViewChange = (v: "list" | "kanban") => {
    setView(v);
    localStorage.setItem("stride-tasks-view", v);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div
        className="flex-none flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
      >
        <h1 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Tasks</h1>
        <ViewSwitcher view={view} onChange={handleViewChange} />
      </div>
      <div className="flex-1 overflow-auto mobile-scroll-content">
        <Suspense
          fallback={
            <div className="p-8 text-sm" style={{ color: "var(--fg-muted)" }}>
              Loading…
            </div>
          }
        >
          <TasksPageInner
            view={view}
            onTaskClick={(task, pos) => {
              setSelectedTaskId(task.id);
              setClickPos(pos);
            }}
          />
        </Suspense>
      </div>
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          position={clickPos}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
