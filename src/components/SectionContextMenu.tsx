"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const menuRef    = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [pos, setPos] = useState({ x: position.x, y: position.y });

  // Keep ref in sync so the stable outside-click handler always calls the latest onClose
  useEffect(() => { onCloseRef.current = onClose; });

  // Clamp position after first paint so the menu is always fully on-screen
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = 8;
    setPos({
      x: clamp(position.x, p, window.innerWidth  - r.width  - p),
      y: clamp(position.y, p, window.innerHeight - r.height - p),
    });
  }, []); // only run once on mount — position doesn't change after open

  // Attach outside-click listener once (empty deps), referencing onClose via ref
  // to avoid the timer resetting every time onClose identity changes.
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    const timer = setTimeout(() => {
      const handler = (e: PointerEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onCloseRef.current();
        }
      };
      window.addEventListener("pointerdown", handler);
      removeListener = () => window.removeEventListener("pointerdown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      removeListener?.();
    };
  }, []); // intentionally empty — stable via onCloseRef

  // Also close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        background: "var(--bg-card)",
        backdropFilter: "var(--glass-blur-card)",
        WebkitBackdropFilter: "var(--glass-blur-card)",
        border: "1px solid var(--glass-border)",
        borderTop: "1px solid var(--glass-border-top)",
        boxShadow: "var(--shadow-float)",
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
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ${danger ? "hover:bg-red-500/10" : "hover:bg-[var(--bg-hover)]"}`}
      style={{ color: danger ? "#ef4444" : "var(--fg)" }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, margin: "4px 0", background: "var(--border)" }} />;
}
