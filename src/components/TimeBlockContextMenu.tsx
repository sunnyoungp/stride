"use client";

import { useEffect, useRef, useState } from "react";
import type { TimeBlock } from "@/types/index";

type Props = {
  timeBlock: TimeBlock;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveAsTemplate: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function TimeBlockContextMenu({
  timeBlock,
  position,
  onClose,
  onEdit,
  onDelete,
  onSaveAsTemplate,
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [clampedPos, setClampedPos] = useState(position);

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

  const handleDelete = () => {
    if (confirm(`Delete "${timeBlock.title}"?`)) {
      onDelete();
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: clampedPos.x, top: clampedPos.y }}
      className="fixed z-50 w-[220px] select-none rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl"
      role="menu"
    >
      {/* Block label */}
      <div className="px-3 py-2 text-xs text-zinc-500 border-b border-white/5 mb-1">
        <div className="font-medium text-zinc-300 truncate">{timeBlock.title}</div>
        <div className="mt-0.5 font-mono">{formatTime(timeBlock.startTime)} → {formatTime(timeBlock.endTime)}</div>
      </div>

      <button
        type="button"
        onClick={() => { onEdit(); onClose(); }}
        className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 transition-colors"
      >
        Edit
      </button>

      {timeBlock.type !== "routine" && (
        <button
          type="button"
          onClick={() => { onSaveAsTemplate(); onClose(); }}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 transition-colors"
        >
          Save as Template
        </button>
      )}

      <div className="my-1 h-px bg-white/8" />

      <button
        type="button"
        onClick={handleDelete}
        className="w-full rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
      >
        Delete Block
      </button>
    </div>
  );
}
