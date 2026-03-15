"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/documentStore";
import type { StrideDocument } from "@/types/index";

type Props = {
  document: StrideDocument;
  position: { x: number; y: number };
  onClose: () => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function DocumentContextMenu({ document: doc, position, onClose }: Props) {
  const router = useRouter();
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);

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

  const onOpen = () => {
    router.push(`/documents/${doc.id}`);
    onClose();
  };

  const onDelete = async () => {
    if (confirm(`Delete "${doc.title || "Untitled"}"? This will also delete all tasks linked from this document.`)) {
      await deleteDocument(doc.id);
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ left: clampedPos.x, top: clampedPos.y }}
      className="fixed z-50 w-[200px] select-none rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl"
      role="menu"
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 transition-colors"
      >
        Open
      </button>
      <div className="my-1 h-px bg-white/8" />
      <button
        type="button"
        onClick={() => void onDelete()}
        className="w-full rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
      >
        Delete Document
      </button>
    </div>
  );
}
