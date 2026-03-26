"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/documentStore";
import type { StrideDocument } from "@/types/index";

const PINNED_DOCS_KEY = "stride-pinned-docs";

function getPinnedDocIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(PINNED_DOCS_KEY) ?? "[]") as string[]); }
  catch { return new Set(); }
}

export function togglePinnedDoc(docId: string): boolean {
  const ids = getPinnedDocIds();
  if (ids.has(docId)) { ids.delete(docId); } else { ids.add(docId); }
  localStorage.setItem(PINNED_DOCS_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new StorageEvent("storage", { key: PINNED_DOCS_KEY }));
  return ids.has(docId);
}

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
  const [isPinned, setIsPinned] = useState(false);
  useEffect(() => { setIsPinned(getPinnedDocIds().has(doc.id)); }, [doc.id]);

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
    router.push(`/documents?id=${doc.id}`);
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
      style={{ left: clampedPos.x, top: clampedPos.y, background: "var(--bg-card)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-float)" }}
      className="fixed z-[9999] w-[200px] select-none rounded-xl p-1"
      role="menu"
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--fg)" }}
      >
        Open
      </button>
      <button
        type="button"
        onClick={() => { setIsPinned(togglePinnedDoc(doc.id)); onClose(); }}
        className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--fg)" }}
      >
        {isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
      </button>
      <div className="my-1 h-px" style={{ background: "var(--border)" }} />
      <button
        type="button"
        onClick={() => void onDelete()}
        className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-red-500/10"
        style={{ color: "#ef4444" }}
      >
        Delete Document
      </button>
    </div>
  );
}
