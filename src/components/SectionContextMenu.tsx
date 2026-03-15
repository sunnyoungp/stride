"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TaskSection } from "@/types/index";

type Props = {
  section: TaskSection;
  position: { x: number; y: number };
  onClose: () => void;
  onAddSubsection?: () => void;
  onRename?: () => void;
  onEditIcon?: () => void;
  onDelete?: () => void;
};

function clamp(n: number, min: number, max: number) { return Math.min(Math.max(n, min), max); }

export function SectionContextMenu({ section, position, onClose, onAddSubsection, onRename, onEditIcon, onDelete }: Props) {
  const menuRef     = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: position.x, y: position.y });
  const [ready, setReady] = useState(false);

  // Clamp position once the menu has rendered and we know its size
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = 8;
    setPos({
      x: clamp(position.x, p, window.innerWidth  - r.width  - p),
      y: clamp(position.y, p, window.innerHeight - r.height - p),
    });
    setReady(true);
  }, [position]);

  // Delay attaching the outside-click listener so the right-click pointerdown
  // that opened this menu doesn't immediately close it again.
  useEffect(() => {
    let handler: ((e: PointerEvent) => void) | null = null;
    const timer = setTimeout(() => {
      handler = (e: PointerEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      window.addEventListener("pointerdown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      if (handler) window.removeEventListener("pointerdown", handler);
    };
  }, [onClose]);

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        opacity: ready ? 1 : 0,          // hide until position is clamped
        pointerEvents: ready ? "auto" : "none",
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        boxShadow: "var(--shadow-lg)",
        width: 200,
        borderRadius: 12,
        padding: 4,
        userSelect: "none",
      }}
    >
      <MenuItem onClick={() => { onAddSubsection?.(); onClose(); }}>Add Subsection</MenuItem>
      <Divider />
      <MenuItem onClick={() => { onRename?.(); onClose(); }}>Rename</MenuItem>
      <MenuItem onClick={() => { onEditIcon?.(); onClose(); }}>Edit Icon</MenuItem>
      <Divider />
      <MenuItem onClick={() => { onDelete?.(); onClose(); }} danger>Delete</MenuItem>
    </div>
  );

  // Portal to document.body so no parent overflow/transform/z-index can
  // interfere with visibility or pointer events.
  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}

function MenuItem({ children, onClick, danger }: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 12px",
        borderRadius: 8,
        textAlign: "left",
        fontSize: 14,
        cursor: "pointer",
        background: "transparent",
        border: "none",
        color: danger ? "#ef4444" : "var(--fg)",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, margin: "4px 0", background: "var(--border)" }} />;
}
