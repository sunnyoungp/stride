"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface OverdueItem {
  noteId: string;
  noteDate: string;
  taskId: string | null;
  title: string;
  nodeJson: Record<string, unknown>;
  /** Position of taskItem node inside its source note's TipTap doc */
  posInSourceDoc: number;
}

interface Props {
  items: OverdueItem[];
  onCheck: (item: OverdueItem) => void;
  onMoveAll: () => void;
  onDropOnDate: (item: OverdueItem, targetDate: string) => void;
  onDropOnEditor: (item: OverdueItem) => void;
  isMoving: boolean;
}

function formatBadgeDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dt);
}

type DragState = {
  item: OverdueItem;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  active: boolean;
};

/** Temporarily hide an element, call elementFromPoint, then restore it. */
function elementFromPointSkipping(x: number, y: number, skip: HTMLElement | null): Element | null {
  if (skip) skip.style.display = "none";
  const el = document.elementFromPoint(x, y);
  if (skip) skip.style.display = "";
  return el;
}

function OverdueTasksSectionInner({ items, onCheck, onMoveAll, onDropOnDate, onDropOnEditor, isMoving }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("stride-overdue-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("stride-overdue-collapsed", String(collapsed));
  }, [collapsed]);

  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const highlightedRef = useRef<{ el: HTMLElement; orig: string } | null>(null);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.el.style.outline = highlightedRef.current.orig;
      highlightedRef.current = null;
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, item: OverdueItem) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragRef.current = {
      item,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      active: false,
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      drag.curX = e.clientX;
      drag.curY = e.clientY;

      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
        drag.active = true;
        setIsDragging(true);
      }

      // Position preview
      if (previewRef.current) {
        previewRef.current.style.left = `${e.clientX + 12}px`;
        previewRef.current.style.top = `${e.clientY - 16}px`;
      }

      // Highlight drop target under cursor (hiding preview to avoid self-hit)
      clearHighlight();
      const el = elementFromPointSkipping(e.clientX, e.clientY, previewRef.current);
      const cell = el?.closest("[data-calendar-date]") as HTMLElement | null;
      const editor = el?.closest(".ProseMirror") as HTMLElement | null;

      if (cell) {
        highlightedRef.current = { el: cell, orig: cell.style.outline };
        cell.style.outline = "2px solid var(--accent)";
      } else if (editor) {
        highlightedRef.current = { el: editor, orig: editor.style.outline };
        editor.style.outline = "2px solid var(--accent)";
        editor.style.outlineOffset = "-2px";
        editor.style.borderRadius = "8px";
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;

      // Restore highlight
      if (highlightedRef.current) {
        const h = highlightedRef.current;
        h.el.style.outline = h.orig;
        h.el.style.outlineOffset = "";
        h.el.style.borderRadius = "";
        highlightedRef.current = null;
      }
      setIsDragging(false);

      if (!drag?.active) return;

      // Detect drop target (hiding preview)
      const el = elementFromPointSkipping(e.clientX, e.clientY, previewRef.current);
      const cell = el?.closest("[data-calendar-date]") as HTMLElement | null;
      const targetDate = cell?.getAttribute("data-calendar-date");

      if (targetDate) {
        onDropOnDate(drag.item, targetDate);
        return;
      }

      // Check if dropped on the editor
      const editor = el?.closest(".ProseMirror") as HTMLElement | null;
      if (editor) {
        onDropOnEditor(drag.item);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [clearHighlight, onDropOnDate, onDropOnEditor]);

  if (items.length === 0) return null;

  return (
    <>
      <div
        data-overdue-section
        onMouseDown={(e) => e.stopPropagation()}
        className="mb-4 rounded-xl overflow-hidden"
        style={{
          background: "var(--bg-card)",
          backdropFilter: "var(--glass-blur-card)",
          WebkitBackdropFilter: "var(--glass-blur-card)",
          border: "1px solid var(--glass-border)",
          borderTop: "1px solid var(--glass-border-top)",
          boxShadow: "var(--glass-shadow-card)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 select-none"
          style={{ cursor: "pointer" }}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-2 flex-1 min-w-0"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {collapsed ? (
              <ChevronRight size={14} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
            ) : (
              <ChevronDown size={14} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
              Scheduled for Previous Days
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--fg-faint)", marginLeft: 2 }}>
              {items.length}
            </span>
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={onMoveAll}
              disabled={isMoving}
              className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 hover:brightness-110 active:scale-95"
              style={{
                background: "var(--accent-bg-strong)",
                color: "var(--accent)",
                opacity: isMoving ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              {isMoving ? "Moving…" : "Move all to today"}
            </button>
          )}
        </div>

        {/* Task rows */}
        {!collapsed && (
          <div className="px-2 pb-2">
            {items.map((item, i) => (
              <div
                key={`${item.noteId}-${item.posInSourceDoc}-${i}`}
                onMouseDown={(e) => handleMouseDown(e, item)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-100 hover:bg-[var(--bg-hover)]"
                style={{ cursor: "grab" }}
              >
                <button
                  type="button"
                  onClick={() => onCheck(item)}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 17, height: 17, borderRadius: 4,
                    border: "1.5px solid var(--border-strong)",
                    background: "transparent", cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                />
                <span
                  className="flex-shrink-0 rounded-md px-1.5 py-0.5"
                  style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", background: "var(--bg-hover)" }}
                >
                  {formatBadgeDate(item.noteDate)}
                </span>
                <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14, color: "var(--fg)" }}>
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating drag preview — rendered via portal, hidden from elementFromPoint */}
      {isDragging && dragRef.current?.active && createPortal(
        <div
          ref={previewRef}
          style={{
            position: "fixed",
            left: dragRef.current.curX + 12,
            top: dragRef.current.curY - 16,
            pointerEvents: "none",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-float)",
            fontSize: 13,
            color: "var(--fg)",
            whiteSpace: "nowrap",
            opacity: 0.92,
          }}
        >
          <span style={{
            fontSize: 11, fontWeight: 600, color: "var(--fg-muted)",
            background: "var(--bg-hover)", padding: "2px 6px", borderRadius: 5,
          }}>
            {formatBadgeDate(dragRef.current.item.noteDate)}
          </span>
          <span>
            {dragRef.current.item.title.length > 35
              ? dragRef.current.item.title.slice(0, 35) + "…"
              : dragRef.current.item.title}
          </span>
        </div>,
        document.body
      )}
    </>
  );
}

export const OverdueTasksSection = React.memo(OverdueTasksSectionInner);
