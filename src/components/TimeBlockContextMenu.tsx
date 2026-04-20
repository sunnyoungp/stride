"use client";

import { useEffect, useRef, useState } from "react";
import { appConfirm } from "@/lib/confirm";
import type { TimeBlock } from "@/types/index";

type Props = {
  timeBlock: TimeBlock;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveAsTemplate: () => void;
};

function clamp(n: number, min: number, max: number) { return Math.min(Math.max(n, min), max); }

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

export function TimeBlockContextMenu({ timeBlock, position, onClose, onEdit, onDelete, onSaveAsTemplate }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [clampedPos, setClampedPos] = useState(position);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = 8;
    setClampedPos({ x: clamp(position.x, p, window.innerWidth - r.width - p), y: clamp(position.y, p, window.innerHeight - r.height - p) });
  }, [position]);

  useEffect(() => {
    const h = (e: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("pointerdown", h);
    return () => window.removeEventListener("pointerdown", h);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{ left: clampedPos.x, top: clampedPos.y, background: "var(--bg-card)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-lg)", zIndex: 9999 }}
      className="fixed w-[220px] select-none rounded-xl p-1"
      role="menu"
    >
      {/* Label */}
      <div className="px-3 py-2 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="font-medium text-sm truncate" style={{ color: "var(--fg)" }}>{timeBlock.title}</div>
        <div className="mt-0.5 text-[11px] font-mono" style={{ color: "var(--fg-faint)" }}>
          {formatTime(timeBlock.startTime)} → {formatTime(timeBlock.endTime)}
        </div>
      </div>

      <button type="button" onClick={() => { onEdit(); onClose(); }}
        className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--fg)" }}
      >Edit</button>

      {timeBlock.type !== "routine" && (
        <button type="button" onClick={() => { onSaveAsTemplate(); onClose(); }}
          className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg)" }}
        >Save as Template</button>
      )}

      <div className="my-1 h-px" style={{ background: "var(--border)" }} />

      <button type="button" onClick={() => { void appConfirm(`Delete "${timeBlock.title}"?`).then((ok) => { if (ok) { onDelete(); onClose(); } }); }}
        className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--error-bg)]"
        style={{ color: "var(--error)" }}
      >Delete Block</button>
    </div>
  );
}
