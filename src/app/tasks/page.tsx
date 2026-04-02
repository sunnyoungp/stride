"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useSearchParams } from "next/navigation";
import { useTaskStore } from "@/store/taskStore";
import { useSectionStore } from "@/store/sectionStore";
import { TaskListView } from "@/components/TaskListView";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { KanbanBoard, KanbanColumn } from "@/components/KanbanBoard";
import { SortFilterPopover, type GroupBy, type SortBy } from "@/components/SortFilterPopover";
import type { Task, TaskSection } from "@/types/index";

// ── Helpers ────────────────────────────────────────────────────────────────────

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() { return localDate(new Date()); }

function applySortBy(tasks: Task[], sortBy: SortBy): Task[] {
  switch (sortBy) {
    case "manual":
      return [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    case "title": return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
    case "priority": {
      const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return [...tasks].sort((a, b) => (p[a.priority ?? ""] ?? 3) - (p[b.priority ?? ""] ?? 3));
    }
    case "tag":
      return [...tasks].sort((a, b) => (a.tags[0] ?? "").localeCompare(b.tags[0] ?? ""));
    case "date":
      return [...tasks].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return (a.order ?? 0) - (b.order ?? 0);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }
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

// ── Inner component (reads searchParams — must be in Suspense) ─────────────────

function TasksPageInner({
  view,
  onTaskClick,
  onTaskRightClick,
  todayOnly,
  groupBy,
  sortBy,
}: {
  view: "list" | "kanban";
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
  todayOnly: boolean;
  groupBy: GroupBy;
  sortBy: SortBy;
}) {
  const searchParams = useSearchParams();
  const sectionIdFilter = searchParams?.get("sectionId") ?? null;

  const tasks = useTaskStore((s) => s.tasks);
  const createTask = useTaskStore((s) => s.createTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);
  const sections = useSectionStore((s) => s.sections);
  const subsections = useSectionStore((s) => s.subsections);
  const updateSection = useSectionStore((s) => s.updateSection);

  const today = todayStr();

  const incompleteTasks = useMemo(() => {
    // All incomplete tasks (including subtasks) — used for kanban columns
    let base = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
    if (todayOnly) base = base.filter((t) => !t.dueDate || t.dueDate.slice(0, 10) === today);
    return applySortBy(base, sortBy);
  }, [tasks, todayOnly, today, sortBy]);

  // ── Kanban columns ─────────────────────────────────────────────────────────

  // Orders tasks so subtasks appear immediately after their parent within a column
  const interleaveSubtasks = (columnTasks: Task[]): Task[] => {
    const parents = columnTasks.filter((t) => !t.parentTaskId);
    const result: Task[] = [];
    const placed = new Set<string>();
    for (const parent of parents) {
      result.push(parent);
      placed.add(parent.id);
      const children = columnTasks.filter((t) => t.parentTaskId === parent.id);
      for (const child of children) { result.push(child); placed.add(child.id); }
    }
    // Any remaining (orphan subtasks whose parent isn't in this column)
    for (const t of columnTasks) { if (!placed.has(t.id)) result.push(t); }
    return result;
  };

  const kanbanColumns = useMemo((): KanbanColumn[] => {
    // When a section is selected, always use subsection grouping regardless of groupBy
    if (sectionIdFilter && sectionIdFilter !== "unsorted") {
      const sectionTasks = incompleteTasks.filter((t) => t.sectionId === sectionIdFilter);
      const subs = subsections
        .filter((s) => s.sectionId === sectionIdFilter)
        .sort((a, b) => a.order - b.order);
      const cols: KanbanColumn[] = subs.map((sub) => ({
        id: sub.id, title: sub.title, color: sub.color ?? "#94a3b8",
        tasks: interleaveSubtasks(sectionTasks.filter((t) => t.subsectionId === sub.id)),
      }));
      cols.push({
        id: "__general__", title: "General", color: "#94a3b8",
        tasks: interleaveSubtasks(sectionTasks.filter((t) => !t.subsectionId)),
      });
      return cols;
    }

    // groupBy: date — subtasks appear in their own due date column
    if (groupBy === "date") {
      const tom = new Date(); tom.setDate(tom.getDate() + 1);
      const tomorrowStr = localDate(tom);
      const overdue = incompleteTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today);
      const todayT  = incompleteTasks.filter((t) => t.dueDate?.slice(0, 10) === today);
      const tomorrowT = incompleteTasks.filter((t) => t.dueDate?.slice(0, 10) === tomorrowStr);
      const laterT = incompleteTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) > tomorrowStr);
      const noDate = incompleteTasks.filter((t) => !t.dueDate);
      const cols: KanbanColumn[] = [];
      if (overdue.length) cols.push({ id: "__overdue__", title: "Overdue", color: "#ef4444", tasks: interleaveSubtasks(overdue) });
      cols.push({ id: "__today__", title: "Today", color: "var(--accent)", tasks: interleaveSubtasks(todayT) });
      cols.push({ id: "__tomorrow__", title: "Tomorrow", color: "#8b5cf6", tasks: interleaveSubtasks(tomorrowT) });
      if (laterT.length) cols.push({ id: "__later__", title: "Later", color: "#94a3b8", tasks: interleaveSubtasks(laterT) });
      cols.push({ id: "__nodate__", title: "No Date", color: "#94a3b8", tasks: interleaveSubtasks(noDate) });
      return cols;
    }

    // groupBy: priority — only parent tasks for non-list groupings
    const rootIncomplete = incompleteTasks.filter((t) => !t.parentTaskId);
    if (groupBy === "priority") {
      return [
        { id: "__high__",   title: "High",        color: "var(--priority-high, #ef4444)",   tasks: rootIncomplete.filter((t) => t.priority === "high") },
        { id: "__medium__", title: "Medium",       color: "var(--priority-medium, #f59e0b)", tasks: rootIncomplete.filter((t) => t.priority === "medium") },
        { id: "__low__",    title: "Low",          color: "var(--priority-low, #3b82f6)",    tasks: rootIncomplete.filter((t) => t.priority === "low") },
        { id: "__nopri__",  title: "No Priority",  color: "#94a3b8",                          tasks: rootIncomplete.filter((t) => !t.priority || t.priority === "none") },
      ];
    }

    // groupBy: tag — only parent tasks
    if (groupBy === "tag") {
      const allTags = [...new Set(rootIncomplete.flatMap((t) => t.tags ?? []))].sort();
      const cols: KanbanColumn[] = allTags.map((tag) => ({
        id: `__tag__${tag}`, title: tag, color: "#94a3b8",
        tasks: rootIncomplete.filter((t) => (t.tags ?? []).includes(tag)),
      }));
      cols.push({ id: "__notag__", title: "No Tag", color: "#94a3b8", tasks: rootIncomplete.filter((t) => !t.tags || t.tags.length === 0) });
      return cols;
    }

    // groupBy: list (default) — section-based, subtasks included in their section
    const cols: KanbanColumn[] = sections
      .slice().sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id, title: s.title, icon: s.icon, color: getSectionAccent(s),
        tasks: interleaveSubtasks(incompleteTasks.filter((t) => t.sectionId === s.id)),
      }));
    cols.push({
      id: "__unsorted__", title: "Inbox", color: "#94a3b8",
      tasks: interleaveSubtasks(incompleteTasks.filter((t) => !t.sectionId)),
    });
    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incompleteTasks, sections, subsections, sectionIdFilter, groupBy, today]);

  const handleKanbanMove = async (taskId: string, targetColId: string, newOrder: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (sectionIdFilter && sectionIdFilter !== "unsorted") {
      const newSubId = targetColId === "__general__" ? undefined : targetColId;
      const isIntraCol = (task.subsectionId ?? "__general__") === (newSubId ?? "__general__");
      if (isIntraCol) {
        const colTasks = kanbanColumns.find((c) => c.id === targetColId)?.tasks ?? [];
        const old = colTasks.findIndex((t) => t.id === taskId);
        if (old === -1) return;
        const reordered = arrayMove([...colTasks], old, newOrder);
        await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
      } else {
        await updateTask(taskId, { subsectionId: newSubId, order: newOrder });
      }
    } else if (groupBy === "list") {
      const newSecId = targetColId === "__unsorted__" ? undefined : targetColId;
      const isIntraCol = (task.sectionId ?? "__unsorted__") === (newSecId ?? "__unsorted__");
      if (isIntraCol) {
        const colTasks = kanbanColumns.find((c) => c.id === targetColId)?.tasks ?? [];
        const old = colTasks.findIndex((t) => t.id === taskId);
        if (old === -1) return;
        const reordered = arrayMove([...colTasks], old, newOrder);
        await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
      } else {
        await reorderTasks([{ id: taskId, order: newOrder, sectionId: newSecId }]);
      }
    } else if (groupBy === "date") {
      // Map column ID to a concrete due date
      const dateForColumn = (colId: string): string | undefined => {
        if (colId === "__nodate__") return undefined;
        if (colId === "__today__") return localDate(new Date());
        if (colId === "__tomorrow__") {
          const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d);
        }
        if (colId === "__later__") {
          // Set to 2 days from now as a reasonable default for "later"
          const d = new Date(); d.setDate(d.getDate() + 2); return localDate(d);
        }
        if (colId === "__overdue__") {
          // Keep existing overdue date; if no date set to yesterday
          const t = tasks.find((t) => t.id === taskId);
          if (t?.dueDate) return t.dueDate;
          const d = new Date(); d.setDate(d.getDate() - 1); return localDate(d);
        }
        return undefined;
      };

      const sourceColId = kanbanColumns.find((c) => c.tasks.some((t) => t.id === taskId))?.id;
      const newDueDate = dateForColumn(targetColId);
      const isIntraCol = sourceColId === targetColId;

      if (isIntraCol) {
        const colTasks = kanbanColumns.find((c) => c.id === targetColId)?.tasks ?? [];
        const old = colTasks.findIndex((t) => t.id === taskId);
        if (old === -1) return;
        const reordered = arrayMove([...colTasks], old, newOrder);
        await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
      } else {
        // Update due date to match target column
        await updateTask(taskId, { dueDate: newDueDate, order: newOrder });
      }
    } else {
      // For other non-list groupings (priority, tag), only allow same-column reorder
      const colTasks = kanbanColumns.find((c) => c.id === targetColId)?.tasks ?? [];
      const isInCol = colTasks.some((t) => t.id === taskId);
      if (!isInCol) return;
      const old = colTasks.findIndex((t) => t.id === taskId);
      if (old === -1) return;
      const reordered = arrayMove([...colTasks], old, newOrder);
      await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
    }
  };

  const handleAddTask = async (columnId: string, title: string) => {
    if (sectionIdFilter && sectionIdFilter !== "unsorted") {
      const subsectionId = columnId === "__general__" ? undefined : columnId;
      await createTask({ title, sectionId: sectionIdFilter, subsectionId, status: "todo" });
    } else if (groupBy === "list") {
      const sectionId = columnId === "__unsorted__" ? undefined : columnId;
      await createTask({ title, sectionId, status: "todo" });
    } else if (groupBy === "date") {
      const dueDate = ["__today__", "__tomorrow__", "__nodate__", "__later__"].includes(columnId) ? undefined : columnId;
      await createTask({ title, status: "todo", dueDate });
    } else {
      await createTask({ title, status: "todo" });
    }
  };

  const filterDates = todayOnly ? [today] : undefined;

  const handleColumnReorder = async (newColIds: string[]) => {
    // Only meaningful for list groupBy — update section orders
    if (groupBy !== "list") return;
    await Promise.all(
      newColIds
        .filter((id) => id !== "__unsorted__")
        .map((id, idx) => updateSection(id, { order: idx }))
    );
  };

  if (view === "kanban") {
    return (
      <div style={{ height: "100%", overflowY: "auto" }}>
        <KanbanBoard
          columns={kanbanColumns}
          allTasks={tasks}
          onTaskMove={(id, col, order) => void handleKanbanMove(id, col, order)}
          onTaskClick={onTaskClick}
          onTaskRightClick={onTaskRightClick}
          onAddTask={handleAddTask}
          onColumnReorder={groupBy === "list" ? (ids) => void handleColumnReorder(ids) : undefined}
        />
      </div>
    );
  }

  return <TaskListView onTaskClick={onTaskClick} filterDates={filterDates} sortBy={sortBy} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

function SortFilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h5M2 8h8M2 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M13 6v7m0 0-2-2m2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Page() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [todayOnly, setTodayOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("list");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortPopoverAnchor, setSortPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const [taskFontSize, setTaskFontSize] = useState<"S" | "M" | "L">("M");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("viewState_tasks");
      if (raw) {
        const s = JSON.parse(raw) as { view?: string; groupBy?: GroupBy; sortBy?: SortBy; todayOnly?: boolean };
        if (s.view === "kanban" || s.view === "list") setView(s.view);
        if (s.groupBy) setGroupBy(s.groupBy);
        if (s.sortBy) setSortBy(s.sortBy);
        if (typeof s.todayOnly === "boolean") setTodayOnly(s.todayOnly);
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

  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const saveViewState = (overrides: Partial<{ view: "list" | "kanban"; groupBy: GroupBy; sortBy: SortBy; todayOnly: boolean }>) => {
    const current = { view, groupBy, sortBy, todayOnly, ...overrides };
    localStorage.setItem("viewState_tasks", JSON.stringify(current));
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

  useEffect(() => {
    console.log("[TasksPage] selectedTaskId updated:", selectedTaskId);
  }, [selectedTaskId]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div
        className="flex-none flex items-center justify-between px-6 py-4 sticky top-0 z-[10]"
        style={{ 
          borderBottom: "1px solid var(--border)", 
          background: "transparent",
          backdropFilter: "var(--glass-blur-panel)",
          WebkitBackdropFilter: "var(--glass-blur-panel)",
        }}
      >
        <h1 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Tasks</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Font size S/M/L toggle */}
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
            >
              {s}
            </button>
          ))}
          {/* Today toggle */}
          <button
            type="button"
            onClick={() => { const next = !todayOnly; setTodayOnly(next); saveViewState({ todayOnly: next }); }}
            className="rounded-lg px-3 py-1 text-[12.5px] font-medium transition-all duration-150"
            style={todayOnly
              ? { background: "var(--accent-bg-strong)", color: "var(--accent)" }
              : { background: "var(--bg-hover)", color: "var(--fg-muted)" }
            }
          >
            Today
          </button>
          {/* Sort/Filter button */}
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
          >
            <SortFilterIcon />
          </button>
          <ViewSwitcher view={view} onChange={handleViewChange} />
        </div>
      </div>

      <div className="flex-1 overflow-auto mobile-scroll-content">
        <Suspense
          fallback={<div className="p-8 text-sm" style={{ color: "var(--fg-muted)" }}>Loading…</div>}
        >
          <TasksPageInner
            view={view}
            todayOnly={todayOnly}
            groupBy={groupBy}
            sortBy={sortBy}
            onTaskClick={(task, pos) => { setSelectedTaskId(task.id); setClickPos(pos); }}
            onTaskRightClick={(task, pos) => setContextMenu({ task, x: pos.x, y: pos.y })}
          />
        </Suspense>
      </div>

      {selectedTask && (
        <TaskDetailModal task={selectedTask} position={clickPos} onClose={() => setSelectedTaskId(null)} />
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
