"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSectionStore } from "@/store/sectionStore";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import type { Task, TaskPriority } from "@/types/index";

type Props = {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
};

const priorityOrder: TaskPriority[] = ["none", "low", "medium", "high"];

function priorityDotClass(p: TaskPriority): string {
  switch (p) {
    case "low": return "bg-blue-400";
    case "medium": return "bg-yellow-400";
    case "high": return "bg-red-400";
    default: return "bg-zinc-500";
  }
}

function nextPriority(p: TaskPriority): TaskPriority {
  const idx = priorityOrder.indexOf(p);
  return priorityOrder[(idx + 1) % priorityOrder.length] ?? "none";
}

function dateOnly(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : value;
}

export function TaskDetailModal({ task, position, onClose }: Props) {
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const createTask = useTaskStore((s) => s.createTask);
  
  const sections = useSectionStore((s) => s.sections);
  const projects = useProjectStore((s) => s.projects);

  const modalRef = useRef<HTMLDivElement>(null);
  const [modalSize, setModalSize] = useState({ width: 0, height: 0 });
  const [clampedPos, setClampedPos] = useState(position);

  const [notesExpanded, setNotesExpanded] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);

  // Viewport clamping logic
  useEffect(() => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setModalSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    const padding = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = modalSize.width || 440;
    const h = modalSize.height || 300;

    let x = position.x;
    let y = position.y;

    if (x + w + padding > vw) x = vw - w - padding;
    if (y + h + padding > vh) y = vh - h - padding;
    if (x < padding) x = padding;
    if (y < padding) y = padding;

    setClampedPos({ x, y });
  }, [modalSize, position]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [onClose]);

  const subtasks = useMemo(() => {
    return tasks.filter((t) => t.parentTaskId === task.id);
  }, [task.id, tasks]);

  const onDelete = async () => {
    if (confirm("Delete this task?")) {
      await deleteTask(task.id);
      onClose();
    }
  };

  // Tag Adding
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const addTag = () => {
    const nextTag = tagDraft.trim().replace(/^#/, "");
    if (nextTag && !task.tags.includes(nextTag)) {
      void updateTask(task.id, { tags: [...task.tags, nextTag] });
    }
    setTagDraft("");
    setAddingTag(false);
  };

  const isDone = task.status === "done";

  return (
    <div
      ref={modalRef}
      style={{ left: clampedPos.x, top: clampedPos.y }}
      className="fixed z-50 flex w-full max-w-[440px] flex-col rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-2xl shadow-black/50"
    >
      {/* Header / Title Area */}
      <div className="flex items-start gap-3 p-3 pb-2">
        <button
          onClick={() => updateTask(task.id, { status: isDone ? "todo" : "done" })}
          className={`mt-1 flex h-5 w-5 items-center justify-center rounded border border-white/15 transition-colors hover:border-white/30 ${isDone ? "bg-emerald-500/20" : ""}`}
        >
          {isDone && <div className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />}
        </button>

        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                void updateTask(task.id, { title: titleDraft.trim() });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setEditingTitle(false);
                  void updateTask(task.id, { title: titleDraft.trim() });
                }
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="w-full bg-transparent text-lg font-semibold text-zinc-100 outline-none"
            />
          ) : (
            <div
              onClick={() => {
                setTitleDraft(task.title);
                setEditingTitle(true);
              }}
              className={`cursor-text text-lg font-semibold leading-tight text-zinc-100 transition-colors hover:text-white ${isDone ? "line-through text-zinc-500 hover:text-zinc-500" : ""}`}
            >
              {task.title || "(Untitled)"}
            </div>
          )}
        </div>

        <button onClick={onClose} className="p-1 text-zinc-500 transition-colors hover:text-zinc-300">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Primary Attributes Grid */}
      <div className="grid grid-cols-2 gap-1 p-1">
        {/* Due Date */}
        <div className="flex items-center gap-2 rounded-lg py-2 px-3 transition-colors hover:bg-white/5">
          <span className="text-zinc-500 text-base">📅</span>
          <input
            type="date"
            value={task.dueDate ? dateOnly(task.dueDate) : ""}
            onChange={(e) => updateTask(task.id, { dueDate: e.target.value || undefined })}
            className="w-full cursor-pointer bg-transparent text-sm text-zinc-300 outline-none"
          />
        </div>

        {/* Priority */}
        <button
          onClick={() => updateTask(task.id, { priority: nextPriority(task.priority) })}
          className="flex items-center gap-2 rounded-lg py-2 px-3 transition-colors hover:bg-white/5"
        >
          <div className={`h-2.5 w-2.5 rounded-full ${priorityDotClass(task.priority)}`} />
          <span className="capitalize text-sm text-zinc-300">
            {task.priority === "none" ? "No Priority" : task.priority}
          </span>
        </button>

        {/* Section */}
        <div className="relative flex items-center gap-2 rounded-lg py-1 px-3 transition-colors hover:bg-white/5">
          <span className="text-zinc-500 text-base">📁</span>
          <select
            value={task.sectionId || ""}
            onChange={(e) => {
              const newSectionId = e.target.value || undefined;
              if (newSectionId !== task.sectionId) {
                void updateTask(task.id, { sectionId: newSectionId, subsectionId: undefined });
              }
            }}
            className="w-full appearance-none bg-transparent text-sm text-zinc-300 outline-none cursor-pointer"
          >
            <option value="">No Section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        {/* Project */}
        <div className="relative flex items-center gap-2 rounded-lg py-1 px-3 transition-colors hover:bg-white/5">
          <span className="text-zinc-500 text-base">🏮</span>
          <select
            value={task.projectId || ""}
            onChange={(e) => updateTask(task.id, { projectId: e.target.value || undefined })}
            className="w-full appearance-none bg-transparent text-sm text-zinc-300 outline-none cursor-pointer"
          >
            <option value="">No Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Subsection (only if section is selected) */}
      {task.sectionId && (
        <div className="p-1">
          <div className="flex items-center gap-2 rounded-lg py-2 px-3 transition-colors hover:bg-white/5">
            <span className="text-zinc-500 text-base">🏷️</span>
            <select
              value={task.subsectionId || ""}
              onChange={(e) => updateTask(task.id, { subsectionId: e.target.value || undefined })}
              className="w-full appearance-none bg-transparent text-sm text-zinc-300 outline-none cursor-pointer"
            >
              <option value="">No Subsection</option>
              {useSectionStore.getState().subsections
                .filter(s => s.sectionId === task.sectionId)
                .map((su) => (
                  <option key={su.id} value={su.id}>
                    {su.title}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {/* Repeat Row */}
      <div className="p-1">
        <div className="flex items-center gap-2 rounded-lg py-2 px-3 transition-colors hover:bg-white/5">
          <span className="text-zinc-500 text-base">🔄</span>
          <select
            value={task.recurrence?.frequency || "none"}
            onChange={(e) => {
              const freq = e.target.value;
              if (freq === "none") {
                void updateTask(task.id, { recurrence: undefined });
              } else {
                void updateTask(task.id, { 
                  recurrence: { frequency: freq as any, interval: 1 } 
                });
              }
            }}
            className="w-full appearance-none bg-transparent text-sm text-zinc-300 outline-none cursor-pointer"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Tags Pill Area */}
      <div className="flex flex-wrap items-center gap-1.5 p-3 py-2 border-b border-white/5">
        {task.tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 group">
            #{tag}
            <button 
              onClick={() => updateTask(task.id, { tags: task.tags.filter(t => t !== tag) })}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-200"
            >✕</button>
          </span>
        ))}
        {addingTag ? (
          <input
            autoFocus
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
              if (e.key === "Escape") setAddingTag(false);
            }}
            className="w-20 rounded-full border border-white/10 bg-transparent px-2 py-0.5 text-xs text-zinc-200 outline-none"
            placeholder="tag..."
          />
        ) : (
          <button
            onClick={() => setAddingTag(true)}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-500 hover:border-white/20 hover:text-zinc-300"
          >
            +
          </button>
        )}
      </div>

      {/* Source Doc Link */}
      {task.sourceDocumentId && (
        <div className="px-3 pb-2 pt-1 border-b border-white/5">
          <Link
            href={`/documents/${task.sourceDocumentId}`}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <span className="text-zinc-400">📄</span>
            <span className="underline underline-offset-2">From document: {task.sourceDocumentTitle || "Untitled"}</span>
          </Link>
        </div>
      )}

      {/* Notes Section (Collapsible) */}
      <div className="px-1 pt-1">
        <button
          onClick={() => setNotesExpanded(!notesExpanded)}
          className="flex w-full items-center justify-between rounded-lg p-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        >
          <span>Notes</span>
          <span>{notesExpanded ? "▼" : "▶"}</span>
        </button>
        {notesExpanded && (
          <textarea
            value={task.notes}
            onChange={(e) => updateTask(task.id, { notes: e.target.value })}
            placeholder="Add details..."
            className="mt-1 min-h-[100px] w-full resize-none rounded-lg bg-transparent p-2 text-sm text-zinc-300 outline-none"
          />
        )}
      </div>

      {/* Subtasks Section (Collapsible) */}
      <div className="px-1 pb-1">
        <button
          onClick={() => setSubtasksExpanded(!subtasksExpanded)}
          className="flex w-full items-center justify-between rounded-lg p-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        >
          <span>Subtasks ({subtasks.length})</span>
          <span>{subtasksExpanded ? "▼" : "▶"}</span>
        </button>
        {subtasksExpanded && (
          <div className="flex flex-col gap-1 p-2">
            {subtasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2 text-sm text-zinc-400 group">
                <button
                  onClick={() => updateTask(st.id, { status: st.status === "done" ? "todo" : "done" })}
                  className="h-3.5 w-3.5 rounded-sm border border-zinc-700 shrink-0"
                >
                  {st.status === "done" && <div className="h-2 w-2 m-auto bg-emerald-500/50 rounded-[1px]" />}
                </button>
                <span className={st.status === "done" ? "line-through opacity-50" : ""}>{st.title || "new subtask"}</span>
              </div>
            ))}
            <button
               onClick={async () => {
                 const sub = await createTask({ title: "", parentTaskId: task.id });
                 await updateTask(task.id, { subtaskIds: [...task.subtaskIds, sub.id] });
               }}
               className="mt-2 text-left text-xs text-zinc-500 hover:text-zinc-300"
            >
              + Add Subtask
            </button>
          </div>
        )}
      </div>

      {/* Footer / Delete */}
      <div className="mt-auto flex border-t border-white/5 p-1">
        <button
          onClick={onDelete}
          className="w-full rounded-lg py-2 text-center text-xs font-medium text-red-400 opacity-50 transition-all hover:bg-red-500/10 hover:opacity-100"
        >
          Delete Task
        </button>
      </div>
    </div>
  );
}
