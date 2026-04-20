"use client";

/**
 * TaskList — unified task row, add-task input, and group card.
 * Used by: TaskListView, inbox/page, next7/page, and anywhere else tasks are listed.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Task, TaskPriority } from "@/types/index";
import { useTaskStore } from "@/store/taskStore";
import { TaskContextMenu } from "@/components/TaskContextMenu";
import { DatePickerContent } from "@/components/ui/DatePicker";

// ── Selection context ─────────────────────────────────────────────────────────

type SelectionCtx = {
  selectedIds: Set<string>;
  orderedIds: string[];
  handleRowClick: (taskId: string, shiftKey: boolean, metaKey: boolean, pos: { x: number; y: number }, openModal: (task: Task, pos: { x: number; y: number }) => void, task: Task) => void;
  clearSelection: () => void;
};

const SelectionContext = createContext<SelectionCtx | null>(null);

export function useTaskSelection() {
  return useContext(SelectionContext);
}

// ── Date helpers for reschedule ───────────────────────────────────────────────

function localDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextWeekday(targetDay: number) {
  const now = new Date();
  let diff = (targetDay - now.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  now.setDate(now.getDate() + diff);
  return localDateString(now);
}

// ── RescheduleDatePopover ─────────────────────────────────────────────────────

/** Viewport-aware date picker popover. Positions above/below anchor, stays within viewport. */
export function RescheduleDatePopover({
  anchor,
  onSelect,
  onClose,
  currentDate,
}: {
  anchor: { x: number; y: number; width: number; height: number };
  onSelect: (date: string | undefined) => void;
  onClose: () => void;
  currentDate?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Compute position: prefer above the anchor, flip below if not enough space
  const pos = (() => {
    const pw = 220, ph = 230, p = 8;
    const vw = typeof window !== "undefined" ? window.innerWidth  : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    // Horizontal: center on anchor, clamp to viewport
    let left = anchor.x + anchor.width / 2 - pw / 2;
    if (left + pw > vw - p) left = vw - pw - p;
    if (left < p) left = p;
    // Vertical: prefer above
    const spaceAbove = anchor.y;
    const spaceBelow = vh - (anchor.y + anchor.height);
    let top: number;
    if (spaceAbove >= ph + 8) {
      top = anchor.y - ph - 6;
    } else if (spaceBelow >= ph + 8) {
      top = anchor.y + anchor.height + 6;
    } else {
      top = Math.max(p, anchor.y - ph - 6);
    }
    return { left, top };
  })();

  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => window.addEventListener("pointerdown", h), 80);
    return () => { clearTimeout(timer); window.removeEventListener("pointerdown", h); };
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      data-selection-bar
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: 220,
        zIndex: 10002,
        background: "var(--bg-card)",
        backdropFilter: "var(--glass-blur-card)",
        WebkitBackdropFilter: "var(--glass-blur-card)",
        border: "1px solid var(--glass-border)",
        borderTop: "1px solid var(--glass-border-top)",
        borderRadius: 12,
        boxShadow: "var(--shadow-float)",
        padding: "8px",
        animation: "gs-scale 120ms cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      <DatePickerContent
        onSelect={(date) => { onSelect(date); onClose(); }}
        currentDate={currentDate}
      />
    </div>,
    document.body
  );
}

// ── SelectionActionBar ────────────────────────────────────────────────────────

