"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types/index";

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
  const current = now.getDay(); // 0=Sun..6=Sat
  let diff = (targetDay - current + 7) % 7;
  if (diff === 0) diff = 7;
  now.setDate(now.getDate() + diff);
  return dateOnlyString(now);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function TaskContextMenu({ task, position, onClose }: Props) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [menuSize, setMenuSize] = useState({ width: 0, height: 0 });
  const [clampedPos, setClampedPos] = useState(position);

  const today = useMemo(() => dateOnlyString(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateOnlyString(d);
  }, []);
  const nextSaturday = useMemo(() => nextWeekdayDate(6), []);
  const nextMonday = useMemo(() => nextWeekdayDate(1), []);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      onClose();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuSize({ width: rect.width, height: rect.height });
  }, [submenuOpen, task.id]);

  useEffect(() => {
    const compute = () => {
      const padding = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = menuSize.width || 260;
      const height = menuSize.height || 180;
      const x = clamp(position.x, padding, vw - width - padding);
      const y = clamp(position.y, padding, vh - height - padding);
      setClampedPos({ x, y });
    };

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [menuSize.height, menuSize.width, position.x, position.y]);

  const reschedule = async (dueDate: string) => {
    await updateTask(task.id, { dueDate });
    onClose();
  };

  const markComplete = async () => {
    await updateTask(task.id, { status: "done" });
    onClose();
  };

  const onDelete = async () => {
    await deleteTask(task.id);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: clampedPos.x, top: clampedPos.y }}
      className="fixed z-50 w-[260px] select-none rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl"
      role="menu"
      aria-label="Task menu"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
        onClick={() => setSubmenuOpen((v) => !v)}
      >
        <span>Reschedule</span>
        <span className="text-xs text-zinc-500">›</span>
      </button>

      {submenuOpen ? (
        <div className="mt-1 rounded-md border border-white/10 bg-zinc-950/40 p-1">
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
            onClick={() => void reschedule(today)}
          >
            Today
          </button>
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
            onClick={() => void reschedule(tomorrow)}
          >
            Tomorrow
          </button>
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
            onClick={() => void reschedule(nextSaturday)}
          >
            This Weekend
            <span className="ml-2 text-xs text-zinc-500">(Sat)</span>
          </button>
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
            onClick={() => void reschedule(nextMonday)}
          >
            Next Week
            <span className="ml-2 text-xs text-zinc-500">(Mon)</span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
            onClick={() => dateInputRef.current?.showPicker?.()}
          >
            <span>Pick a date</span>
            <span className="text-xs text-zinc-500">📅</span>
          </button>

          <input
            ref={dateInputRef}
            type="date"
            className="mt-2 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none"
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              void reschedule(value);
            }}
          />
        </div>
      ) : null}

      <div className="my-1 h-px bg-white/10" />

      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
        onClick={() => void markComplete()}
      >
        Mark Complete
      </button>

      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
        onClick={() => void onDelete()}
      >
        Delete
      </button>
    </div>
  );
}

