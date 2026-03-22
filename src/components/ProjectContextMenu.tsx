"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { Project } from "@/types/index";

type Props = {
  project: Project;
  position: { x: number; y: number };
  onClose: () => void;
};

function clamp(n: number, min: number, max: number) { return Math.min(Math.max(n, min), max); }

export function ProjectContextMenu({ project, position, onClose }: Props) {
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const menuRef       = useRef<HTMLDivElement | null>(null);
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

  const onRename = async () => {
    const t = window.prompt("New project title:", project.title);
    if (t?.trim()) await updateProject(project.id, { title: t.trim() });
    onClose();
  };

  const onDelete = async () => {
    if (window.confirm(`Delete "${project.title}"?`)) await deleteProject(project.id);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: clampedPos.x, top: clampedPos.y, background: "var(--bg-card)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-lg)", zIndex: 9999 }}
      className="fixed w-[200px] select-none rounded-xl p-1"
    >
      <button type="button" onClick={onRename}
        className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--fg)" }}
      >Rename</button>
      <div className="my-1 h-px" style={{ background: "var(--border)" }} />
      <button type="button" onClick={onDelete}
        className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-red-500/10"
        style={{ color: "#ef4444" }}
      >Delete</button>
    </div>
  );
}
