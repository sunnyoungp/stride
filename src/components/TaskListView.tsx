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

import type { Task, TaskPriority } from "@/types/index";
import { useSectionStore } from "@/store/sectionStore";
import { useTaskStore } from "@/store/taskStore";
import { TaskContextMenu } from "@/components/TaskContextMenu";

type Props = {
  onTaskClick: (task: Task, position: { x: number; y: number }) => void;
  filterDate?: string;
};

function priorityDot(p: TaskPriority): string {
  switch (p) {
    case "low":    return "bg-blue-500";
    case "medium": return "bg-amber-500";
    case "high":   return "bg-red-500";
    default:       return "bg-zinc-700";
  }
}

function dateOnly(v: string) { return v.includes("T") ? v.slice(0, 10) : v; }

function SortableTaskRow({ task, isSubtask, activeId, renderTaskRow }: {
  task: Task; isSubtask: boolean; activeId: string | null;
  renderTaskRow: (t: Task, sub?: boolean) => React.ReactElement;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.25 : 1 }}
      {...attributes} {...listeners}
      className="outline-none"
    >
      {renderTaskRow(task, isSubtask)}
    </div>
  );
}

function DroppableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`transition-colors rounded-xl ${isOver ? "ring-1 ring-blue-500/20 bg-blue-500/[0.03]" : ""}`}>
      {children}
    </div>
  );
}

