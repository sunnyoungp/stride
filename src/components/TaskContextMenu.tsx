"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTaskStore } from "@/store/taskStore";
import type { Task, TaskPriority } from "@/types/index";

type Props = {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
  selectedIds?: Set<string>;
};

function localDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextWeekdayDate(targetDay: number) {
  const now = new Date();
  let diff = (targetDay - now.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  now.setDate(now.getDate() + diff);
  return localDateString(now);
}
function clamp(n: number, min: number, max: number) { return Math.min(Math.max(n, min), max); }

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; style: React.CSSProperties }[] = [
  { value: "none",   label: "None",   style: { background: "var(--fg-faint)" } },
  { value: "low",    label: "Low",    style: { background: "var(--priority-low)" } },
  { value: "medium", label: "Medium", style: { background: "var(--priority-medium)" } },
  { value: "high",   label: "High",   style: { background: "var(--priority-high)" } },
];

export function TaskContextMenu({ task, position, onClose, selectedIds }: Props) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const tasks      = useTaskStore((s) => s.tasks);
  const menuRef    = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [activePanel, setActivePanel] = useState<"main" | "priority" | "parentPicker">("main");
  const [clampedPos, setClampedPos]   = useState(position);
  const [parentSearch, setParentSearch] = useState("");

  const today    = useMemo(() => localDateString(new Date()), []);
  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate()+1); return localDateString(d); }, []);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect(), p = 8;
    setClampedPos({ x: clamp(position.x, p, window.innerWidth - r.width - p), y: clamp(position.y, p, window.innerHeight - r.height - p) });
  }, [position]);

  useEffect(() => {
    const h = (e: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("pointerdown", h);
    return () => window.removeEventListener("pointerdown", h);
  }, [onClose]);

  const reschedule = async (dueDate: string) => {
    const ids = [...(selectedIds && selectedIds.size > 1 ? selectedIds : [task.id])];
    for (const id of ids) await updateTask(id, { dueDate });
    onClose();
  };
  const markComplete = async () => { await updateTask(task.id, { status: "done" }); onClose(); };
  const onDelete = async () => { if (confirm("Delete this task?")) { await deleteTask(task.id); onClose(); } };

  const promoteToTask = async () => {
    if (!task.parentTaskId) return;
    const parent = tasks.find((t) => t.id === task.parentTaskId);
    if (parent) {
      await updateTask(parent.id, { subtaskIds: parent.subtaskIds.filter((id) => id !== task.id) });
    }
    await updateTask(task.id, { parentTaskId: undefined });
    onClose();
  };

  // Candidate parent tasks: incomplete tasks in the same section, not this task, not subtasks of this task
  const candidateParents = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.id !== task.id &&
        !t.parentTaskId && // only top-level tasks
        t.sectionId === task.sectionId &&
        t.status !== "done" &&
        t.status !== "cancelled"
    );
  }, [tasks, task.id, task.sectionId]);

  const filteredParents = useMemo(() => {
    if (!parentSearch.trim()) return candidateParents;
    const q = parentSearch.toLowerCase();
    return candidateParents.filter((t) => t.title.toLowerCase().includes(q));
  }, [candidateParents, parentSearch]);

  const moveToParent = async (newParentId: string) => {
    const newParent = tasks.find((t) => t.id === newParentId);
    if (!newParent) return;

    // Remove from old parent's subtaskIds
    if (task.parentTaskId) {
      const oldParent = tasks.find((t) => t.id === task.parentTaskId);
      if (oldParent) {
        await updateTask(oldParent.id, { subtaskIds: oldParent.subtaskIds.filter((id) => id !== task.id) });
      }
    }
    // Add to new parent's subtaskIds
    if (!newParent.subtaskIds.includes(task.id)) {
      await updateTask(newParentId, { subtaskIds: [...newParent.subtaskIds, task.id] });
    }
    // Update this task's parentTaskId and match parent's sectionId
    await updateTask(task.id, { parentTaskId: newParentId, sectionId: newParent.sectionId });
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: clampedPos.x, top: clampedPos.y, background: "var(--bg-card)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-lg)", zIndex: 9999 }}
      className="fixed w-[240px] select-none rounded-2xl p-1"
      role="menu"
    >
      {/* Task label */}
      <div className="px-3 py-2 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="truncate text-xs font-medium" style={{ color: "var(--fg-muted)" }}>{task.title || "(Untitled)"}</div>
        {task.parentTaskId && (
          <div className="text-[10px] mt-0.5" style={{ color: "var(--fg-faint)" }}>
            ↳ subtask
          </div>
        )}
      </div>

      {activePanel === "main" && (
        <>
          {/* Quick reschedule pills */}
          <div className="flex flex-wrap gap-1.5 px-3 py-2">
            {[
              { label: "Today", date: today },
              { label: "Tomorrow", date: tomorrow },
              { label: "Weekend", date: nextWeekdayDate(6) },
              { label: "Next Mon", date: nextWeekdayDate(1) },
            ].map(({ label, date }) => (
              <button key={label} type="button" onClick={() => void reschedule(date)}
                className="rounded-lg px-2.5 py-1 text-xs transition-all duration-150"
                style={task.dueDate === date
                  ? { background: "var(--accent-bg-strong)", color: "var(--accent)", border: "1px solid var(--accent-bg-strong)" }
                  : { background: "var(--bg-hover)", color: "var(--fg-muted)", border: "1px solid transparent" }
                }
              >{label}</button>
            ))}
            <button type="button" onClick={() => dateInputRef.current?.showPicker?.()}
              className="rounded-lg px-2.5 py-1 text-xs transition-all duration-150 hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--fg-muted)", border: "1px solid var(--border)" }}
            >📅 Pick</button>
          </div>

          <input ref={dateInputRef} type="date"
            className="mx-3 mb-2 w-[calc(100%-24px)] rounded-xl px-3 py-1.5 text-xs outline-none"
            style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--fg)" }}
            onChange={(e) => { if (e.target.value) void reschedule(e.target.value); }}
          />

          <div className="my-1 h-px" style={{ background: "var(--border)" }} />

          <button type="button" onClick={() => setActivePanel("priority")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg)" }}
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={PRIORITY_OPTIONS.find(p => p.value === task.priority)?.style ?? { background: "var(--fg-faint)" }} />
              <span>Priority</span>
            </div>
            <span className="text-xs" style={{ color: "var(--fg-faint)" }}>›</span>
          </button>

          <div className="my-1 h-px" style={{ background: "var(--border)" }} />

          <button type="button" onClick={() => void markComplete()}
            className="w-full rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg)" }}
          >✓ Mark Complete</button>

          {/* Subtask-specific actions */}
          {task.parentTaskId && (
            <>
              <div className="my-1 h-px" style={{ background: "var(--border)" }} />
              <button type="button" onClick={() => void promoteToTask()}
                className="w-full rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--fg)" }}
              >↑ Promote to task</button>
              <button type="button" onClick={() => { setParentSearch(""); setActivePanel("parentPicker"); }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--fg)" }}
              >⤴ Move to different parent</button>
            </>
          )}

          <div className="my-1 h-px" style={{ background: "var(--border)" }} />

          <button type="button" onClick={() => void onDelete()}
            className="w-full rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-red-500/10"
            style={{ color: "#ef4444" }}
          >Delete</button>
        </>
      )}

      {activePanel === "priority" && (
        <>
          <button onClick={() => setActivePanel("main")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs transition-all duration-150 hover:bg-[var(--bg-hover)] rounded-xl"
            style={{ color: "var(--fg-muted)" }}
          >‹ Back</button>
          <div className="px-1">
            {PRIORITY_OPTIONS.map(({ value, label, style }) => (
              <button key={value} type="button"
                onClick={async () => { await updateTask(task.id, { priority: value }); onClose(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
                style={task.priority === value ? { background: "var(--bg-active)", color: "var(--accent)" } : { color: "var(--fg-muted)" }}
              >
                <div className="h-2 w-2 rounded-full" style={style} />
                {label}
                {task.priority === value && <span className="ml-auto text-[10px]" style={{ color: "var(--fg-faint)" }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {activePanel === "parentPicker" && (
        <>
          <button onClick={() => setActivePanel("main")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs transition-all duration-150 hover:bg-[var(--bg-hover)] rounded-xl"
            style={{ color: "var(--fg-muted)" }}
          >‹ Back</button>
          <div className="px-2 pb-1">
            <input
              autoFocus
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
              placeholder="Search tasks…"
              className="w-full rounded-xl px-3 py-1.5 text-xs outline-none mb-1"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                fontSize: 13,
              }}
            />
            {filteredParents.length === 0 ? (
              <div className="px-2 py-3 text-xs text-center" style={{ color: "var(--fg-faint)" }}>
                {candidateParents.length === 0
                  ? "No tasks in the same section"
                  : "No matches"}
              </div>
            ) : (
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {filteredParents.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void moveToParent(t.id)}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--fg)" }}
                  >
                    <span className="block truncate">{t.title || "(Untitled)"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
