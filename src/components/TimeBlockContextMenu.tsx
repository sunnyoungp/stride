"use client";

import { useEffect, useRef, useState } from "react";

import type { TimeBlock } from "@/types/index";

type Props = {
  timeBlock: TimeBlock;
  position: { x: number; y: number };
  onClose: () => void;
  onSaveAsTemplate: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function TimeBlockContextMenu({
  timeBlock,
  position,
  onClose,
  onSaveAsTemplate,
  onEdit,
  onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pos, setPos] = useState(position);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, [timeBlock.id]);

  useEffect(() => {
    const compute = () => {
      const padding = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = size.width || 220;
      const h = size.height || 120;
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
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-[220px] select-none rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl"
      role="menu"
      aria-label="Time block menu"
    >
      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        Edit
      </button>
      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
        onClick={() => {
          onSaveAsTemplate();
          onClose();
        }}
      >
        Save as Template
      </button>
      <div className="my-1 h-px bg-white/10" />
      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
}

