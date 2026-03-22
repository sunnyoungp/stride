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

// ── Date filter helpers ────────────────────────────────────────────────────────

type DateFilter = "all" | "today" | "today+tomorrow" | "week";

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getFilterDates(filter: DateFilter): string[] | undefined {
  if (filter === "all") return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (filter === "today") return [localDate(today)];
  if (filter === "today+tomorrow") {
    const tom = new Date(today); tom.setDate(tom.getDate() + 1);
    return [localDate(today), localDate(tom)];
  }
  // "week" = current Sun-Sat week
  const dates: string[] = [];
  const sun = new Date(today); sun.setDate(sun.getDate() - sun.getDay());
  for (let i = 0; i < 7; i++) {
    const d = new Date(sun); d.setDate(sun.getDate() + i);
    dates.push(localDate(d));
  }
  return dates;
}

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
  filterDates,
}: {
  view: "list" | "kanban";
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  filterDates?: string[];
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
        .filter((t) => !filterDates || !t.dueDate || filterDates.includes(t.dueDate.slice(0, 10)))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [tasks, filterDates]
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

  return <TaskListView onTaskClick={onTaskClick} filterDates={filterDates} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DATE_FILTER_CHIPS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "today+tomorrow", label: "Today + Tomorrow" },
  { key: "week", label: "This Week" },
];

export default function Page() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [view, setView] = useState<"list" | "kanban">("list");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  useEffect(() => {
    const saved = localStorage.getItem("stride-tasks-view") as "list" | "kanban" | null;
    if (saved === "kanban") setView("kanban");
  }, []);

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

  const filterDates = getFilterDates(dateFilter);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div
        className="flex-none flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
      >
        <h1 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Tasks</h1>
        <ViewSwitcher view={view} onChange={handleViewChange} />
      </div>

      {/* Date filter chips */}
      <div
        className="flex-none flex items-center gap-2 px-6 py-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
      >
        {DATE_FILTER_CHIPS.map(({ key, label }) => {
          const active = dateFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setDateFilter(key)}
              className="rounded-lg px-3 py-1 text-[12.5px] font-medium transition-all duration-150"
              style={active
                ? { background: "var(--accent-bg-strong)", color: "var(--accent)" }
                : { background: "var(--bg-hover)", color: "var(--fg-muted)" }
              }
            >
              {label}
            </button>
          );
        })}
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
            filterDates={filterDates}
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