export function TaskListView({ onTaskClick, filterDate }: Props) {
  const searchParams   = useSearchParams();
  const sectionIdFilter = searchParams?.get("sectionId") ?? null;

  const tasks        = useTaskStore((s) => s.tasks);
  const isLoading    = useTaskStore((s) => s.isLoading);
  const loadTasks    = useTaskStore((s) => s.loadTasks);
  const updateTask   = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

  const sections       = useSectionStore((s) => s.sections);
  const subsections    = useSectionStore((s) => s.subsections);
  const loadSections   = useSectionStore((s) => s.loadSections);
  const loadSubsections = useSectionStore((s) => s.loadSubsections);

  const [activeId, setActiveId]         = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showLoading, setShowLoading]   = useState(true);
  const [contextMenu, setContextMenu]   = useState<{ task: Task; x: number; y: number } | null>(null);
  const [collapsed, setCollapsed]       = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId), [activeId, tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    void loadTasks();
    const t = setTimeout(() => setShowLoading(false), 2000);
    return () => clearTimeout(t);
  }, [loadTasks]);

  useEffect(() => {
    void loadSections();
    void loadSubsections();
  }, [loadSections, loadSubsections]);

  // FIX: always exclude subtasks (parentTaskId set) before any other filtering
  const rootIncompleteTasks = useMemo(() =>
    tasks.filter((t) => !t.parentTaskId && t.status !== "done" && t.status !== "cancelled"),
    [tasks]
  );

  const rootCompletedTasks = useMemo(() =>
    tasks.filter((t) => !t.parentTaskId && (t.status === "done" || t.status === "cancelled")),
    [tasks]
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
      b.push(t); bySection.set(t.sectionId, b);
    }
    const groups = sections.slice().sort((a, b) => a.order - b.order).map((s) => {
      const sTasks = bySection.get(s.id) ?? [];
      const sSubs  = subsections.filter((sub) => sub.sectionId === s.id);
      const bySubId = new Map<string | undefined, Task[]>();
      for (const t of sTasks) {
        const b = bySubId.get(t.subsectionId) ?? [];
        b.push(t); bySubId.set(t.subsectionId, b);
      }
      return {
        key: s.id, title: s.title, icon: s.icon,
        mainTasks: bySubId.get(undefined) ?? [],
        subsections: sSubs.map((sub) => ({ ...sub, items: bySubId.get(sub.id) ?? [] }))
          .filter((sub) => sub.items.length > 0 || sectionIdFilter === s.id),
        totalCount: sTasks.length,
      };
    }).filter((g) => g.totalCount > 0 || sectionIdFilter === g.key);
    return { groups, unsorted: unsortedTasks };
  }, [filteredTasks, sectionIdFilter, sections, subsections]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;
    const overTask = tasks.find((t) => t.id === over.id);
    const targetSection = overTask ? overTask.sectionId
      : over.id === "__unsorted__" ? undefined : (over.id as string);

    if (active.id !== over.id || draggedTask.sectionId !== targetSection) {
      const oldIdx = filteredTasks.findIndex((t) => t.id === active.id);
      let newIdx   = filteredTasks.findIndex((t) => t.id === over.id);
      if (newIdx === -1) {
        const last = filteredTasks.filter((t) => t.sectionId === targetSection).at(-1);
        newIdx = last ? filteredTasks.findIndex((t) => t.id === last.id) : filteredTasks.length;
      }
      const reordered = arrayMove(filteredTasks, oldIdx, newIdx);
      await reorderTasks(reordered.map((t, i) => ({
        id: t.id, order: i,
        sectionId: t.id === active.id ? targetSection : t.sectionId,
      })));
    }
  };

  const renderRow = (task: Task, isSubtask = false): React.ReactElement => {
    const isDone      = task.status === "done";
    const subtaskItems = tasks.filter((t) => t.parentTaskId === task.id);
    const hasSubtasks  = subtaskItems.length > 0;
    const expanded     = expandedSubs[task.id] ?? true;

    return (
      <div key={task.id} className="flex flex-col">
        <div
          role="button" tabIndex={0}
          onClick={(e) => onTaskClick(task, { x: e.clientX, y: e.clientY })}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ task, x: e.clientX, y: e.clientY }); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onTaskClick(task, { x: 0, y: 0 }); }}
          data-task-id={task.id} data-task-title={task.title}
          className={`group/row flex cursor-pointer items-center gap-2.5 rounded-lg py-2 transition-colors hover:bg-white/[0.04] ${
            isSubtask ? "pl-8 pr-3" : "px-2"
          } ${activeId === task.id ? "opacity-0" : ""}`}
        >
          {/* Drag handle */}
          {!isSubtask && (
            <span className="flex-none w-3 text-center text-zinc-700 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab active:cursor-grabbing select-none text-xs">
              ⠿
            </span>
          )}

          {/* Expand subtasks arrow */}
          {!isSubtask && (
            <span className="w-3 flex-none text-center">
              {hasSubtasks && (
                <button onClick={(e) => { e.stopPropagation(); setExpandedSubs((p) => ({ ...p, [task.id]: !expanded })); }}
                  className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >{expanded ? "▾" : "▸"}</button>
              )}
            </span>
          )}

          {/* Checkbox */}
          <button type="button"
            onClick={(e) => { e.stopPropagation(); void updateTask(task.id, { status: isDone ? "todo" : "done" }); }}
            className={`flex-none flex items-center justify-center rounded border transition-colors ${
              isSubtask ? "h-[15px] w-[15px]" : "h-[17px] w-[17px]"
            } ${isDone ? "border-emerald-600/50 bg-emerald-600/15" : "border-white/15 hover:border-white/30"}`}
          >
            {isDone && <div className={`rounded-[2px] bg-emerald-400 ${isSubtask ? "h-2 w-2" : "h-2.5 w-2.5"}`} />}
          </button>

          {/* Priority dot */}
          <span className={`flex-none h-[7px] w-[7px] rounded-full ${priorityDot(task.priority)}`} />

          {/* Title */}
          <div className="min-w-0 flex-1">
            <span className={`text-sm leading-snug ${isDone ? "line-through text-zinc-600" : "text-zinc-200"}`}>
              {task.title || "(Untitled)"}
            </span>
            {task.sourceDocumentId && (
              <Link href={`/documents/${task.sourceDocumentId}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="ml-1.5 text-xs text-zinc-600 hover:text-zinc-400 no-underline"
                title={`From: ${task.sourceDocumentTitle}`}
              >📄</Link>
            )}
            {task.rolledOver && (
              <span className="ml-1.5 text-xs" title={`Rolled over from ${task.rolledOverFrom}`}>🔄</span>
            )}
            {task.dueDate && !filterDate && (
              <div className="mt-0.5 text-[11px] text-zinc-600">{dateOnly(task.dueDate)}</div>
            )}
          </div>
        </div>

        {!isSubtask && expanded && hasSubtasks && (
          <div className="flex flex-col">
            {subtaskItems.map((st) => renderRow(st, true))}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (key: string, title: string, mainTasks: Task[], subs: { id: string; title: string; items: Task[] }[], icon?: string) => {
    const isCollapsed = collapsed[key] ?? false;
    const total = mainTasks.length + subs.reduce((n, s) => n + s.items.length, 0);

    return (
      <DroppableSection key={key} id={key}>
        <button type="button"
          onClick={() => setCollapsed((p) => ({ ...p, [key]: !isCollapsed }))}
          className="flex w-full items-center justify-between px-2 py-1.5 text-left transition-colors hover:bg-white/[0.02] rounded-lg"
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-600">
            {icon && <span>{icon}</span>}
            <span>{title}</span>
          </span>
          <span className="text-[10px] text-zinc-700 tabular-nums">{total}</span>
        </button>

        {!isCollapsed && (
          <div className="flex flex-col gap-0.5 pb-2">
            {mainTasks.length > 0 && (
              <SortableContext items={mainTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {mainTasks.map((t) => (
                  <SortableTaskRow key={t.id} task={t} isSubtask={false} activeId={activeId} renderTaskRow={renderRow} />
                ))}
              </SortableContext>
            )}
            {subs.map((sub) => {
              const subCollapsed = collapsed[`sub_${sub.id}`] ?? false;
              return (
                <div key={sub.id} className="ml-2 mt-1 pl-3 border-l border-white/[0.06]">
                  <button
                    onClick={() => setCollapsed((p) => ({ ...p, [`sub_${sub.id}`]: !subCollapsed }))}
                    className="flex w-full items-center justify-between px-2 py-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <span># {sub.title}</span>
                    <span className="text-[10px] opacity-60">{sub.items.length}</span>
                  </button>
                  {!subCollapsed && (
                    <SortableContext items={sub.items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {sub.items.map((t) => (
                        <SortableTaskRow key={t.id} task={t} isSubtask={false} activeId={activeId} renderTaskRow={renderRow} />
                      ))}
                    </SortableContext>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DroppableSection>
    );
  };

  if (isLoading && showLoading) {
    return (
      <div className="flex h-48 items-center justify-center gap-3 text-zinc-700">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-800 border-t-zinc-600" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
        <div className="text-3xl opacity-20">✦</div>
        <p className="text-xs text-zinc-600">
          Press <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">⌘K</kbd> to add a task
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="mx-auto w-full max-w-3xl px-3 py-4">
        <div className="flex flex-col gap-2">
          {filteredTasks.length === 0 && filterDate && (
            <div className="py-8 text-center text-xs text-zinc-700">Nothing due today</div>
          )}

          {groups.map((g) => renderGroup(g.key, g.title, g.mainTasks, g.subsections, g.icon))}
          {unsorted.length > 0 && renderGroup("__unsorted__", "Unsorted", unsorted, [])}

          {/* Completed section */}
          {filteredCompleted.length > 0 && (
            <div className="mt-1 border-t border-white/[0.05] pt-1">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-700 hover:text-zinc-500 transition-colors rounded-lg"
              >
                <span>Completed</span>
                <span className="tabular-nums">{filteredCompleted.length} {showCompleted ? "▲" : "▼"}</span>
              </button>
              {showCompleted && (
                <div className="flex flex-col gap-0.5 opacity-50">
                  {filteredCompleted.map((t) => renderRow(t))}
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
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.3" } } }) }}>
        {activeTask && (
          <div className="pointer-events-none rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-2xl ring-1 ring-white/10">
            {renderRow(activeTask)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
