"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  isMoving: boolean;
}

function formatBadgeDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dt);
}

function OverdueTasksSectionInner({ items, onCheck, onMoveAll, isMoving }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("stride-overdue-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("stride-overdue-collapsed", String(collapsed));
  }, [collapsed]);

  const handleDragStart = useCallback((e: React.DragEvent, item: OverdueItem) => {
    // Set data in the same format the existing MiniCalendar drop handler expects
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/block-type", "task");
    e.dataTransfer.setData("text/task-title", item.title);
    e.dataTransfer.setData("stride/taskTitle", item.title);
    e.dataTransfer.setData("text/plain", item.title);
    if (item.taskId) {
      e.dataTransfer.setData("text/task-id", item.taskId);
      e.dataTransfer.setData("stride/taskId", item.taskId);
    }
    e.dataTransfer.setData("text/block-json", JSON.stringify(item.nodeJson));
    // Overdue-specific: source note info so the drop handler can remove from source
    e.dataTransfer.setData("text/overdue-source-note-id", item.noteId);
    e.dataTransfer.setData("text/overdue-source-note-date", item.noteDate);

    // Custom drag preview: date badge + title
    const preview = document.createElement("div");
    preview.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; border-radius: 10px;
      background: var(--bg-card); border: 1px solid var(--glass-border);
      box-shadow: var(--shadow-float); font-size: 13px; color: var(--fg);
      font-family: inherit; white-space: nowrap; opacity: 0.92;
      pointer-events: none; position: fixed; top: -200px; left: -200px;
    `;
    const badge = document.createElement("span");
    badge.style.cssText = `
      font-size: 11px; font-weight: 600; color: var(--fg-muted);
      background: var(--bg-hover); padding: 2px 6px; border-radius: 5px;
    `;
    badge.textContent = formatBadgeDate(item.noteDate);
    const titleSpan = document.createElement("span");
    titleSpan.textContent = item.title.length > 40 ? item.title.slice(0, 40) + "…" : item.title;
    preview.appendChild(badge);
    preview.appendChild(titleSpan);
    document.body.appendChild(preview);
    e.dataTransfer.setDragImage(preview, 20, 20);
    // Clean up the preview element after a frame
    requestAnimationFrame(() => document.body.removeChild(preview));
  }, []);

  if (items.length === 0) return null;

  return (
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
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--accent)",
            }}
          >
            Scheduled for Previous Days
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--fg-faint)",
              marginLeft: 2,
            }}
          >
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
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-100 hover:bg-[var(--bg-hover)]"
              style={{ cursor: "grab" }}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => onCheck(item)}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 4,
                  border: "1.5px solid var(--border-strong)",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              />

              {/* Date badge */}
              <span
                className="flex-shrink-0 rounded-md px-1.5 py-0.5"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--fg-muted)",
                  background: "var(--bg-hover)",
                }}
              >
                {formatBadgeDate(item.noteDate)}
              </span>

              {/* Title */}
              <span
                className="flex-1 min-w-0 truncate"
                style={{ fontSize: 14, color: "var(--fg)" }}
              >
                {item.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const OverdueTasksSection = React.memo(OverdueTasksSectionInner);
