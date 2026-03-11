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

export function DocumentContextMenu({ document, position, onClose }: Props) {
  const router = useRouter();
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuSize, setMenuSize] = useState({ width: 0, height: 0 });
  const [clampedPos, setClampedPos] = useState(position);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setMenuSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    const padding = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = menuSize.width || 200;
    const height = menuSize.height || 120;
    
    setClampedPos({
      x: clamp(position.x, padding, vw - width - padding),
      y: clamp(position.y, padding, vh - height - padding),
    });
  }, [menuSize, position]);

  const onOpen = () => {
    router.push(`/documents/${document.id}`);
    onClose();
  };

  const onRename = async () => {
    const newTitle = window.prompt("Enter new document title:", document.title);
    if (newTitle !== null && newTitle.trim() !== "") {
      await updateDocument(document.id, { title: newTitle.trim() });
    }
    onClose();
  };

  const onDelete = async () => {
    if (window.confirm("Delete this document? This will not delete synced tasks.")) {
      await deleteDocument(document.id);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: clampedPos.x, top: clampedPos.y }}
      className="fixed z-50 w-[200px] select-none rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl"
    >
      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
        onClick={onOpen}
      >
        Open
      </button>
      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
        onClick={onRename}
      >
        Rename
      </button>
      <div className="my-1 h-px bg-white/10" />
      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
