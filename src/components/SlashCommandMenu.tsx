"use client";

import { useEffect, useRef, useState } from "react";
import type { SlashCmd } from "@/lib/slashCommands";

export function SlashCommandMenu({
  items, activeIndex, rect, onSelect, onClose,
}: {
  items: SlashCmd[];
  activeIndex: number;
  rect: DOMRect;
  onSelect: (cmd: SlashCmd) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: rect.left, y: rect.bottom + 6 });

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const menuH = el.offsetHeight;
    const menuW = el.offsetWidth;
    const vvH = window.visualViewport?.height ?? window.innerHeight;
    let x = rect.left;
    let y = rect.bottom + 6;
    if (y + menuH > vvH - 8) y = rect.top - menuH - 6;
    x = Math.max(8, Math.min(x, window.innerWidth - menuW - 8));
    setPos({ x, y });
  }, [rect]);

  useEffect(() => {
    const h = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => document.addEventListener("pointerdown", h), 50);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", h); };
  }, [onClose]);

  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest" }); }, [activeIndex]);

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 9999,
        background: "var(--bg-card)", border: "1px solid var(--border-mid)",
        borderRadius: 12, boxShadow: "var(--shadow-float)",
        width: 280, maxHeight: 320, overflowY: "auto", padding: 4,
      }}
    >
      {items.map((cmd, i) => (
        <button
          key={cmd.id}
          ref={i === activeIndex ? activeRef : undefined}
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onSelect(cmd); }}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "6px 10px", borderRadius: 8, border: "none",
            cursor: "pointer", textAlign: "left",
            background: i === activeIndex ? "var(--bg-active)" : "transparent",
            transition: "background 100ms",
          }}
          onMouseEnter={(e) => { if (i !== activeIndex) e.currentTarget.style.background = "var(--bg-hover)"; }}
          onMouseLeave={(e) => { if (i !== activeIndex) e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{
            width: 28, height: 28, borderRadius: 6, background: "var(--bg-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", flexShrink: 0,
          }}>
            {cmd.icon}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--fg)" }}>{cmd.label}</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--fg-faint)" }}>{cmd.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
