"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { useDragStore } from "@/store/dragStore";

type Props = {
  onTaskClick: (task: Task, position: { x: number; y: number }) => void;
  filterDate?: string;
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

function friendlyDate(v: string): string {
  const date = new Date(v + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0)  return "Today";
  if (diff === 1)  return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < -1)  return `${Math.abs(diff)}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function isOverdue(v: string): boolean {
  return new Date(v + "T00:00:00") < new Date(new Date().toDateString());
}

// ── Priority flag icon ────────────────────────────────────────────────────────

const PRIORITY_COLOR: Partial<Record<TaskPriority, string>> = {
  high:   "var(--priority-high)",
  medium: "var(--priority-medium)",
  low:    "var(--priority-low)",
};

function PriorityFlag({ priority }: { priority: TaskPriority }) {
  const color = PRIORITY_COLOR[priority];
  if (!color) return null;
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none" style={{ flexShrink: 0 }}>
      <line x1="2" y1="1" x2="2" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 1.5H9.5L7.5 5L9.5 8.5H2V1.5Z" fill={color} opacity=".9"/>
    </svg>
  );
}

// ── DnD wrappers ──────────────────────────────────────────────────────────────

function SortableTaskRow({ task, activeId, renderTaskRow }: {
  task: Task;
  activeId: string | null;
  renderTaskRow: (t: Task) => React.ReactElement;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      {...attributes}
      {...listeners}
      className="outline-none"
    >
      {renderTaskRow(task)}
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

// ── Inline add-task row ───────────────────────────────────────────────────────

function AddTaskRow({ sectionId, subsectionId }: { sectionId?: string; subsectionId?: string }) {
  const createTask = useTaskStore((s) => s.createTask);
  const [active, setActive] = useState(false);
  const [draft, setDraft]   = useState("");

  const commit = () => {
    const title = draft.trim();
    if (title) void createTask({ title, sectionId, subsectionId, status: "todo" });
    setDraft("");
    setActive(false);
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setActive(true); }}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] transition-colors duration-150 hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--fg-faint)" }}
      >
        <span
          className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[13px] leading-none"
          style={{ border: "1.5px dashed var(--border-strong)" }}
        >
          +
        </span>
        Add task
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <span
        className="h-[18px] w-[18px] flex-none rounded-full"
        style={{ border: "1.5px dashed var(--border-strong)" }}
      />
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter")  commit();
          if (e.key === "Escape") { setDraft(""); setActive(false); }
        }}
        onBlur={commit}
        placeholder="Task name"
        className="flex-1 bg-transparent text-[13.5px] outline-none"
        style={{ color: "var(--fg)" }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TaskListView({ onTaskClick, filterDate }: Props) {
  const searchParams    = useSearchParams();
  const sectionIdFilter = searchParams?.get("sectionId") ?? null;

  const tasks        = useTaskStore((s) => s.tasks);
  const isLoading    = useTaskStore((s) => s.isLoading);
  const loadTasks    = useTaskStore((s) => s.loadTasks);
  const updateTask   = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

  const sections        = useSectionStore((s) => s.sections);
  const subsections     = useSectionStore((s) => s.subsections);
  const createSection   = useSectionStore((s) => s.createSection);

  const [activeId, setActiveId]           = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showLoading, setShowLoading]     = useState(true);
  const [contextMenu, setContextMenu]     = useState<{ task: Task; x: number; y: number } | null>(null);
  const [collapsed, setCollapsed]         = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs]   = useState<Record<string, boolean>>({});
  const [editSubId, setEditSubId]         = useState<string | null>(null);
  const [editSubVal, setEditSubVal]       = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionDraft, setSectionDraft]   = useState("");

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
    if (filterDate) {
      base = base.filter((t) => t.dueDate && dateOnly(t.dueDate) === filterDate);
    } else if (sectionIdFilter) {
      base = sectionIdFilter === "unsorted"
        ? base.filter((t) => !t.sectionId)
        : base.filter((t) => t.sectionId === sectionIdFilter);
    }
    return base.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [filterDate, sectionIdFilter, rootIncompleteTasks]);

  const filteredCompleted = useMemo(() => {
    let base = rootCompletedTasks;
    if (filterDate) base = base.filter((t) => t.dueDate && dateOnly(t.dueDate) === filterDate);
    else if (sectionIdFilter) {
      base = sectionIdFilter === "unsorted"
        ? base.filter((t) => !t.sectionId)
        : base.filter((t) => t.sectionId === sectionIdFilter);
    }
    return base.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [filterDate, sectionIdFilter, rootCompletedTasks]);

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
      .filter((g) => g.totalCount >= 0);
    return { groups: builtGroups, unsorted: unsortedTasks };
  }, [filteredTasks, sectionIdFilter, sections, subsections]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
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
    }
  };

  // ── Task row renderer ─────────────────────────────────────────────────────

  const renderRow = (task: Task): React.ReactElement => {
    const isDone       = task.status === "done";
    const subtaskItems = tasks.filter((t) => t.parentTaskId === task.id);
    const hasSubtasks  = subtaskItems.length > 0;
    const expanded     = expandedSubs[task.id] ?? true;

    return (
      <div key={task.id} className={activeId === task.id ? "opacity-0" : ""}>
        {/* Main row */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => onTaskClick(task, { x: e.clientX, y: e.clientY })}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ task, x: e.clientX, y: e.clientY }); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onTaskClick(task, { x: 0, y: 0 }); }}
          data-task-id={task.id}
          data-task-title={task.title}
          className="group/row flex cursor-pointer items-center gap-3 px-4 py-[11px] transition-colors duration-100 hover:bg-[var(--bg-hover)]"
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

          {/* Title */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span
                className="text-[13.5px] leading-snug truncate"
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
          </div>

          {/* Right side: chips + collapse chevron */}
          <div className="flex flex-none items-center gap-1.5">
            {task.priority !== "none" && <PriorityFlag priority={task.priority} />}
            {task.dueDate && (
              <span
                className="rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
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
                onClick={(e) => { e.stopPropagation(); setExpandedSubs((p) => ({ ...p, [task.id]: !expanded })); }}
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

        {/* Subtasks — seamless indent, no lines or backgrounds */}
        {hasSubtasks && expanded && (
          <div className="pb-2">
            {subtaskItems.map((st) => {
              const stDone    = st.status === "done";
              const isEditing = editSubId === st.id;
              return (
                <div
                  key={st.id}
                  className="flex items-center gap-2.5 py-[6px] pr-4"
                  style={{ paddingLeft: "36px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void updateTask(st.id, { status: stDone ? "todo" : "done" }); }}
                    className="flex h-[14px] w-[14px] flex-none items-center justify-center rounded-[3px] transition-all duration-150"
                    style={stDone
                      ? { background: "var(--accent)", border: "1.5px solid var(--accent)" }
                      : { border: "1.5px solid var(--border-strong)", background: "transparent" }
                    }
                  >
                    {stDone && (
                      <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
                        <path d="M1 3L3 5L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                      className="flex-1 bg-transparent text-[13.5px] leading-snug outline-none"
                      style={{ color: "var(--fg)" }}
                    />
                  ) : (
                    <span
                      onClick={(e) => { e.stopPropagation(); setEditSubId(st.id); setEditSubVal(st.title); }}
                      className="flex-1 cursor-text text-[13.5px] leading-snug"
                      style={stDone
                        ? { textDecoration: "line-through", color: "var(--fg-faint)" }
                        : { color: "var(--fg-muted)" }
                      }
                    >
                      {st.title || "(Untitled)"}
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
            {icon && <span className="text-sm leading-none">{icon}</span>}
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

              {/* Main tasks in this section */}
              {mainTasks.length > 0 && (
                <SortableContext items={mainTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {mainTasks.map((t) => (
                    <div key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <SortableTaskRow task={t} activeId={activeId} renderTaskRow={renderRow} />
                    </div>
                  ))}
                </SortableContext>
              )}

              {/* Subsections */}
              {subs.map((sub) => {
                const subCollapsed = collapsed[`sub_${sub.id}`] ?? false;
                return (
                  <div key={sub.id}>
                    <button
                      type="button"
                      onClick={() => setCollapsed((p) => ({ ...p, [`sub_${sub.id}`]: !subCollapsed }))}
                      className="flex w-full items-center gap-2 px-4 py-2 transition-colors duration-150 hover:bg-[var(--bg-hover)]"
                      style={{
                        borderTop: "1px solid var(--border)",
                        borderBottom: subCollapsed ? "none" : "1px solid var(--border)",
                      }}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-faint)" }}>
                        {sub.title}
                      </span>
                      <span className="ml-auto text-[10px] tabular-nums" style={{ color: "var(--fg-faint)" }}>
                        {sub.items.length}
                      </span>
                    </button>
                    {!subCollapsed && (
                      <SortableContext items={sub.items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        {sub.items.map((t) => (
                          <div key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <SortableTaskRow task={t} activeId={activeId} renderTaskRow={renderRow} />
                          </div>
                        ))}
                      </SortableContext>
                    )}
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
                    <SortableTaskRow task={t} activeId={activeId} renderTaskRow={renderRow} />
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
                  className="h-9 w-full rounded-xl px-4 text-sm outline-none"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--accent)",
                    color: "var(--fg)",
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
        />
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
            {renderRow(activeTask)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
