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

function clamp(n: number, min: number, max: number) { return Math.min(Math.max(n, min), max); }

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

function fromLocalInputValue(v: string) { return new Date(v).toISOString(); }

function allDayTimes(dateStr: string): { startTime: string; endTime: string } {
  const d = new Date(dateStr + "T00:00:00");
  const startTime = d.toISOString();
  d.setDate(d.getDate() + 1);
  const endTime = d.toISOString();
  return { startTime, endTime };
}

export function TimeBlockPopover({ timeBlock, position, onClose }: Props) {
  const updateTimeBlock = useTimeBlockStore((s) => s.updateTimeBlock);
  const deleteTimeBlock = useTimeBlockStore((s) => s.deleteTimeBlock);
  const tasks           = useTaskStore((s) => s.tasks);
  const popRef          = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pos, setPos]   = useState(position);

  const linkedTask: Task | undefined = useMemo(() =>
    timeBlock.taskId ? tasks.find((t) => t.id === timeBlock.taskId) : undefined,
    [tasks, timeBlock.taskId]
  );

  useEffect(() => {
    const h = (e: PointerEvent) => { if (popRef.current && !(e.target instanceof Node && popRef.current.contains(e.target))) onClose(); };
    window.addEventListener("pointerdown", h);
    return () => window.removeEventListener("pointerdown", h);
  }, [onClose]);

  useEffect(() => {
    const el = popRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize({ width: r.width, height: r.height });
  }, [timeBlock.id]);

  useEffect(() => {
    const p = 8, w = size.width || 320, h = size.height || 220;
    setPos({ x: clamp(position.x, p, window.innerWidth - w - p), y: clamp(position.y, p, window.innerHeight - h - p) });
    const onResize = () => setPos({ x: clamp(position.x, p, window.innerWidth - w - p), y: clamp(position.y, p, window.innerHeight - h - p) });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position.x, position.y, size.height, size.width]);

  const inputClass = "w-full rounded-xl px-2 py-2 text-xs outline-none transition-all duration-150";
  const inputStyle = { background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--fg)" };
  const labelStyle = { color: "var(--fg-faint)" };

  return (
    <div
      ref={popRef}
      style={{ left: pos.x, top: pos.y, background: "var(--bg-card)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-float)" }}
      className="fixed z-50 w-[320px] rounded-2xl p-4"
      role="dialog"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <input
          value={timeBlock.title}
          onChange={(e) => void updateTimeBlock(timeBlock.id, { title: e.target.value })}
          className="w-full bg-transparent text-sm font-semibold outline-none"
          style={{ color: "var(--fg)" }}
          placeholder="Title"
          autoFocus
        />
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]" style={{ color: "var(--fg-faint)" }}>✕</button>
      </div>

      {/* All day toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => {
            if (!timeBlock.allDay) {
              const times = allDayTimes(toDateInputValue(timeBlock.startTime));
              void updateTimeBlock(timeBlock.id, { ...times, allDay: true });
            } else {
              // Revert to a 1-hour slot at noon on the same day
              const d = new Date(timeBlock.startTime);
              d.setHours(12, 0, 0, 0);
              const startTime = d.toISOString();
              d.setHours(13);
              void updateTimeBlock(timeBlock.id, { startTime, endTime: d.toISOString(), allDay: false });
            }
          }}
          className="flex items-center gap-1.5 text-xs transition-all duration-150"
          style={{ color: timeBlock.allDay ? "var(--accent)" : "var(--fg-muted)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          <div style={{
            width: 28, height: 16, borderRadius: 8, transition: "background 150ms",
            background: timeBlock.allDay ? "var(--accent)" : "var(--bg-subtle)",
            border: "1px solid var(--border-mid)",
            position: "relative", flexShrink: 0,
          }}>
            <div style={{
              position: "absolute", top: 2, left: timeBlock.allDay ? 14 : 2,
              width: 10, height: 10, borderRadius: "50%",
              background: timeBlock.allDay ? "#fff" : "var(--fg-faint)",
              transition: "left 150ms",
            }} />
          </div>
          All day
        </button>
      </div>

      {!timeBlock.allDay && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={labelStyle}>Start</div>
            <input type="datetime-local" value={toLocalInputValue(timeBlock.startTime)}
              onChange={(e) => void updateTimeBlock(timeBlock.id, { startTime: fromLocalInputValue(e.target.value) })}
              className={inputClass} style={inputStyle} />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={labelStyle}>End</div>
            <input type="datetime-local" value={toLocalInputValue(timeBlock.endTime)}
              onChange={(e) => void updateTimeBlock(timeBlock.id, { endTime: fromLocalInputValue(e.target.value) })}
              className={inputClass} style={inputStyle} />
          </div>
        </div>
      )}
      {timeBlock.allDay && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={labelStyle}>Date</div>
          <input type="date" value={toDateInputValue(timeBlock.startTime)}
            onChange={(e) => { if (e.target.value) void updateTimeBlock(timeBlock.id, allDayTimes(e.target.value)); }}
            className={inputClass} style={inputStyle} />
        </div>
      )}

      {linkedTask && (
        <div className="mt-3 text-xs" style={{ color: "var(--fg-muted)" }}>
          Linked: <span style={{ color: "var(--fg)" }}>{linkedTask.title}</span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs capitalize" style={{ color: "var(--fg-faint)" }}>{timeBlock.type}</div>
        <button onClick={() => void (async () => { await deleteTimeBlock(timeBlock.id); onClose(); })()}
          className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:bg-red-500/10"
          style={{ color: "#ef4444" }}
        >Delete</button>
      </div>
    </div>
  );
}