export function SelectionActionBar({
  selectedIds,
  onClear,
}: {
  selectedIds: Set<string>;
  onClear: () => void;
}) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const rescheduleBtnRef = useRef<HTMLButtonElement>(null);
  const [reschedulePanelOpen, setReschedulePanelOpen] = useState(false);
  const [rescheduleAnchor, setRescheduleAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const count = selectedIds.size;

  const handleCompleteAll = async () => {
    for (const id of selectedIds) await updateTask(id, { status: "done" });
    onClear();
  };

  const handleDelete = async () => {
    for (const id of selectedIds) await deleteTask(id);
    onClear();
  };

  const handleReschedule = async (date: string | undefined) => {
    const ids = [...selectedIds];
    for (const id of ids) await updateTask(id, { dueDate: date });
    onClear();
  };

  const openReschedulePanel = () => {
    if (reschedulePanelOpen) { setReschedulePanelOpen(false); return; }
    const r = rescheduleBtnRef.current?.getBoundingClientRect();
    if (r) {
      setRescheduleAnchor({ x: r.left, y: r.top, width: r.width, height: r.height });
      setReschedulePanelOpen(true);
    }
  };

  return createPortal(
    <>
      {/* Outer div handles centering — must be separate from animation div to prevent
          gs-scale's transform from overriding translateX(-50%) */}
      <div
        data-selection-bar
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
        }}
      >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          animation: "gs-scale 150ms cubic-bezier(0.16,1,0.3,1) both",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", marginRight: 4 }}>
          {count} selected
        </span>
        <div style={{ width: 1, height: 16, background: "var(--border)" }} />
        <button
          type="button"
          onClick={() => void handleCompleteAll()}
          style={{
            fontSize: 12, fontWeight: 500, color: "var(--fg)",
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px", borderRadius: 6, transition: "background 100ms ease",
          }}
          className="hover:bg-[var(--bg-hover)]"
        >
          Complete all
        </button>
        <button
          ref={rescheduleBtnRef}
          type="button"
          onClick={openReschedulePanel}
          style={{
            fontSize: 12, fontWeight: 500, color: "var(--fg)",
            background: reschedulePanelOpen ? "var(--bg-hover)" : "none",
            border: "none", cursor: "pointer",
            padding: "4px 8px", borderRadius: 6, transition: "background 100ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => { if (!reschedulePanelOpen) e.currentTarget.style.background = "transparent"; }}
        >
          Reschedule
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          style={{
            fontSize: 12, fontWeight: 500, color: "var(--priority-high)",
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px", borderRadius: 6, transition: "background 100ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          Delete
        </button>
        <div style={{ width: 1, height: 16, background: "var(--border)" }} />
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          style={{
            fontSize: 14, lineHeight: 1, color: "var(--fg-faint)",
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 6px", borderRadius: 6, transition: "background 100ms ease",
          }}
          className="hover:bg-[var(--bg-hover)]"
        >
          ✕
        </button>
      </div>
      </div>
      {reschedulePanelOpen && rescheduleAnchor && (
        <RescheduleDatePopover
          anchor={rescheduleAnchor}
          onSelect={(date) => void handleReschedule(date)}
          onClose={() => setReschedulePanelOpen(false)}
        />
      )}
    </>,
    document.body
  );
}

// ── TaskSelectionProvider ─────────────────────────────────────────────────────

type TaskSelectionProviderProps = {
  orderedTaskIds: string[];
  children: React.ReactNode;
};

export function TaskSelectionProvider({ orderedTaskIds, children }: TaskSelectionProviderProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAnchorId(null);
  }, []);

  // Escape key clears selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") clearSelection(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  // Click outside task rows clears selection
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // Keep selection if click is on a task row or the action bar
      const onTaskRow = !!target?.closest("[data-task-id]");
      const onActionBar = !!target?.closest("[data-selection-bar]");
      if (!onTaskRow && !onActionBar) clearSelection();
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [clearSelection]);

  const handleRowClick = useCallback(
    (
      taskId: string,
      shiftKey: boolean,
      metaKey: boolean,
      pos: { x: number; y: number },
      openModal: (task: Task, pos: { x: number; y: number }) => void,
      task: Task
    ) => {
      // Cmd+click: toggle individual task without affecting others
      if (metaKey) {
        const next = new Set(selectedIds);
        if (next.has(taskId)) { next.delete(taskId); } else { next.add(taskId); setAnchorId(taskId); }
        setSelectedIds(next);
        return;
      }
      // Shift+click: range select
      if (shiftKey && anchorId && orderedTaskIds.includes(anchorId) && orderedTaskIds.includes(taskId)) {
        const aIdx = orderedTaskIds.indexOf(anchorId);
        const bIdx = orderedTaskIds.indexOf(taskId);
        const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
        setSelectedIds(new Set(orderedTaskIds.slice(lo, hi + 1)));
        return;
      }
      // Regular click: open modal
      if (selectedIds.has(taskId) && !shiftKey) {
        clearSelection();
        openModal(task, pos);
        return;
      }
      clearSelection();
      setAnchorId(taskId);
      openModal(task, pos);
    },
    [anchorId, orderedTaskIds, selectedIds, clearSelection]
  );

  const ctx: SelectionCtx = {
    selectedIds,
    orderedIds: orderedTaskIds,
    handleRowClick,
    clearSelection,
  };

  return (
    <SelectionContext.Provider value={ctx}>
      {children}
      {selectedIds.size >= 2 && (
        <SelectionActionBar selectedIds={selectedIds} onClear={clearSelection} />
      )}
    </SelectionContext.Provider>
  );
}

