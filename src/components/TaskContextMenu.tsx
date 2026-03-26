"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
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
  const menuRef    = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [activePanel, setActivePanel] = useState<"main" | "priority" | "move">("main");
  const [clampedPos, setClampedPos]   = useState(position);
  const projects = useProjectStore((s) => s.projects);

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
    console.log(`[bulk reschedule] processing ${ids.length} tasks to ${dueDate}`);
    for (const id of ids) await updateTask(id, { dueDate });
    onClose();
  };
  const markComplete = async () => { await updateTask(task.id, { status: "done" }); onClose(); };
  const onDelete = async () => { if (confirm("Delete this task?")) { await deleteTask(task.id); onClose(); } };
  const convertToTask = async () => {
    if (!task.parentTaskId) return;
    await updateTask(task.id, { parentTaskId: undefined });
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

          <button type="button" onClick={() => setActivePanel("move")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">📁</span>
              <span>Move to list</span>
            </div>
            <span className="text-xs" style={{ color: "var(--fg-faint)" }}>›</span>
          </button>

          {task.parentTaskId && (
            <button type="button" 
              onClick={convertToTask}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--fg)" }}
            >
              <span className="text-xs">⬆️</span>
              <span>Convert to task</span>
            </button>
          )}

          <div className="my-1 h-px" style={{ background: "var(--border)" }} />

          <button type="button" onClick={() => void markComplete()}
            className="w-full rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg)" }}
          >✓ Mark Complete</button>

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

      {activePanel === "move" && (
        <>
          <button onClick={() => setActivePanel("main")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs transition-all duration-150 hover:bg-[var(--bg-hover)] rounded-xl"
            style={{ color: "var(--fg-muted)" }}
          >‹ Back</button>
          <div className="px-1 max-h-[200px] overflow-y-auto">
            <button type="button"
              onClick={async () => { await updateTask(task.id, { projectId: undefined }); onClose(); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
              style={!task.projectId ? { background: "var(--bg-active)", color: "var(--accent)" } : { color: "var(--fg-muted)" }}
            >
              <span className="text-xs">📥</span>
              Inbox
              {!task.projectId && <span className="ml-auto text-[10px]" style={{ color: "var(--fg-faint)" }}>✓</span>}
            </button>
            {projects.map((p) => (
              <button key={p.id} type="button"
                onClick={async () => { await updateTask(task.id, { projectId: p.id }); onClose(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
                style={task.projectId === p.id ? { background: "var(--bg-active)", color: "var(--accent)" } : { color: "var(--fg-muted)" }}
              >
                <div className="h-2 w-2 rounded-full" style={{ background: p.color || "var(--fg-faint)" }} />
                <span className="truncate">{p.title}</span>
                {task.projectId === p.id && <span className="ml-auto text-[10px]" style={{ color: "var(--fg-faint)" }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
