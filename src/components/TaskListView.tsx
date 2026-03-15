"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

import type { Task, TaskPriority } from "@/types/index";
import { useSectionStore } from "@/store/sectionStore";
import { useTaskStore } from "@/store/taskStore";
import { TaskContextMenu } from "@/components/TaskContextMenu";

type Props = {
  onTaskClick: (task: Task, position: { x: number; y: number }) => void;
  filterDate?: string; // YYYY-MM-DD
};

function priorityDotClass(priority: TaskPriority): string {
  switch (priority) {
    case "low":    return "bg-blue-400";
    case "medium": return "bg-yellow-400";
    case "high":   return "bg-red-400";
    default:       return "bg-zinc-600";
  }
}

function dateOnly(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : value;
}

interface SortableRowProps {
  task: Task;
  isSubtask: boolean;
  activeId: string | null;
  renderTaskRow: (task: Task, isSubtask?: boolean) => React.ReactElement;
}

function SortableTaskRow({ task, isSubtask, activeId, renderTaskRow }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    position: "relative" as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="group/sortable outline-none">
      {renderTaskRow(task, isSubtask)}
    </div>
  );
}

function DroppableSection({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""} ${isOver ? "bg-white/[0.03] rounded-lg ring-1 ring-blue-500/20 transition-colors" : ""}`}
    >
      {children}
    </div>
  );
}

export function TaskListView({ onTaskClick, filterDate }: Props) {
  const searchParams = useSearchParams();
  const sectionIdFilter = searchParams?.get("sectionId") ?? null;

  const tasks = useTaskStore((s) => s.tasks);
  const isLoading = useTaskStore((s) => s.isLoading);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

  const sections = useSectionStore((s) => s.sections);
  const subsections = useSectionStore((s) => s.subsections);
  const loadSections = useSectionStore((s) => s.loadSections);
  const loadSubsections = useSectionStore((s) => s.loadSubsections);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId), [activeId, tasks]);

  const [showLoading, setShowLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    void loadTasks();
    const timer = setTimeout(() => setShowLoading(false), 2000);
    return () => clearTimeout(timer);
  }, [loadTasks]);

  useEffect(() => {
    void loadSections();
    void loadSubsections();
  }, [loadSections, loadSubsections]);

  // BUG FIX: Always filter out subtasks (parentTaskId set) AND done tasks from the main list.
  // Previously, filterDate path didn't exclude subtasks, causing them to show as top-level.
  const incompleteTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && !t.parentTaskId);
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => (t.status === "done" || t.status === "cancelled") && !t.parentTaskId);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let base = incompleteTasks;

    if (filterDate) {
      // Dashboard: show tasks due on this date only
      base = base.filter((t) => t.dueDate && dateOnly(t.dueDate) === filterDate);
    } else if (sectionIdFilter) {
      base = sectionIdFilter === "unsorted"
        ? base.filter((t) => !t.sectionId)
        : base.filter((t) => t.sectionId === sectionIdFilter);
    }

    return base.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [filterDate, sectionIdFilter, incompleteTasks]);

  const filteredCompleted = useMemo(() => {
    let base = completedTasks;
    if (filterDate) {
      base = base.filter((t) => t.dueDate && dateOnly(t.dueDate) === filterDate);
    } else if (sectionIdFilter) {
      base = sectionIdFilter === "unsorted"
        ? base.filter((t) => !t.sectionId)
        : base.filter((t) => t.sectionId === sectionIdFilter);
    }
    return base.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [filterDate, sectionIdFilter, completedTasks]);

  const { groups, unsorted } = useMemo(() => {
    const tasksBySectionId = new Map<string, Task[]>();
    const unsortedTasks: Task[] = [];

    for (const task of filteredTasks) {
      if (!task.sectionId) {
        unsortedTasks.push(task);
        continue;
      }
      const bucket = tasksBySectionId.get(task.sectionId) ?? [];
      bucket.push(task);
      tasksBySectionId.set(task.sectionId, bucket);
    }

    const orderedGroups = sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => {
        const sectionTasks = tasksBySectionId.get(s.id) ?? [];
        const sectionSubsections = subsections.filter((sub) => sub.sectionId === s.id);
        const tasksBySubId = new Map<string | undefined, Task[]>();

        for (const t of sectionTasks) {
          const bucket = tasksBySubId.get(t.subsectionId) ?? [];
          bucket.push(t);
          tasksBySubId.set(t.subsectionId, bucket);
        }

        return {
          key: s.id,
          title: s.title,
          icon: s.icon,
          mainTasks: tasksBySubId.get(undefined) ?? [],
          subsections: sectionSubsections
            .map((sub) => ({ ...sub, items: tasksBySubId.get(sub.id) ?? [] }))
            .filter((sub) => sub.items.length > 0 || sectionIdFilter === s.id),
          totalCount: sectionTasks.length,
        };
      })
      .filter((g) => g.totalCount > 0 || sectionIdFilter === g.key);

    return { groups: orderedGroups, unsorted: unsortedTasks };
  }, [filteredTasks, sectionIdFilter, sections, subsections]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    let targetSectionId: string | undefined = undefined;
    const overTask = tasks.find((t) => t.id === over.id);

    if (overTask) {
      targetSectionId = overTask.sectionId;
    } else {
      targetSectionId = over.id === "__unsorted__" ? undefined : (over.id as string);
    }

    if (active.id !== over.id || draggedTask.sectionId !== targetSectionId) {
      const oldIndex = filteredTasks.findIndex((t) => t.id === active.id);
      let newIndex = filteredTasks.findIndex((t) => t.id === over.id);

      if (newIndex === -1) {
        const itemsInTarget = filteredTasks.filter((t) => t.sectionId === targetSectionId);
        if (itemsInTarget.length > 0) {
          const last = itemsInTarget[itemsInTarget.length - 1]!;
          newIndex = filteredTasks.findIndex((t) => t.id === last.id);
        } else {
          newIndex = filteredTasks.length;
        }
      }

      const reordered = arrayMove(filteredTasks, oldIndex, newIndex);
      const updates = reordered.map((t, i) => ({
        id: t.id,
        order: i,
        sectionId: t.id === active.id ? targetSectionId : t.sectionId,
      }));
      await reorderTasks(updates);
    }
  };

  const renderTaskRow = (task: Task, isSubtask = false): React.ReactElement => {
    const isDone = task.status === "done";
    const subtaskItems = tasks.filter((t) => t.parentTaskId === task.id);
    const hasSubtasks = subtaskItems.length > 0;
    const isExpanded = expandedSubtasks[task.id] ?? true;

    return (
      <div key={task.id} className="flex flex-col">
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => onTaskClick(task, { x: e.clientX, y: e.clientY })}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ task, x: e.clientX, y: e.clientY });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onTaskClick(task, { x: 0, y: 0 });
          }}
          data-task-id={task.id}
          data-task-title={task.title}
          className={`group/row flex cursor-pointer items-center gap-3 rounded-lg py-2 hover:bg-white/[0.04] transition-colors ${
            isSubtask ? "pl-9 pr-3" : "px-3"
          } ${activeId === task.id ? "opacity-0" : ""}`}
        >
          {!isSubtask && (
            <div className="flex w-4 items-center justify-center opacity-0 group-hover/row:opacity-60 transition-opacity flex-none">
              <div className="cursor-grab active:cursor-grabbing text-zinc-500 text-base leading-none select-none">⠿</div>
            </div>
          )}

          {!isSubtask && hasSubtasks && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedSubtasks((prev) => ({ ...prev, [task.id]: !isExpanded }));
              }}
              className="text-[9px] text-zinc-600 hover:text-zinc-400 w-3 flex-none"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
          {!isSubtask && !hasSubtasks && <div className="w-3 flex-none" />}

          {/* Checkbox */}
          <button
            type="button"
            aria-label={isDone ? "Mark as todo" : "Mark as done"}
            onClick={(e) => {
              e.stopPropagation();
              void updateTask(task.id, { status: isDone ? "todo" : "done" });
            }}
            className={`flex flex-none items-center justify-center rounded border transition-colors ${
              isSubtask ? "h-4 w-4" : "h-[18px] w-[18px]"
            } ${
              isDone
                ? "border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/20"
                : "border-white/15 bg-transparent hover:border-white/30"
            }`}
          >
            {isDone && <div className={`rounded-sm bg-emerald-400 ${isSubtask ? "h-2 w-2" : "h-2.5 w-2.5"}`} />}
          </button>

          {/* Priority dot */}
          <div className={`h-2 w-2 flex-none rounded-full ${priorityDotClass(task.priority)}`} aria-hidden />

          {/* Title + meta */}
          <div className="min-w-0 flex-1">
            <div className={`truncate text-sm ${isDone ? "line-through text-zinc-600" : "text-zinc-200"}`}>
              {task.title || "(Untitled)"}
              {task.sourceDocumentId && (
                <Link
                  href={`/documents/${task.sourceDocumentId}`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  className="ml-2 inline-flex items-center text-xs text-zinc-600 hover:text-zinc-400 no-underline"
                  title={`From: ${task.sourceDocumentTitle || "Untitled"}`}
                >
                  📄
                </Link>
              )}
              {task.rolledOver && (
                <span className="ml-2 text-xs" title={`Rolled over from ${task.rolledOverFrom}`}>🔄</span>
              )}
            </div>
            {task.dueDate && !filterDate && (
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {dateOnly(task.dueDate)}
              </div>
            )}
          </div>
        </div>

        {!isSubtask && isExpanded && hasSubtasks && (
          <div className="flex flex-col">
            {subtaskItems.map((st) => renderTaskRow(st, true))}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (
    key: string,
    title: string,
    mainTasks: Task[],
    subsectionList: Array<{ id: string; title: string; items: Task[] }>,
    icon?: string,
  ) => {
    const isCollapsed = collapsed[key] ?? false;
    const total = mainTasks.length + subsectionList.reduce((s, sub) => s + sub.items.length, 0);

    return (
      <DroppableSection key={key} id={key} className="pb-1">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => ({ ...prev, [key]: !isCollapsed }))}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span className="flex min-w-0 items-center gap-2">
            {icon && <span className="flex-none">{icon}</span>}
            <span className="truncate">{title}</span>
          </span>
          <span className="ml-3 flex-none text-[10px] text-zinc-600 tabular-nums">
            {total}
          </span>
        </button>

        {!isCollapsed && (
          <div className="flex flex-col gap-0.5">
            {mainTasks.length > 0 && (
              <SortableContext items={mainTasks.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col">
                  {mainTasks.map((item) => (
                    <SortableTaskRow key={item.id} task={item} isSubtask={false} activeId={activeId} renderTaskRow={renderTaskRow} />
                  ))}
                </div>
              </SortableContext>
            )}

            {subsectionList.map((sub) => {
              const subCollapsed = collapsed[`sub_${sub.id}`] ?? false;
              return (
                <div key={sub.id} className="mt-1 pl-4 border-l border-white/5 ml-1">
                  <button
                    onClick={() => setCollapsed((prev) => ({ ...prev, [`sub_${sub.id}`]: !subCollapsed }))}
                    className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    <span># {sub.title}</span>
                    <span className="text-[10px] opacity-60">{sub.items.length}</span>
                  </button>
                  {!subCollapsed && (
                    <SortableContext items={sub.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="flex flex-col mt-0.5">
                        {sub.items.map((item) => (
                          <SortableTaskRow key={item.id} task={item} isSubtask={false} activeId={activeId} renderTaskRow={renderTaskRow} />
                        ))}
                      </div>
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
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-zinc-600">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-800 border-t-zinc-500" />
        <span className="text-xs">Loading tasks…</span>
      </div>
    );
  }

  const isEmpty = filteredTasks.length === 0 && filteredCompleted.length === 0 && tasks.length === 0;

  if (isEmpty && !isLoading) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-2xl bg-white/5 p-6 text-4xl">✨</div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-300">No tasks yet</p>
          <p className="text-xs text-zinc-500">
            Press <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">⌘K</kbd> to create your first task.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="flex flex-col gap-3">
          {/* No tasks for this date */}
          {filteredTasks.length === 0 && filterDate && filteredCompleted.length === 0 && (
            <div className="py-8 text-center text-sm text-zinc-600">
              Nothing due today
            </div>
          )}

          {groups.map((g) => renderGroup(g.key, g.title, g.mainTasks, g.subsections, g.icon))}
          {unsorted.length > 0 && renderGroup("__unsorted__", "Unsorted", unsorted, [])}

          {/* Completed tasks section */}
          {filteredCompleted.length > 0 && (
            <div className="mt-2 border-t border-white/5 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span>✓ Completed</span>
                </span>
                <span className="text-[10px] tabular-nums">{filteredCompleted.length} {showCompleted ? "▲" : "▼"}</span>
              </button>

              {showCompleted && (
                <div className="flex flex-col gap-0.5 opacity-60">
                  {filteredCompleted.map((task) => renderTaskRow(task))}
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

      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: "0.4" } },
          }),
        }}
      >
        {activeTask ? (
          <div className="pointer-events-none opacity-90 backdrop-blur-sm bg-zinc-900 shadow-2xl rounded-lg border border-white/10 p-1 scale-[1.02] ring-1 ring-white/20">
            {renderTaskRow(activeTask)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
