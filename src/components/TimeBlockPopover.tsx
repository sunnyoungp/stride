"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTaskStore } from "@/store/taskStore";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import type { Task, TimeBlock } from "@/types/index";

type Props = {
  timeBlock: TimeBlock;
  position: { x: number; y: number };
  onClose: () => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  const d = new Date(value);
  return d.toISOString();
}

export function TimeBlockPopover({ timeBlock, position, onClose }: Props) {
  const updateTimeBlock = useTimeBlockStore((s) => s.updateTimeBlock);
  const deleteTimeBlock = useTimeBlockStore((s) => s.deleteTimeBlock);
  const tasks = useTaskStore((s) => s.tasks);

  const popRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pos, setPos] = useState(position);

  const linkedTask: Task | undefined = useMemo(() => {
    if (!timeBlock.taskId) return undefined;
    return tasks.find((t) => t.id === timeBlock.taskId);
  }, [tasks, timeBlock.taskId]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = popRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  useEffect(() => {
    const el = popRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, [timeBlock.id]);

  useEffect(() => {
    const compute = () => {
      const padding = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = size.width || 320;
      const h = size.height || 220;
      setPos({
        x: clamp(position.x, padding, vw - w - padding),
        y: clamp(position.y, padding, vh - h - padding),
      });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [position.x, position.y, size.height, size.width]);

  return (
    <div
      ref={popRef}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-[320px] rounded-xl border border-white/10 bg-zinc-900 p-3 shadow-xl"
      role="dialog"
      aria-label="Time block"
    >
      <div className="flex items-start justify-between gap-3">
        <input
          value={timeBlock.title}
          onChange={(e) => void updateTimeBlock(timeBlock.id, { title: e.target.value })}
          className="w-full bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
          placeholder="Title"
          autoFocus
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Start
          </div>
          <input
            type="datetime-local"
            value={toLocalInputValue(timeBlock.startTime)}
            onChange={(e) =>
              void updateTimeBlock(timeBlock.id, {
                startTime: fromLocalInputValue(e.target.value),
              })
            }
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 outline-none"
          />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            End
          </div>
          <input
            type="datetime-local"
            value={toLocalInputValue(timeBlock.endTime)}
            onChange={(e) =>
              void updateTimeBlock(timeBlock.id, {
                endTime: fromLocalInputValue(e.target.value),
              })
            }
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 outline-none"
          />
        </div>
      </div>

      {linkedTask ? (
        <div className="mt-3 text-xs text-zinc-400">
          Linked task: <span className="text-zinc-200">{linkedTask.title}</span>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-zinc-500 capitalize">{timeBlock.type}</div>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              await deleteTimeBlock(timeBlock.id);
              onClose();
            })();
          }}
          className="rounded-md px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

