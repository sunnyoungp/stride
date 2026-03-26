"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useTaskStore } from "@/store/taskStore";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TaskGroup, TaskSelectionProvider } from "@/components/TaskList";
import { SortFilterPopover, type GroupBy, type SortBy } from "@/components/SortFilterPopover";
import type { Task } from "@/types/index";

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() { return localDate(new Date()); }

function applySortBy(tasks: Task[], sortBy: SortBy): Task[] {
  switch (sortBy) {
    case "title": return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
    case "priority": {
      const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return [...tasks].sort((a, b) => (p[a.priority ?? ""] ?? 3) - (p[b.priority ?? ""] ?? 3));
    }
    case "tag":   return [...tasks].sort((a, b) => (a.tags[0] ?? "").localeCompare(b.tags[0] ?? ""));
    case "date":  return [...tasks].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
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

// ── InboxPageContent ──────────────────────────────────────────────────────────

function InboxPageContent() {
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const createTask = useTaskStore((s) => s.createTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

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
      const raw = localStorage.getItem("viewState_inbox");
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

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const saveViewState = (overrides: Partial<{ view: "list" | "kanban"; groupBy: GroupBy; sortBy: SortBy; todayOnly: boolean }>) => {
    const current = { view, groupBy, sortBy, todayOnly, ...overrides };
    localStorage.setItem("viewState_inbox", JSON.stringify(current));
  };

  const today = todayStr();

  const incompleteTasks = useMemo(() => {
    let base = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && !t.parentTaskId);
    if (todayOnly) base = base.filter((t) => !t.dueDate || t.dueDate.slice(0, 10) === today);
    return base;
  }, [tasks, todayOnly, today]);

  const noDateTasks = useMemo(
    () => applySortBy(incompleteTasks.filter((t) => !t.dueDate), sortBy === "date" ? "date" : sortBy),
    [incompleteTasks, sortBy]
  );

  const noSectionTasks = useMemo(
    () => applySortBy(incompleteTasks.filter((t) => !t.sectionId && t.dueDate), sortBy),
    [incompleteTasks, sortBy]
  );

  const totalCount = noDateTasks.length + noSectionTasks.length;

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

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
    void createTask({ title, status: "todo" });
  };

  const handleTaskMove = async (taskId: string, targetColId: string, newOrder: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.parentTaskId) {
      // Direct promotion: any subtask move in Kanban promotes it
      await reorderTasks([{ id: taskId, order: newOrder, parentTaskId: undefined }]);
      return;
    }

    const sourceIsSameAsTarget =
      (targetColId === "no-date" && noDateTasks.some((t) => t.id === taskId)) ||
      (targetColId === "no-section" && noSectionTasks.some((t) => t.id === taskId));

    if (sourceIsSameAsTarget) {
      const colTasks = targetColId === "no-date" ? noDateTasks : noSectionTasks;
      const oldIdx = colTasks.findIndex((t) => t.id === taskId);
      if (oldIdx === -1) return;
      const reordered = arrayMove([...colTasks], oldIdx, newOrder);
      await reorderTasks(reordered.map((t, i) => ({ id: t.id, order: i })));
    } else {
      // Cross-column: update date/section (simplified for now)
      if (targetColId === "no-date") {
        await reorderTasks([{ id: taskId, order: newOrder, parentTaskId: undefined }]);
      } else if (targetColId === "no-section") {
        // If it was moved to "No Section", it might have a date already, but "No Section" column in Inbox implies it has a date but no section.
        // This logic is specific to how Inbox defines these columns.
      }
    }
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
            type="button"
            onClick={() => { const next = !todayOnly; setTodayOnly(next); saveViewState({ todayOnly: next }); }}
            className="rounded-lg px-3 py-1 text-[12.5px] font-medium transition-all duration-150"
            style={todayOnly
              ? { background: "var(--accent-bg-strong)", color: "var(--accent)" }
              : { background: "var(--bg-hover)", color: "var(--fg-muted)" }
            }
          >Today</button>
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
            onAddTask={handleAddTask}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, fontSize: 13, color: "var(--fg-muted)" }}>Loading…</div>}>
      <InboxPageContent />
    </Suspense>
  );
}
