"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTaskStore } from "@/store/taskStore";
import type { Task, TaskPriority } from "@/types/index";

type Props = {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
};

function dateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextWeekdayDate(targetDay: number): string {
  const now = new Date();
  const current = now.getDay();
  let diff = (targetDay - current + 7) % 7;
  if (diff === 0) diff = 7;
  now.setDate(now.getDate() + diff);
  return dateOnlyString(now);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "none",   label: "None",   color: "bg-zinc-600" },
  { value: "low",    label: "Low",    color: "bg-blue-400" },
  { value: "medium", label: "Medium", color: "bg-yellow-400" },
  { value: "high",   label: "High",   color: "bg-red-400" },
];

export function TaskContextMenu({ task, position, onClose }: Props) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const [activePanel, setActivePanel] = useState<"main" | "reschedule" | "priority">("main");
  const [clampedPos, setClampedPos] = useState(position);

  const today = useMemo(() => dateOnlyString(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateOnlyString(d);
  }, []);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const padding = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setClampedPos({
      x: clamp(position.x, padding, vw - rect.width - padding),
      y: clamp(position.y, padding, vh - rect.height - padding),
    });
  }, [position]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  const reschedule = async (dueDate: string) => {
    await updateTask(task.id, { dueDate });
    onClose();
  };

  const markComplete = async () => {
    await updateTask(task.id, { status: "done" });
    onClose();
  };

  const onDelete = async () => {
    if (confirm("Delete this task?")) {
      await deleteTask(task.id);
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ left: clampedPos.x, top: clampedPos.y }}
      className="fixed z-50 w-[240px] select-none rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-2xl"
      role="menu"
    >
      {/* Task label */}
      <div className="px-3 py-2 mb-1 border-b border-white/5">
        <div className="truncate text-xs font-medium text-zinc-400">{task.title || "(Untitled)"}</div>
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
              <button
                key={label}
                type="button"
                onClick={() => void reschedule(date)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  task.dueDate === date
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.()}
              className="rounded-md px-2.5 py-1 text-xs bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
            >
              📅 Pick
            </button>
          </div>

          <input
            ref={dateInputRef}
            type="date"
            className="mx-3 mb-2 w-[calc(100%-24px)] rounded-md border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 outline-none"
            onChange={(e) => { if (e.target.value) void reschedule(e.target.value); }}
          />

          <div className="my-1 h-px bg-white/8" />

          {/* Priority */}
          <button
            type="button"
            onClick={() => setActivePanel("priority")}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${PRIORITY_OPTIONS.find(p => p.value === task.priority)?.color ?? "bg-zinc-600"}`} />
              <span>Priority</span>
            </div>
            <span className="text-xs text-zinc-500">›</span>
          </button>

          <div className="my-1 h-px bg-white/8" />

          <button
            type="button"
            onClick={() => void markComplete()}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 transition-colors"
          >
            ✓ Mark Complete
          </button>

          <button
            type="button"
            onClick={() => void onDelete()}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
        </>
      )}

      {activePanel === "priority" && (
        <>
          <button
            onClick={() => setActivePanel("main")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ‹ Back
          </button>
          <div className="px-1">
            {PRIORITY_OPTIONS.map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                onClick={async () => { await updateTask(task.id, { priority: value }); onClose(); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  task.priority === value ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                <div className={`h-2 w-2 rounded-full ${color}`} />
                {label}
                {task.priority === value && <span className="ml-auto text-[10px] text-zinc-500">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
