"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

import type { Task, TaskPriority, TaskSection } from "@/types/index";
import { useSectionStore } from "@/store/sectionStore";
import { useTaskStore } from "@/store/taskStore";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { appConfirm } from "@/lib/confirm";
import { useDragStore } from "@/store/dragStore";
import { AddTaskRow, friendlyDate, getNotesPreview, isOverdue, PriorityFlag, SelectionActionBar } from "@/components/TaskList";
import type { SortBy } from "@/components/SortFilterPopover";

type Props = {
  onTaskClick: (task: Task, position: { x: number; y: number }) => void;
  filterDate?: string;
  filterDates?: string[];
  sortBy?: SortBy;
};

// ── Color palette for sections ────────────────────────────────────────────────

const PALETTE = [
  "#6366f1","#22c55e","#f59e0b","#3b82f6",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#ef4444",
];

function getSectionAccent(s: TaskSection): string {
  if (s.color) return s.color;
  let h = 0;
  for (let i = 0; i < s.id.length; i++) h = s.id.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateOnly(v: string) { return v.includes("T") ? v.slice(0, 10) : v; }

// ── DnD wrappers ──────────────────────────────────────────────────────────────

function SortableTaskRow({ task, renderTaskRow }: {
  task: Task;
  renderTaskRow: (t: Task) => React.ReactElement;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0 : 1, position: "relative" }}
      {...attributes}
      className="outline-none"
    >
      {renderTaskRow({ ...task, dndListeners: listeners } as any)}
    </div>
  );
}

function SortableSubtaskRow({ task, renderSubtaskRow }: {
  task: Task;
  renderSubtaskRow: (t: Task) => React.ReactElement;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0 : 1, position: "relative" }}
      {...attributes}
      className="outline-none"
    >
      {renderSubtaskRow({ ...task, dndListeners: listeners } as any)}
    </div>
  );
}

function DroppableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="transition-all duration-150"
      style={isOver ? { outline: "2px solid var(--accent)", outlineOffset: "2px", borderRadius: "18px" } : {}}
    >
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TaskListView({ onTaskClick, filterDate, filterDates, sortBy }: Props) {
  const searchParams    = useSearchParams();
  const sectionIdFilter = searchParams?.get("sectionId") ?? null;

  const tasks        = useTaskStore((s) => s.tasks);
  const isLoading    = useTaskStore((s) => s.isLoading);
  const loadTasks    = useTaskStore((s) => s.loadTasks);
  const updateTask   = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

  const sections           = useSectionStore((s) => s.sections);
  const subsections        = useSectionStore((s) => s.subsections);
  const createSection      = useSectionStore((s) => s.createSection);
  const deleteSubsection   = useSectionStore((s) => s.deleteSubsection);

  const [activeId, setActiveId]           = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("stride-show-completed") === "true") setShowCompleted(true);
  }, []);
  const [showLoading, setShowLoading]     = useState(true);
  const [contextMenu, setContextMenu]     = useState<{ task: Task; x: number; y: number } | null>(null);
  const [subContextMenu, setSubContextMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null);
  const subMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!subContextMenu) return;
    const handler = (e: MouseEvent) => {
      if (subMenuRef.current && !subMenuRef.current.contains(e.target as Node)) setSubContextMenu(null);
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [subContextMenu]);
  const [collapsed, setCollapsed]         = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs]   = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("stride-subtask-collapse");
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch { return {}; }
  });
  const [editSubId, setEditSubId]         = useState<string | null>(null);
  const [editSubVal, setEditSubVal]       = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionDraft, setSectionDraft]   = useState("");

  // Multi-select state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const anchorTaskIdRef    = useRef<string | null>(null);
  const selectedTaskIdsRef = useRef<Set<string>>(new Set());
  // dragSelectionRef: snapshot of selection taken at drag-start, so drag-end always sees the right set
  const dragSelectionRef   = useRef<Set<string>>(new Set());
  useEffect(() => { selectedTaskIdsRef.current = selectedTaskIds; }, [selectedTaskIds]);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
    anchorTaskIdRef.current = null;
  }, []);

  // Sync stride-show-completed setting from storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "stride-show-completed") {
        setShowCompleted(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Escape clears selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") clearSelection(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  // Click outside task rows clears selection
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-task-id]") && !target?.closest("[data-selection-bar]")) {
        clearSelection();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [clearSelection]);

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId), [activeId, tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    void loadTasks();
    const t = setTimeout(() => setShowLoading(false), 2000);
    return () => clearTimeout(t);
  }, [loadTasks]);


  // Always exclude subtasks before any other filter
  const rootIncompleteTasks = useMemo(() =>
    tasks.filter((t) => !t.parentTaskId && t.status !== "done" && t.status !== "cancelled"),
    [tasks],
  );

  const rootCompletedTasks = useMemo(() =>
    tasks.filter((t) => !t.parentTaskId && (t.status === "done" || t.status === "cancelled")),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    let base = rootIncompleteTasks;
    if (filterDates) {
      base = base.filter((t) => t.dueDate && filterDates.includes(dateOnly(t.dueDate)));
    } else if (filterDate) {
      base = base.filter((t) => t.dueDate && dateOnly(t.dueDate) === filterDate);
    } else if (sectionIdFilter) {
      base = sectionIdFilter === "unsorted"
        ? base.filter((t) => !t.sectionId)
        : base.filter((t) => t.sectionId === sectionIdFilter);
    }
    switch (sortBy) {
      case "title": return [...base].sort((a, b) => a.title.localeCompare(b.title));
      case "priority": {
        const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return [...base].sort((a, b) => (p[a.priority ?? ""] ?? 3) - (p[b.priority ?? ""] ?? 3));
      }
      case "tag":
        return [...base].sort((a, b) => (a.tags[0] ?? "").localeCompare(b.tags[0] ?? ""));
      case "date":
        return [...base].sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return (a.order ?? 0) - (b.order ?? 0);
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });
      default:
        return [...base].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  }, [filterDate, filterDates, sectionIdFilter, rootIncompleteTasks, sortBy]);

  const filteredCompleted = useMemo(() => {
    let base = rootCompletedTasks;
    if (filterDates) base = base.filter((t) => t.dueDate && filterDates.includes(dateOnly(t.dueDate)));
    else if (filterDate) base = base.filter((t) => t.dueDate && dateOnly(t.dueDate) === filterDate);
    else if (sectionIdFilter) {
      base = sectionIdFilter === "unsorted"
        ? base.filter((t) => !t.sectionId)
        : base.filter((t) => t.sectionId === sectionIdFilter);
    }
    return base.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [filterDate, filterDates, sectionIdFilter, rootCompletedTasks]);

  const { groups, unsorted } = useMemo(() => {
    const bySection = new Map<string, Task[]>();
    const unsortedTasks: Task[] = [];
    for (const t of filteredTasks) {
      if (!t.sectionId) { unsortedTasks.push(t); continue; }
      const b = bySection.get(t.sectionId) ?? [];
      b.push(t);
      bySection.set(t.sectionId, b);
    }
    const builtGroups = sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => {
        const sTasks  = bySection.get(s.id) ?? [];
        const sSubs   = subsections.filter((sub) => sub.sectionId === s.id);
        const bySubId = new Map<string | undefined, Task[]>();
        for (const t of sTasks) {
          const b = bySubId.get(t.subsectionId) ?? [];
          b.push(t);
          bySubId.set(t.subsectionId, b);
        }
        return {
          key: s.id,
          title: s.title,
          icon: s.icon,
          section: s,
          accent: getSectionAccent(s),
          mainTasks: bySubId.get(undefined) ?? [],
          subsections: sSubs
            .map((sub) => ({ ...sub, items: bySubId.get(sub.id) ?? [] }))
            .filter((sub) => sub.items.length > 0 || sectionIdFilter === s.id),
          totalCount: sTasks.length,
        };
      })
      .filter((g) => sectionIdFilter ? g.key === sectionIdFilter : g.totalCount >= 0);
    return { groups: builtGroups, unsorted: unsortedTasks };
  }, [filteredTasks, sectionIdFilter, sections, subsections]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
    dragSelectionRef.current = new Set(selectedTaskIds);
    useDragStore.getState().setDragging(e.active.id as string);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    useDragStore.getState().clearDragging();
    if (!over) return;
    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;
    const overTask = tasks.find((t) => t.id === over.id);

    // ── Subtask drag handling ────────────────────────────────────────────────
    if (draggedTask.parentTaskId) {
      const draggedParent = tasks.find((t) => t.id === draggedTask.parentTaskId);
      if (!draggedParent) return;

      if (overTask?.parentTaskId === draggedTask.parentTaskId) {
        // Reorder within same parent — update subtaskIds array
        const currentIds = draggedParent.subtaskIds.length > 0
          ? draggedParent.subtaskIds
          : tasks.filter((st) => st.parentTaskId === draggedParent.id).map((st) => st.id);
        const oldIdx = currentIds.indexOf(active.id as string);
        const newIdx = currentIds.indexOf(over.id as string);
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          await updateTask(draggedParent.id, { subtaskIds: arrayMove(currentIds, oldIdx, newIdx) });
        }
      } else if (overTask) {
        // Reparent — drop on a different parent or its subtask
        const newParentId = overTask.parentTaskId ?? overTask.id;
        const newParent = tasks.find((t) => t.id === newParentId);
        if (!newParent || newParent.id === draggedParent.id) return;
        // Remove from old parent
        await updateTask(draggedParent.id, { subtaskIds: draggedParent.subtaskIds.filter((id) => id !== draggedTask.id) });
        // Insert into new parent at target position
        const insertAt = overTask.parentTaskId
          ? newParent.subtaskIds.indexOf(overTask.id)
          : newParent.subtaskIds.length;
        const newSubIds = [...newParent.subtaskIds];
        newSubIds.splice(insertAt >= 0 ? insertAt : newSubIds.length, 0, draggedTask.id);
        await updateTask(newParent.id, { subtaskIds: newSubIds });
        await updateTask(draggedTask.id, { parentTaskId: newParent.id, sectionId: newParent.sectionId });
      } else {
        // Promote to standalone — drop on section droppable
        const newSectionId = over.id === "__unsorted__" ? undefined : (over.id as string);
        await updateTask(draggedParent.id, { subtaskIds: draggedParent.subtaskIds.filter((id) => id !== draggedTask.id) });
        await updateTask(draggedTask.id, { parentTaskId: undefined, sectionId: newSectionId });
      }
      return;
    }

    const targetSection = overTask
      ? overTask.sectionId
      : over.id === "__unsorted__" ? undefined : (over.id as string);

    if (active.id !== over.id || draggedTask.sectionId !== targetSection) {
      const oldIdx = filteredTasks.findIndex((t) => t.id === active.id);
      let newIdx   = filteredTasks.findIndex((t) => t.id === over.id);
      if (newIdx === -1) {
        const last = filteredTasks.filter((t) => t.sectionId === targetSection).at(-1);
        newIdx = last ? filteredTasks.findIndex((t) => t.id === last.id) : filteredTasks.length;
      }
      const reordered = arrayMove(filteredTasks, oldIdx, newIdx);
      await reorderTasks(
        reordered.map((t, i) => ({
          id: t.id, order: i,
          sectionId: t.id === active.id ? targetSection : t.sectionId,
        })),
      );
      // If dragged to a different section, move all other selected tasks there too
      if (draggedTask.sectionId !== targetSection) {
        const othersToMove = [...dragSelectionRef.current].filter((id) => id !== active.id);
        if (othersToMove.length > 0) {
          await reorderTasks(othersToMove.map((id) => ({ id, order: 9999, sectionId: targetSection })));
        }
      }
    }
  };

  // ── Task row renderer ─────────────────────────────────────────────────────

  // Flat visible order for range selection (mirrors visual render order, including expanded subtasks)
  const flatVisibleOrder = useMemo(() => {
    const withSubs = (taskList: Task[]) => taskList.flatMap((t) => {
      const subs = tasks.filter((st) => st.parentTaskId === t.id);
      const expanded = expandedSubs[t.id] ?? true;
      return expanded ? [t, ...subs] : [t];
    });
    return [
      ...withSubs(unsorted),
      ...groups.flatMap((g) => [
        ...withSubs(g.mainTasks),
        ...g.subsections.flatMap((s) => withSubs(s.items)),
      ]),
    ];
  }, [unsorted, groups, tasks, expandedSubs]);

  const renderRow = (task: Task, skipSubtasks = false): React.ReactElement => {
    const isDone       = task.status === "done";
    // Only show subtasks that share the same section as the parent
    const subtaskItemsAll = tasks.filter((t) => t.parentTaskId === task.id);
    const subtaskItems = subtaskItemsAll.filter((t) => t.sectionId === task.sectionId);
    const hasSubtasks  = subtaskItems.length > 0;
    const expanded     = expandedSubs[task.id] ?? true;
    const isSelected   = selectedTaskIds.has(task.id);

    const handleRowClick = (e: React.MouseEvent) => {
      if (e.shiftKey || e.metaKey) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
      }
      // Cmd+click: toggle individual task
      if (e.metaKey) {
        setSelectedTaskIds((prev) => {
          const next = new Set(prev);
          if (next.has(task.id)) { next.delete(task.id); } else { next.add(task.id); anchorTaskIdRef.current = task.id; }
          return next;
        });
        return;
      }
      // Shift+click: range select
      if (e.shiftKey) {
        if (anchorTaskIdRef.current) {
          const aIdx = flatVisibleOrder.findIndex((t) => t.id === anchorTaskIdRef.current);
          const bIdx = flatVisibleOrder.findIndex((t) => t.id === task.id);
          if (aIdx >= 0 && bIdx >= 0) {
            const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
            setSelectedTaskIds(new Set(flatVisibleOrder.slice(lo, hi + 1).map((t) => t.id)));
          }
        }
        return;
      }
      // Regular click: open modal
      clearSelection();
      anchorTaskIdRef.current = task.id;
      onTaskClick(task, { x: e.clientX, y: e.clientY });
    };

    return (
      <div key={task.id} className={activeId === task.id ? "opacity-0" : ""}>
        {/* Main row */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleRowClick}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ task, x: e.clientX, y: e.clientY }); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onTaskClick(task, { x: 0, y: 0 }); }}
          data-task-id={task.id}
          data-task-title={task.title}
          {...(task as any).dndListeners}
          className="group/row flex cursor-pointer items-center gap-3 px-4 py-[11px] transition-colors duration-100"
          style={{
            background: isSelected ? "var(--accent-bg)" : undefined,
            outline: isSelected ? "1px solid rgba(99,102,241,0.20)" : undefined,
          }}
          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "var(--accent-bg)" : ""; }}
        >
          {/* Checkbox — rounded rectangle */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void updateTask(task.id, { status: isDone ? "todo" : "done" }); }}
            className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[4px] transition-all duration-150"
            style={isDone
              ? { background: "var(--accent)", border: "1.5px solid var(--accent)" }
              : { border: "1.5px solid var(--border-strong)", background: "transparent" }
            }
          >
            {isDone && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* Title + notes preview */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span
                className="task-title-text truncate"
                style={isDone
                  ? { textDecoration: "line-through", color: "var(--fg-faint)" }
                  : { color: "var(--fg)" }
                }
              >
                {task.title || "(Untitled)"}
              </span>
              {task.rolledOver && (
                <span className="text-[11px] opacity-40 flex-none" title={`Rolled over from ${task.rolledOverFrom}`}>↩</span>
              )}
            </div>
            {(() => {
              const preview = getNotesPreview(task.notes);
              return preview ? (
                <div className="truncate text-[11px] mt-0.5" style={{ color: "var(--fg-faint)" }}>
                  {preview}
                </div>
              ) : null;
            })()}
          </div>

          {/* Right side: chips + collapse chevron */}
          <div className="flex flex-none items-center gap-1.5">
            {task.priority !== "none" && <PriorityFlag priority={task.priority} />}
            {task.dueDate && (
              <span
                className="rounded-lg px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                style={isOverdue(dateOnly(task.dueDate))
                  ? { background: "rgba(239,68,68,0.08)", color: "var(--priority-high)" }
                  : { background: "var(--accent-bg)", color: "var(--accent)" }
                }
              >
                {friendlyDate(dateOnly(task.dueDate))}
              </span>
            )}
            {hasSubtasks && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpandedSubs((p) => { const next = { ...p, [task.id]: !expanded }; try { localStorage.setItem("stride-subtask-collapse", JSON.stringify(next)); } catch {} return next; }); }}
                className="flex h-5 w-5 flex-none items-center justify-center rounded-md transition-all duration-150 hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--fg-faint)" }}
                title={expanded ? "Collapse subtasks" : "Expand subtasks"}
              >
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className="transition-transform duration-200"
                  style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                >
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Subtasks — indented, lightweight */}
        {!skipSubtasks && hasSubtasks && expanded && (
          <div>
            {subtaskItems.map((st, stIdx) => {
              const stDone    = st.status === "done";
              const isEditing = editSubId === st.id;
              const stSelected = selectedTaskIds.has(st.id);
              const stChip = st.dueDate
                ? (() => {
                    const d = st.dueDate.includes("T") ? st.dueDate.slice(0, 10) : st.dueDate;
                    return isOverdue(d)
                      ? { label: friendlyDate(d), bg: "rgba(239,68,68,0.08)", color: "var(--priority-high)" }
                      : { label: friendlyDate(d), bg: "var(--accent-bg)", color: "var(--accent)" };
                  })()
                : null;

              const handleSubtaskClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  e.preventDefault();
                  window.getSelection()?.removeAllRanges();
                  if (anchorTaskIdRef.current) {
                    const aIdx = flatVisibleOrder.findIndex((t) => t.id === anchorTaskIdRef.current);
                    const bIdx = flatVisibleOrder.findIndex((t) => t.id === st.id);
                    if (aIdx >= 0 && bIdx >= 0) {
                      const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
                      setSelectedTaskIds(new Set(flatVisibleOrder.slice(lo, hi + 1).map((t) => t.id)));
                    }
                  }
                  return;
                }
                clearSelection();
                anchorTaskIdRef.current = st.id;
                onTaskClick(st, { x: e.clientX, y: e.clientY });
              };

              return (
                <div
                  key={st.id}
                  data-task-id={st.id}
                  data-task-title={st.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 36,
                    paddingRight: 16,
                    paddingTop: 5,
                    paddingBottom: stIdx === subtaskItems.length - 1 ? 11 : 5,
                    background: stSelected ? "var(--accent-bg)" : undefined,
                    outline: stSelected ? "1px solid rgba(99,102,241,0.20)" : undefined,
                    cursor: "pointer",
                    gap: 10,
                  }}
                  onClick={handleSubtaskClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ task: st, x: e.clientX, y: e.clientY }); }}
                  onMouseEnter={(e) => { if (!stSelected) e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = stSelected ? "var(--accent-bg)" : ""; }}
                >

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void updateTask(st.id, { status: stDone ? "todo" : "done" }); }}
                    className="flex flex-none items-center justify-center rounded-[4px] transition-all duration-150"
                    style={{
                      width: 17,
                      height: 17,
                      flexShrink: 0,
                      ...(stDone
                        ? { background: "var(--accent)", border: "1.5px solid var(--accent)" }
                        : { border: "1.5px solid var(--border-strong)", background: "transparent" })
                    }}
                  >
                    {stDone && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  {isEditing ? (
                    <input
                      autoFocus
                      value={editSubVal}
                      onChange={(e) => setEditSubVal(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" || e.key === "Escape") {
                          if (editSubVal.trim() && editSubVal.trim() !== st.title)
                            void updateTask(st.id, { title: editSubVal.trim() });
                          setEditSubId(null);
                        }
                      }}
                      onBlur={() => {
                        if (editSubVal.trim() && editSubVal.trim() !== st.title)
                          void updateTask(st.id, { title: editSubVal.trim() });
                        setEditSubId(null);
                      }}
                      className="flex-1 bg-transparent outline-none"
                      style={{ color: "var(--fg)", fontSize: "16px" }}
                    />
                  ) : (
                    <span
                      onClick={(e) => { e.stopPropagation(); setEditSubId(st.id); setEditSubVal(st.title); }}
                      className="task-title-text flex-1 truncate"
                      style={{
                        cursor: "text",
                        ...(stDone
                          ? { textDecoration: "line-through", color: "var(--fg-faint)" }
                          : { color: "var(--fg)" })
                      }}
                    >
                      {st.title || "(Untitled)"}
                    </span>
                  )}

                  {/* Due date chip */}
                  {stChip && (
                    <span
                      className="flex-none rounded-lg px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                      style={{ background: stChip.bg, color: stChip.color }}
                    >
                      {stChip.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Standalone subtask row renderer (for flat DnD list) ──────────────────

  const renderSubtaskItem = (st: Task, isLast: boolean): React.ReactElement => {
    const stDone    = st.status === "done";
    const isEditing = editSubId === st.id;
    const stSelected = selectedTaskIds.has(st.id);
    const stChip = st.dueDate
      ? (() => {
          const d = st.dueDate.includes("T") ? st.dueDate.slice(0, 10) : st.dueDate;
          return isOverdue(d)
            ? { label: friendlyDate(d), bg: "rgba(239,68,68,0.08)", color: "var(--priority-high)" }
            : { label: friendlyDate(d), bg: "var(--accent-bg)", color: "var(--accent)" };
        })()
      : null;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        if (anchorTaskIdRef.current) {
          const aIdx = flatVisibleOrder.findIndex((t) => t.id === anchorTaskIdRef.current);
          const bIdx = flatVisibleOrder.findIndex((t) => t.id === st.id);
          if (aIdx >= 0 && bIdx >= 0) {
            const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
            setSelectedTaskIds(new Set(flatVisibleOrder.slice(lo, hi + 1).map((t) => t.id)));
          }
        }
        return;
      }
      clearSelection();
      anchorTaskIdRef.current = st.id;
      onTaskClick(st, { x: e.clientX, y: e.clientY });
    };

    return (
      <div
        data-task-id={st.id}
        data-task-title={st.title}
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft: 36,
          paddingRight: 16,
          paddingTop: 5,
          paddingBottom: isLast ? 11 : 5,
          background: stSelected ? "var(--accent-bg)" : undefined,
          outline: stSelected ? "1px solid rgba(99,102,241,0.20)" : undefined,
          cursor: "pointer",
          gap: 10,
        }}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ task: st, x: e.clientX, y: e.clientY }); }}
        onMouseEnter={(e) => { if (!stSelected) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = stSelected ? "var(--accent-bg)" : ""; }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void updateTask(st.id, { status: stDone ? "todo" : "done" }); }}
          className="flex flex-none items-center justify-center rounded-[4px] transition-all duration-150"
          style={{
            width: 17, height: 17, flexShrink: 0,
            ...(stDone
              ? { background: "var(--accent)", border: "1.5px solid var(--accent)" }
              : { border: "1.5px solid var(--border-strong)", background: "transparent" }),
          }}
        >
          {stDone && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        {isEditing ? (
          <input
            autoFocus
            value={editSubVal}
            onChange={(e) => setEditSubVal(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === "Escape") {
                if (editSubVal.trim() && editSubVal.trim() !== st.title)
                  void updateTask(st.id, { title: editSubVal.trim() });
                setEditSubId(null);
              }
            }}
            onBlur={() => {
              if (editSubVal.trim() && editSubVal.trim() !== st.title)
                void updateTask(st.id, { title: editSubVal.trim() });
              setEditSubId(null);
            }}
            className="flex-1 bg-transparent outline-none"
            style={{ color: "var(--fg)", fontSize: "16px" }}
          />
        ) : (
          <span
            onClick={(e) => { e.stopPropagation(); setEditSubId(st.id); setEditSubVal(st.title); }}
            className="task-title-text flex-1 truncate"
            style={{
              cursor: "text",
              ...(stDone
                ? { textDecoration: "line-through", color: "var(--fg-faint)" }
                : { color: "var(--fg)" }),
            }}
          >
            {st.title || "(Untitled)"}
          </span>
        )}
        {stChip && (
          <span
            className="flex-none rounded-lg px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
            style={{ background: stChip.bg, color: stChip.color }}
          >
            {stChip.label}
          </span>
        )}
      </div>
    );
  };

  // ── Section panel renderer ────────────────────────────────────────────────

  const renderSection = (
    key: string,
    title: string,
    mainTasks: Task[],
    subs: { id: string; title: string; items: Task[] }[],
    accent: string,
    icon?: string,
    section?: TaskSection,
  ) => {
    const isCollapsed = collapsed[key] ?? false;
    const total = mainTasks.length + subs.reduce((n, s) => n + s.items.length, 0);
    const sectionId = key === "__unsorted__" ? undefined : (section?.id ?? key);

    return (
      <DroppableSection key={key} id={key}>
        <div
          className="mb-3 overflow-hidden rounded-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Header */}
          <button
            type="button"
            onClick={() => setCollapsed((p) => ({ ...p, [key]: !isCollapsed }))}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--bg-hover)]"
            style={!isCollapsed ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: accent }} />
            {icon && <span className="text-sm">{icon}</span>}
            <span className="flex-1 text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
              {title}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--fg-faint)" }}>
              {total}
            </span>
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className="flex-none transition-transform duration-200"
              style={{
                color: "var(--fg-faint)",
                transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
              }}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {!isCollapsed && (
            <>
              {/* Empty state */}
              {total === 0 && (
                <div className="px-4 py-5 text-center text-[12px] italic" style={{ color: "var(--fg-faint)" }}>
                  No tasks yet
                </div>
              )}

              {/* Main tasks in this section — flat list including subtasks as separate sortable items */}
              {mainTasks.length > 0 && (() => {
                const flatItems = mainTasks.flatMap((t) => {
                  const visibleSubs = (expandedSubs[t.id] ?? true)
                    ? tasks.filter((st) => st.parentTaskId === t.id && st.sectionId === t.sectionId)
                    : [];
                  return [
                    { task: t, isSubtask: false, isLast: visibleSubs.length === 0 },
                    ...visibleSubs.map((st, idx) => ({ task: st, isSubtask: true, isLast: idx === visibleSubs.length - 1 })),
                  ];
                });
                return (
                  <SortableContext items={flatItems.map((item) => item.task.id)} strategy={verticalListSortingStrategy}>
                    {flatItems.map(({ task: t, isSubtask, isLast }) => (
                      <div key={t.id} style={isLast ? { borderBottom: "1px solid var(--border)" } : {}}>
                        {isSubtask ? (
                          <SortableSubtaskRow task={t} renderSubtaskRow={(st) => renderSubtaskItem(st, isLast)} />
                        ) : (
                          <SortableTaskRow task={t} renderTaskRow={(task) => renderRow(task, true)} />
                        )}
                      </div>
                    ))}
                  </SortableContext>
                );
              })()}

              {/* Subsections */}
              {subs.map((sub) => {
                const subCollapsed = collapsed[`sub_${sub.id}`] ?? false;
                return (
                  <div key={sub.id}>
                    <button
                      type="button"
                      onClick={() => setCollapsed((p) => ({ ...p, [`sub_${sub.id}`]: !subCollapsed }))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSubContextMenu({ id: sub.id, title: sub.title, x: e.clientX, y: e.clientY });
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 transition-colors duration-150 hover:bg-[var(--bg-hover)]"
                      style={{
                        borderTop: "1px solid var(--border)",
                        borderBottom: subCollapsed ? "none" : "1px solid var(--border)",
                      }}
                    >
                      <span className="text-[11px] font-semibold uppercase" style={{ color: "var(--fg-faint)" }}>
                        {sub.title}
                      </span>
                      <span className="ml-auto text-[10px] tabular-nums" style={{ color: "var(--fg-faint)" }}>
                        {sub.items.length}
                      </span>
                    </button>
                    {!subCollapsed && (() => {
                      const flatSubItems = sub.items.flatMap((t) => {
                        const visibleSubs = (expandedSubs[t.id] ?? true)
                          ? tasks.filter((st) => st.parentTaskId === t.id && st.sectionId === t.sectionId)
                          : [];
                        return [
                          { task: t, isSubtask: false, isLast: visibleSubs.length === 0 },
                          ...visibleSubs.map((st, idx) => ({ task: st, isSubtask: true, isLast: idx === visibleSubs.length - 1 })),
                        ];
                      });
                      return (
                        <SortableContext items={flatSubItems.map((item) => item.task.id)} strategy={verticalListSortingStrategy}>
                          {flatSubItems.map(({ task: t, isSubtask, isLast }) => (
                            <div key={t.id} style={isLast ? { borderBottom: "1px solid var(--border)" } : {}}>
                              {isSubtask ? (
                                <SortableSubtaskRow task={t} renderSubtaskRow={(st) => renderSubtaskItem(st, isLast)} />
                              ) : (
                                <SortableTaskRow task={t} renderTaskRow={(task) => renderRow(task, true)} />
                              )}
                            </div>
                          ))}
                        </SortableContext>
                      );
                    })()}
                  </div>
                );
              })}

              {/* Inline add task */}
              <AddTaskRow sectionId={sectionId} />
            </>
          )}
        </div>
      </DroppableSection>
    );
  };

  // ── Loading / empty states ────────────────────────────────────────────────

  if (isLoading && showLoading) {
    return (
      <div className="flex h-32 items-center justify-center gap-2.5" style={{ color: "var(--fg-faint)" }}>
        <div
          className="h-4 w-4 animate-spin rounded-full border-2"
          style={{ borderColor: "var(--border-mid)", borderTopColor: "var(--fg-muted)" }}
        />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1.5 text-center">
        <p className="text-[13px]" style={{ color: "var(--fg-faint)" }}>No tasks yet</p>
        <p className="text-[12px]" style={{ color: "var(--fg-faint)" }}>
          Press{" "}
          <kbd
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{ background: "var(--bg-subtle)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
          >⌘K</kbd>
          {" "}to add one
        </p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full px-4 py-4">

        {/* filterDate: flat single-panel list */}
        {filterDate ? (
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {filteredTasks.length === 0 ? (
              <div className="py-10 text-center text-[13px]" style={{ color: "var(--fg-faint)" }}>
                Nothing due today
              </div>
            ) : (
              <SortableContext items={filteredTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {filteredTasks.map((t, idx) => (
                  <div key={t.id} style={idx > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
                    <SortableTaskRow task={t} renderTaskRow={renderRow} />
                  </div>
                ))}
              </SortableContext>
            )}
          </div>
        ) : (
          /* Section panels */
          <>
            {groups.map((g) =>
              renderSection(g.key, g.title, g.mainTasks, g.subsections, g.accent, g.icon, g.section),
            )}
            {unsorted.length > 0 && renderSection("__unsorted__", "Inbox", unsorted, [], "var(--fg-faint)")}

            {/* New section */}
            <div className="mt-1 mb-2">
              {addingSection ? (
                <input
                  autoFocus
                  value={sectionDraft}
                  onChange={(e) => setSectionDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setAddingSection(false); setSectionDraft(""); }
                    if (e.key === "Enter") {
                      const t = sectionDraft.trim();
                      if (t) void createSection(t);
                      setAddingSection(false);
                      setSectionDraft("");
                    }
                  }}
                  onBlur={() => { setAddingSection(false); setSectionDraft(""); }}
                  placeholder="Section name…"
                  className="h-9 w-full rounded-xl px-4 outline-none"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--accent)",
                    color: "var(--fg)",
                    fontSize: "16px",
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSection(true)}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] transition-colors duration-150 hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--fg-faint)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <line x1="6.5" y1="1" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="1" y1="6.5" x2="12" y2="6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  New section
                </button>
              )}
            </div>
          </>
        )}

        {/* Completed */}
        {filteredCompleted.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="flex w-full items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-medium transition-colors duration-150 hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--fg-faint)" }}
            >
              <svg
                width="11" height="11" viewBox="0 0 11 11" fill="none"
                className="flex-none transition-transform duration-200"
                style={{ transform: showCompleted ? "rotate(0deg)" : "rotate(-90deg)" }}
              >
                <path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Completed
              <span className="ml-auto tabular-nums">{filteredCompleted.length}</span>
            </button>
            {showCompleted && (
              <div
                className="mt-1 overflow-hidden rounded-2xl opacity-60"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {filteredCompleted.map((t, idx) => (
                  <div key={t.id} style={idx > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
                    {renderRow(t)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          selectedIds={selectedTaskIds.size > 1 ? selectedTaskIds : undefined}
        />
      )}

      {selectedTaskIds.size >= 2 && (
        <SelectionActionBar selectedIds={selectedTaskIds} onClear={clearSelection} />
      )}

      {subContextMenu && (
        <div
          ref={subMenuRef}
          style={{
            position: "fixed",
            left: subContextMenu.x,
            top: subContextMenu.y,
            background: "var(--bg-card)",
            border: "1px solid var(--border-mid)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 9999,
          }}
          className="w-[180px] select-none rounded-xl p-1"
        >
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-red-500/10"
            style={{ color: "#ef4444" }}
            onClick={() => {
              void appConfirm(`Delete subsection "${subContextMenu.title}"? Tasks inside will be moved to the main section.`).then((ok) => {
                if (ok) void deleteSubsection(subContextMenu.id);
              });
              setSubContextMenu(null);
            }}
          >
            Delete Subsection
          </button>
        </div>
      )}

      <DragOverlay
        dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.3" } } }) }}
      >
        {activeTask && (
          <div
            className="pointer-events-none overflow-hidden rounded-xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-mid)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {activeTask.parentTaskId
              ? renderSubtaskItem(activeTask, false)
              : renderRow(activeTask)
            }
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}