// ── ConnectedTaskContextMenu ──────────────────────────────────────────────────
// Renders TaskContextMenu with selectedIds from the nearest TaskSelectionProvider.
// Use this instead of TaskContextMenu directly when inside a TaskSelectionProvider tree.

export function ConnectedTaskContextMenu({
  task,
  position,
  onClose,
}: {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const ctx = useTaskSelection();
  const selectedIds = ctx?.selectedIds;
  return (
    <TaskContextMenu
      task={task}
      position={position}
      onClose={onClose}
      selectedIds={selectedIds && selectedIds.size > 1 ? selectedIds : undefined}
    />
  );
}

// ── Notes preview helper ──────────────────────────────────────────────────────

function stripMd(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
}

export function getNotesPreview(notes: string, maxLen = 60): string {
  if (!notes?.trim()) return "";
  const firstLine = stripMd(notes).split("\n").find((l) => l.trim()) ?? "";
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + "…" : firstLine;
}

// ── Date helpers (shared across all list views) ───────────────────────────────

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

export function isOverdue(v: string): boolean {
  return v < todayStr();
}

export function isToday(v: string): boolean {
  return v === todayStr();
}

export function friendlyDate(v: string): string {
  const diff = Math.round(
    (new Date(v + "T00:00:00").getTime() - new Date(todayStr() + "T00:00:00").getTime()) / 86400000
  );
  if (diff === 0)  return "Today";
  if (diff === 1)  return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < -1)  return `${Math.abs(diff)}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(v + "T00:00:00")
  );
}

export function dueDateChip(dueDate: string): { label: string; bg: string; color: string } {
  if (isOverdue(dueDate)) {
    return { label: friendlyDate(dueDate), bg: "rgba(239,68,68,0.10)", color: "var(--priority-high)" };
  }
  if (isToday(dueDate)) {
    return { label: "Today", bg: "var(--accent-bg)", color: "var(--accent)" };
  }
  return { label: friendlyDate(dueDate), bg: "var(--bg-subtle)", color: "var(--fg-muted)" };
}

// ── Priority flag ─────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Partial<Record<TaskPriority, string>> = {
  high:   "var(--priority-high)",
  medium: "var(--priority-medium)",
  low:    "var(--priority-low)",
};

export function PriorityFlag({ priority }: { priority: TaskPriority }) {
  const color = PRIORITY_COLOR[priority];
  if (!color) return null;
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none" style={{ flexShrink: 0 }}>
      <line x1="2" y1="1" x2="2" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 1.5H9.5L7.5 5L9.5 8.5H2V1.5Z" fill={color} opacity=".9"/>
    </svg>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

type TaskRowProps = {
  task: Task;
  onClick?: (task: Task, pos: { x: number; y: number }) => void;
  onRightClick?: (task: Task, pos: { x: number; y: number }) => void;
  /** If true, renders without context menu (caller manages it externally) */
  noContextMenu?: boolean;
  /** If true, uses compact vertical padding (5px) instead of standard (11px) for subtask rows */
  compact?: boolean;
};

export function TaskRow({ task, onClick, onRightClick, noContextMenu, compact }: TaskRowProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const selection = useContext(SelectionContext);
  const isDone = task.status === "done";
  const chip = task.dueDate ? dueDateChip(task.dueDate) : null;
  const isSelected = selection?.selectedIds.has(task.id) ?? false;

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey) {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
    }
    if (selection) {
      selection.handleRowClick(
        task.id,
        e.shiftKey,
        e.metaKey,
        { x: e.clientX, y: e.clientY },
        (t, pos) => onClick?.(t, pos),
        task
      );
    } else {
      onClick?.(task, { x: e.clientX, y: e.clientY });
    }
  };

  const rowBg = isSelected ? "var(--accent-bg)" : "transparent";
  const rowBorder = isSelected ? "1px solid rgba(var(--accent-rgb, 99,102,241), 0.20)" : undefined;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          if (onRightClick) {
            onRightClick(task, { x: e.clientX, y: e.clientY });
          } else if (!noContextMenu) {
            setContextMenu({ x: e.clientX, y: e.clientY });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick(e as unknown as React.MouseEvent);
        }}
        data-task-id={task.id}
        data-task-title={task.title}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: compact ? "5px 16px" : "11px 16px",
          cursor: "pointer",
          transition: "background 120ms ease",
          background: rowBg,
          ...(rowBorder ? { outline: rowBorder } : {}),
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isSelected ? "var(--accent-bg)" : "transparent";
        }}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void updateTask(task.id, { status: isDone ? "todo" : "done" });
          }}
          style={{
            flexShrink: 0,
            width: 17,
            height: 17,
            borderRadius: 4,
            border: `1.5px solid ${isDone ? "var(--accent)" : "var(--border-strong)"}`,
            background: isDone ? "var(--accent)" : "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            transition: "all 150ms ease",
          }}
        >
          {isDone && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Title + notes preview */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            className="task-title-text"
            style={{
              display: "block",
              lineHeight: 1.4,
              color: isDone ? "var(--fg-faint)" : "var(--fg)",
              textDecoration: isDone ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "normal",
            }}
          >
            {task.title || "(Untitled)"}
          </span>
          {(() => {
            const preview = getNotesPreview(task.notes);
            return preview ? (
              <span style={{
                display: "block",
                fontSize: 11,
                color: "var(--fg-faint)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "normal",
                marginTop: 1,
              }}>
                {preview}
              </span>
            ) : null;
          })()}
        </div>

        {/* Right side: due chip + priority flag */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {chip && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 7px",
                borderRadius: 6,
                background: chip.bg,
                color: chip.color,
                flexShrink: 0,
              }}
            >
              {chip.label}
            </span>
          )}
          {task.priority !== "none" && <PriorityFlag priority={task.priority} />}
        </div>
      </div>

      {/* Self-managed context menu (when no external handler provided) */}
      {contextMenu && (
        <TaskContextMenu
          task={task}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

// ── AddTaskRow ────────────────────────────────────────────────────────────────

type AddTaskRowProps = {
  sectionId?: string;
  subsectionId?: string;
  /** Pre-fills dueDate on the created task (used by Next 7 Days) */
  dueDate?: string;
};

export function AddTaskRow({ sectionId, subsectionId, dueDate }: AddTaskRowProps) {
  const createTask = useTaskStore((s) => s.createTask);
  const [active, setActive] = useState(false);
  const [draft, setDraft]   = useState("");

  const commit = () => {
    const title = draft.trim();
    if (title) {
      void createTask({
        title,
        sectionId,
        subsectionId,
        status: "todo",
        ...(dueDate ? { dueDate } : {}),
      });
    }
    setDraft("");
    setActive(false);
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setActive(true); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "10px 16px",
          fontSize: 13,
          color: "var(--fg-faint)",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 120ms ease",
        }}
        className="hover:bg-[var(--bg-hover)]"
      >
        <span
          style={{
            width: 17,
            height: 17,
            borderRadius: "50%",
            border: "1.5px dashed var(--border-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            flexShrink: 0,
            color: "var(--fg-faint)",
          }}
        >
          +
        </span>
        Add task
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px",
      }}
    >
      <span
        style={{
          width: 17,
          height: 17,
          borderRadius: "50%",
          border: "1.5px dashed var(--border-strong)",
          flexShrink: 0,
        }}
      />
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter")  commit();
          if (e.key === "Escape") { setDraft(""); setActive(false); }
        }}
        onBlur={commit}
        placeholder="Task name"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 13,
          color: "var(--fg)",
        }}
      />
    </div>
  );
}

// ── TaskRowsWithSubtasks ──────────────────────────────────────────────────────
// Renders task rows with their incomplete subtasks nested underneath.

function TaskRowsWithSubtasks({
  tasks,
  onTaskClick,
  onTaskRightClick,
}: {
  tasks: Task[];
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
}) {
  const allTasks = useTaskStore((s) => s.tasks);

  return (
    <>
      {tasks.map((task, idx) => {
        // Only show subtasks that share the same section as the parent
        const subtasks = task.subtaskIds?.length
          ? allTasks.filter(
              (t) =>
                t.parentTaskId === task.id &&
                t.sectionId === task.sectionId &&
                t.status !== "done" &&
                t.status !== "cancelled"
            )
          : [];
        return (
          <React.Fragment key={task.id}>
            <div style={idx > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
              <TaskRow task={task} onClick={onTaskClick} onRightClick={onTaskRightClick} />
            </div>
            {subtasks.length > 0 && (
              <div>
                {subtasks.map((subtask, stIdx) => (
                  <div
                    key={subtask.id}
                    style={{ paddingLeft: 20, ...(stIdx === subtasks.length - 1 ? { paddingBottom: 6 } : {}) }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <TaskRow task={subtask} onClick={onTaskClick} onRightClick={onTaskRightClick} compact />
                  </div>
                ))}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── TaskGroup card ─────────────────────────────────────────────────────────────
// Shared card used by Inbox, Next 7 Days, and anywhere tasks are grouped by date/label.

type TaskGroupProps = {
  label: string;
  tasks: Task[];
  /** Show the count badge in the header */
  count?: number;
  /** Red overdue styling on the header */
  isOverdueGroup?: boolean;
  /** Accent dot color for section-style headers */
  accentColor?: string;
  /** Show inline "Add task" row at the bottom */
  showAddTask?: boolean;
  /** Pre-fills sectionId when creating from Add task */
  sectionId?: string;
  /** Pre-fills dueDate when creating from Add task (Next 7 Days) */
  defaultDueDate?: string;
  onTaskClick: (task: Task, pos: { x: number; y: number }) => void;
  onTaskRightClick: (task: Task, pos: { x: number; y: number }) => void;
};

export function TaskGroup({
  label,
  tasks,
  count,
  isOverdueGroup,
  accentColor,
  showAddTask = true,
  sectionId,
  defaultDueDate,
  onTaskClick,
  onTaskRightClick,
}: TaskGroupProps) {
  const displayCount = count ?? tasks.length;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        overflow: "clip",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "11px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--bg-card)",
        }}
      >
        {accentColor && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: accentColor,
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isOverdueGroup ? "var(--priority-high)" : "var(--fg)",
            flex: 1,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "1px 7px",
            borderRadius: 10,
            background: isOverdueGroup ? "rgba(239,68,68,0.12)" : "var(--bg-subtle)",
            color: isOverdueGroup ? "var(--priority-high)" : "var(--fg-faint)",
          }}
        >
          {displayCount}
        </span>
      </div>

      {/* Rows */}
      {tasks.length === 0 ? (
        <div
          style={{
            padding: "16px",
            fontSize: 12,
            color: "var(--fg-faint)",
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          No tasks
        </div>
      ) : (
        <TaskRowsWithSubtasks
          tasks={tasks}
          onTaskClick={onTaskClick}
          onTaskRightClick={onTaskRightClick}
        />
      )}

      {/* Add task */}
      {showAddTask && (
        <div style={{ borderTop: tasks.length > 0 ? "1px solid var(--border)" : undefined }}>
          <AddTaskRow sectionId={sectionId} dueDate={defaultDueDate} />
        </div>
      )}
    </div>
  );
}
