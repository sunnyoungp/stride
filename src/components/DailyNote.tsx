"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "prosemirror-model";
import type { SuggestionProps } from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { db } from "@/db/index";
import { DragHandleExtension } from "@/lib/dragHandleExtension";
import { XChecklistExtension } from "@/lib/xChecklistExtension";
import { FontSizeTextStyle, FontSizeKeyboardExtension, ParagraphWithLineHeight, getCurrentFontSize, FONT_SIZE_DEFAULT } from "@/lib/fontSizeExtension";
import { type SlashCmd, type SlashMenuState, createSlashCommandExtension } from "@/lib/slashCommands";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import { EditorBubbleMenu } from "@/components/EditorBubbleMenu";
import { FormatPanel } from "@/components/FormatPanel";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { useDailyNoteStore } from "@/store/dailyNoteStore";
import { useTaskStore } from "@/store/taskStore";
import type { DailyNote, Task } from "@/types/index";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dateOnlyString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateOnly(date: string): Date {
  const [y, m, d] = date.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(date: string, deltaDays: number): string {
  const d = parseDateOnly(date);
  d.setDate(d.getDate() + deltaDays);
  return dateOnlyString(d);
}

function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(parseDateOnly(date));
}

// ─── TaskItem with stable taskId attr ────────────────────────────────────────

const TaskItemWithId = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      taskId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-task-id") ?? null,
        renderHTML: (attrs) => (attrs.taskId ? { "data-task-id": attrs.taskId } : {}),
      },
    };
  },
}).configure({ nested: true });

// ─── Editor helpers ───────────────────────────────────────────────────────────

type TaskItemScan = { title: string; checked: boolean; taskId: string | null; pos: number };

function scanTaskItems(editor: Editor): TaskItemScan[] {
  const result: TaskItemScan[] = [];
  const doc = editor.state.doc;
  doc.nodesBetween(0, doc.nodeSize - 2, (node, pos) => {
    if (node.type.name !== "taskItem") return;
    const title = node.textContent.trim();
    if (title) result.push({ title, checked: Boolean(node.attrs.checked), taskId: node.attrs.taskId ?? null, pos });
  });
  return result;
}

function writeTaskIdToNode(editor: Editor, pos: number, taskId: string, attrs: Record<string, unknown>) {
  if (!editor.view) return;
  editor.view.dispatch(
    editor.view.state.tr
      .setNodeMarkup(pos, undefined, { ...attrs, taskId })
      .setMeta("addToHistory", false)
  );
}

/**
 * Returns ordered selectable positions from the doc:
 * - Individual taskItem / listItem positions (more granular than the wrapper list)
 * - Top-level paragraph / heading positions
 */
function collectSelectablePositions(doc: PmNode): number[] {
  const positions: number[] = [];
  const listWrappers = new Set(["taskList", "bulletList", "orderedList"]);
  doc.forEach((node, offset) => {
    if (listWrappers.has(node.type.name)) {
      node.forEach((child, childOffset) => {
        positions.push(offset + 1 + childOffset);
      });
    } else {
      positions.push(offset);
    }
  });
  return positions;
}

/** Remove a taskItem or plain block node from the editor by title match. Returns true if found. */
function removeNodeFromEditor(editor: Editor, title: string): boolean {
  const doc = editor.state.doc;
  const tr  = editor.state.tr;
  let found = false;
  const matchable = new Set(["taskItem", "paragraph", "heading", "listItem"]);
  doc.nodesBetween(0, doc.nodeSize - 2, (node, pos) => {
    if (found) return false;
    if (matchable.has(node.type.name) && node.textContent.trim() === title) {
      try {
        const $pos = doc.resolve(pos);
        // If the taskItem is the only child of its taskList, delete the whole taskList
        // so no empty wrapper node is left behind
        if (node.type.name === "taskItem" && $pos.parent.type.name === "taskList" && $pos.parent.childCount === 1) {
          tr.delete($pos.before($pos.depth), $pos.after($pos.depth));
        } else {
          tr.delete(pos, pos + node.nodeSize);
        }
      } catch {
        tr.delete(pos, pos + node.nodeSize);
      }
      found = true;
      return false;
    }
  });
  if (found && editor.view) editor.view.dispatch(tr);
  return found;
}

async function ensureDailyNote(date: string): Promise<DailyNote> {
  const existing = await db.dailyNotes.where("date").equals(date).first();
  if (existing) return existing;
  const note: DailyNote = {
    id: crypto.randomUUID(), date,
    content: JSON.stringify({ type: "doc", content: [] }),
    linkedTaskIds: [],
  };
  await db.dailyNotes.put(note);
  return note;
}

// ─── DnSelectionBar ───────────────────────────────────────────────────────────

type SelectedBlock = {
  title: string;
  pos: number;
  nodeType: string;
  taskId: string | null;
  checked: boolean;
};

function DnSelectionBar({
  selectedPoses,
  editorRef,
  updateTask,
  deleteTask,
  createTask,
  onClear,
}: {
  selectedPoses: Set<number>;
  editorRef: React.MutableRefObject<Editor | null>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<unknown>;
  deleteTask: (id: string) => Promise<unknown>;
  createTask: (data: Partial<Task>) => Promise<Task>;
  onClear: () => void;
}) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const getSelectedBlocks = (): SelectedBlock[] => {
    const ed = editorRef.current;
    if (!ed) return [];
    const result: SelectedBlock[] = [];
    selectedPoses.forEach((pos) => {
      try {
        const node = ed.state.doc.nodeAt(pos);
        if (!node) return;
        result.push({
          title:    node.textContent.trim(),
          pos,
          nodeType: node.type.name,
          taskId:   (node.attrs as Record<string, unknown>).taskId as string | null ?? null,
          checked:  Boolean((node.attrs as Record<string, unknown>).checked),
        });
      } catch { /* ignore stale pos */ }
    });
    return result.filter(b => b.title);
  };

  const taskBlocks = () => getSelectedBlocks().filter(b => b.nodeType === "taskItem");
  const noteBlocks = () => getSelectedBlocks().filter(b => b.nodeType !== "taskItem");

  const handleCompleteAll = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const items = taskBlocks();
    const tr = ed.state.tr;
    let modified = false;
    items.forEach(({ pos, checked, taskId }) => {
      if (!checked) {
        try {
          const node = tr.doc.nodeAt(pos);
          if (node) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: true }); modified = true; }
        } catch { /* ignore */ }
        if (taskId) void updateTask(taskId, { status: "done" });
      }
    });
    if (modified && ed.view) { tr.setMeta("addToHistory", false); ed.view.dispatch(tr); }
    onClear();
  };

  const handleReschedule = (date: string) => {
    if (!date) return;
    taskBlocks().forEach(({ taskId }) => {
      if (taskId) void updateTask(taskId, { dueDate: date });
    });
    onClear();
  };

  const handleCreateTasks = () => {
    noteBlocks().forEach(({ title }) => {
      void createTask({ title, status: "todo" });
    });
    onClear();
  };

  const handleDelete = () => {
    const ed = editorRef.current;
    if (!ed) return;
    // Sort descending so positions stay valid as we remove nodes
    const items = getSelectedBlocks().sort((a, b) => b.pos - a.pos);
    const tr = ed.state.tr;
    items.forEach(({ pos }) => {
      try {
        const node = tr.doc.nodeAt(pos);
        if (node) tr.delete(pos, pos + node.nodeSize);
      } catch { /* ignore */ }
    });
    if (ed.view) ed.view.dispatch(tr);
    // onUpdate will detect missing taskIds and call deleteTask automatically
    onClear();
  };

  const btn = (label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: 500,
        color: danger ? "var(--priority-high)" : "var(--fg)",
        background: "none", border: "none", cursor: "pointer",
        padding: "4px 8px", borderRadius: 6,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : "var(--bg-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {label}
    </button>
  );

  const hasTaskItems = taskBlocks().length > 0;
  const hasNoteItems = noteBlocks().length > 0;

  return (
    <div
      data-selection-bar
      style={{
        position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)",
        zIndex: 9999, display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", background: "var(--bg-card)",
        border: "1px solid var(--border)", borderRadius: 14,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        animation: "gs-scale 150ms cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", marginRight: 4 }}>
        {selectedPoses.size} blocks selected
      </span>
      <div style={{ width: 1, height: 16, background: "var(--border)" }} />
      {hasTaskItems && btn("Complete all", handleCompleteAll)}
      {hasTaskItems && (
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker?.()}
          style={{
            fontSize: 12, fontWeight: 500, color: "var(--fg)",
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px", borderRadius: 6, position: "relative",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          Reschedule
          <input
            ref={dateInputRef} type="date" tabIndex={-1}
            onChange={(e) => handleReschedule(e.target.value)}
            style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
          />
        </button>
      )}
      {hasNoteItems && btn("Create tasks", handleCreateTasks)}
      {btn("Delete", handleDelete, true)}
      <div style={{ width: 1, height: 16, background: "var(--border)" }} />
      {btn("✕", onClear)}
    </div>
  );
}

// ─── NoteItemContextMenu ──────────────────────────────────────────────────────

type NoteMenuState = {
  title: string;
  taskId: string | null;
  checked: boolean;
  pos: number;
  x: number;
  y: number;
};

function NoteItemContextMenu({
  item, selectedDate, onMove, onDelete, onSchedule, onToggleChecked, onNavigateToTask, onClose,
}: {
  item: NoteMenuState;
  selectedDate: string;
  onMove: (date: string) => void;
  onDelete: () => void;
  onSchedule: (dueDate: string) => void;
  onToggleChecked: () => void;
  onNavigateToTask: () => void;
  onClose: () => void;
}) {
  const menuRef     = useRef<HTMLDivElement>(null);
  const dateRef     = useRef<HTMLInputElement>(null);
  const moveDateRef = useRef<HTMLInputElement>(null);
  const [clPos, setClPos]             = useState({ x: item.x, y: item.y });
  const [activePanel, setActivePanel] = useState<"main" | "schedule" | "move">("main");

  const today    = useMemo(() => dateOnlyString(new Date()), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);

  // Clamp to viewport after mount
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setClPos({
      x: Math.max(8, Math.min(item.x, window.innerWidth  - r.width  - 8)),
      y: Math.max(8, Math.min(item.y, window.innerHeight - r.height - 8)),
    });
  }, [item.x, item.y]);

  // 50ms delay prevents the triggering click from immediately dismissing
  useEffect(() => {
    const h = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => window.addEventListener("pointerdown", h), 50);
    return () => { clearTimeout(t); window.removeEventListener("pointerdown", h); };
  }, [onClose]);

  // "Move to Day" dates: yesterday, tomorrow, then +2..+6 relative to selectedDate
  const moveDates = useMemo(() => {
    const entries: { label: string; date: string }[] = [
      { label: "Yesterday", date: addDays(selectedDate, -1) },
      { label: "Tomorrow",  date: addDays(selectedDate,  1) },
    ];
    for (let i = 2; i <= 6; i++) {
      const d = addDays(selectedDate, i);
      entries.push({ label: formatDateLabel(d), date: d });
    }
    return entries;
  }, [selectedDate]);

  const row = (label: string, action: () => void, danger = false, suffix?: string) => (
    <button key={label} type="button" onClick={action}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px", borderRadius: 8,
        fontSize: "0.8125rem", color: danger ? "#ef4444" : "var(--fg)",
        background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : "var(--bg-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <span>{label}</span>
      {suffix && <span style={{ fontSize: "0.75rem", color: "var(--fg-faint)" }}>{suffix}</span>}
    </button>
  );

  const backBtn = (to: "main") => (
    <button type="button" onClick={() => setActivePanel(to)}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "5px 12px", borderRadius: 8,
        fontSize: "0.8125rem", color: "var(--fg-muted)",
        background: "transparent", border: "none", cursor: "pointer",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >‹ Back</button>
  );

  return (
    <div ref={menuRef} style={{
      position: "fixed", left: clPos.x, top: clPos.y, zIndex: 9999, width: 220,
      background: "var(--bg-card)", border: "1px solid var(--border-mid)",
      borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 4,
    }}>
      {/* Title */}
      <div style={{ padding: "6px 12px 4px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
        <div style={{ fontSize: "0.75rem", color: "var(--fg-muted)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </div>
      </div>

      {activePanel === "main" && <>
        {row("Schedule Task", () => setActivePanel("schedule"), false, "›")}
        {row("Move to Day",   () => setActivePanel("move"),     false, "›")}
        {row("Open in Tasks", () => { onNavigateToTask(); onClose(); })}
        <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
        {row(item.checked ? "Mark Incomplete" : "Mark Complete", () => { onToggleChecked(); onClose(); })}
        <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
        {row("Delete", () => { onDelete(); onClose(); }, true)}
      </>}

      {activePanel === "schedule" && <>
        {backBtn("main")}
        {row("Today",     () => { onSchedule(today);             onClose(); })}
        {row("Tomorrow",  () => { onSchedule(tomorrow);          onClose(); })}
        {row("Next Week", () => { onSchedule(addDays(today, 7)); onClose(); })}
        <button type="button" onClick={() => dateRef.current?.showPicker?.()}
          style={{ width: "100%", display: "block", textAlign: "left", padding: "6px 12px", borderRadius: 8, fontSize: "0.8125rem", color: "var(--fg)", background: "transparent", border: "none", cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >📅 Pick Date…</button>
        <input ref={dateRef} type="date" style={{ display: "none" }}
          onChange={e => { if (e.target.value) { onSchedule(e.target.value); onClose(); } }} />
      </>}

      {activePanel === "move" && <>
        {backBtn("main")}
        {moveDates.map(({ label, date }) => row(label, () => { onMove(date); onClose(); }))}
        <button type="button" onClick={() => moveDateRef.current?.showPicker?.()}
          style={{ width: "100%", display: "block", textAlign: "left", padding: "6px 12px", borderRadius: 8, fontSize: "0.8125rem", color: "var(--fg)", background: "transparent", border: "none", cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >📅 Pick Date…</button>
        <input ref={moveDateRef} type="date" style={{ display: "none" }}
          onChange={e => { if (e.target.value) { onMove(e.target.value); onClose(); } }} />
      </>}
    </div>
  );
}


// ─── Sync-mode toggle icons ───────────────────────────────────────────────────

function LinkIcon() {
  return (
    <svg width="13" height="9" viewBox="0 0 18 12" fill="none" aria-hidden>
      <rect x="1"  y="2" width="7" height="8" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="2" width="7" height="8" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <line x1="7" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function UnlinkIcon() {
  return (
    <svg width="13" height="9" viewBox="0 0 18 12" fill="none" aria-hidden>
      <rect x="1"  y="2" width="7" height="8" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="2" width="7" height="8" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <line x1="3.5" y1="0.5" x2="14.5" y2="11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

// ─── DailyNote component ──────────────────────────────────────────────────────

export function DailyNote({ selectedDate, onDateChange, hideHeader = false, moveItemRef }: { selectedDate: string; onDateChange: (date: string) => void; hideHeader?: boolean; moveItemRef?: React.MutableRefObject<((title: string, taskId: string | null, targetDate: string) => Promise<void>) | null> }) {
  const dailyNotes        = useDailyNoteStore((s) => s.dailyNotes);
  const loadDailyNotes    = useDailyNoteStore((s) => s.loadDailyNotes);
  const getTodayNote      = useDailyNoteStore((s) => s.getTodayNote);
  const updateNoteContent = useDailyNoteStore((s) => s.updateNoteContent);
  const upsertNote        = useDailyNoteStore((s) => s.upsertNote);

  const tasks      = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const createTask = useTaskStore((s) => s.createTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const router = useRouter();

  const [note, setNote]                 = useState<DailyNote | null>(null);
  const [showLoading, setShowLoading]   = useState(true);
  const [noteContextMenu, setNoteContextMenu] = useState<NoteMenuState | null>(null);

  // Slash command menu state
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>(null);
  const slashMenuRef = useRef<SlashMenuState>(null);
  const slashPropsRef = useRef<SuggestionProps<SlashCmd, SlashCmd> | null>(null);
  useEffect(() => { slashMenuRef.current = slashMenu; }, [slashMenu]);

  // Multi-select state for all block types
  const [dnSelectedPoses, setDnSelectedPoses] = useState<Set<number>>(new Set());
  const dnAnchorPosRef      = useRef<number | null>(null);
  const dnSelectedPosesRef  = useRef<Set<number>>(new Set());
  useEffect(() => { dnSelectedPosesRef.current = dnSelectedPoses; }, [dnSelectedPoses]);

  // Lasso drag-select state
  const editorWrapperRef    = useRef<HTMLDivElement>(null);
  const lassoStartRef       = useRef<{ x: number; y: number } | null>(null);
  const isDragSelectingRef  = useRef(false);
  const lassoRectRef        = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [lassoRect, setLassoRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Linked mode: tasks sync to task manager. Reads stride-note-linked-mode (authoritative),
  // falls back to legacy dailynote-linked-mode key for backward compat.
  const [isLinked, setIsLinked] = useState(true); // default true; corrected after mount
  const toggleLinked = () => {
    const next = !isLinked;
    setIsLinked(next);
    localStorage.setItem("stride-note-linked-mode", String(next));
    localStorage.setItem("dailynote-linked-mode", String(next));
    window.dispatchEvent(new StorageEvent("storage", { key: "stride-note-linked-mode", newValue: String(next) }));
  };

  const [editorFontSize, setEditorFontSize] = useState(FONT_SIZE_DEFAULT);

  useEffect(() => {
    // Read persisted settings on mount (client-only, avoids SSR mismatch)
    const primary = localStorage.getItem("stride-note-linked-mode");
    if (primary !== null) {
      setIsLinked(primary === "true");
    } else {
      setIsLinked(localStorage.getItem("dailynote-linked-mode") === "true");
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "stride-note-linked-mode") setIsLinked(e.newValue === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveTimerRef   = useRef<number | null>(null);
  const prevTaskIdsRef = useRef<Set<string>>(new Set());
  // taskIds currently being moved — suppress auto-delete in onUpdate
  const pendingMoveRef = useRef<Set<string>>(new Set());

  // Stable refs so editor callbacks always read latest values
  const tasksRef        = useRef(tasks);
  const createTaskRef   = useRef(createTask);
  const updateTaskRef   = useRef(updateTask);
  const deleteTaskRef   = useRef(deleteTask);
  const selectedDateRef = useRef(selectedDate);
  const noteRef         = useRef(note);
  const isLinkedRef     = useRef(isLinked);
  const editorRef       = useRef<Editor | null>(null);
  useEffect(() => { tasksRef.current        = tasks;      }, [tasks]);
  useEffect(() => { createTaskRef.current   = createTask; }, [createTask]);
  useEffect(() => { updateTaskRef.current   = updateTask; }, [updateTask]);
  useEffect(() => { deleteTaskRef.current   = deleteTask; }, [deleteTask]);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  useEffect(() => { noteRef.current         = note;       }, [note]);
  useEffect(() => { isLinkedRef.current     = isLinked;   }, [isLinked]);

  const [formatPanelOpen, setFormatPanelOpen] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("stride-format-panel-open") === "true";
    return false;
  });
  const toggleFormatPanel = () => {
    setFormatPanelOpen(prev => {
      const next = !prev;
      localStorage.setItem("stride-format-panel-open", String(next));
      return next;
    });
  };

  // Escape clears multi-select
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFormatPanel();
      } else if (e.key === "Escape") {
        if (formatPanelOpen) {
          // If FormatPanel is open, Escape will be handled by FormatPanel itself or here,
          // but let's be safe.
        } else if (dnSelectedPosesRef.current.size > 0) {
          setDnSelectedPoses(new Set());
          dnAnchorPosRef.current = null;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [formatPanelOpen]);

  // Select all blocks whose DOM rects intersect with the lasso rectangle
  const selectBlocksInRect = useCallback((rect: { x1: number; y1: number; x2: number; y2: number }) => {
    const ed = editorRef.current;
    if (!ed) return;
    const minX = Math.min(rect.x1, rect.x2);
    const maxX = Math.max(rect.x1, rect.x2);
    const minY = Math.min(rect.y1, rect.y2);
    const maxY = Math.max(rect.y1, rect.y2);
    if (maxX - minX < 5 || maxY - minY < 5) return;

    const listWrappers = new Set(["taskList", "bulletList", "orderedList"]);
    const selected = new Set<number>();
    ed.state.doc.forEach((node, offset) => {
      if (listWrappers.has(node.type.name)) {
        node.forEach((child, childOffset) => {
          const childPos = offset + 1 + childOffset;
          const dom = ed.view.nodeDOM(childPos) as HTMLElement | null;
          if (!dom) return;
          const r = dom.getBoundingClientRect();
          if (r.left < maxX && r.right > minX && r.top < maxY && r.bottom > minY) selected.add(childPos);
        });
      } else {
        const dom = ed.view.nodeDOM(offset) as HTMLElement | null;
        if (!dom) return;
        const r = dom.getBoundingClientRect();
        if (r.left < maxX && r.right > minX && r.top < maxY && r.bottom > minY) selected.add(offset);
      }
    });
    if (selected.size >= 2) setDnSelectedPoses(selected);
  }, []); // stable — uses only refs

  // Global mouse handlers for lasso
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!lassoStartRef.current) return;
      const dx = e.clientX - lassoStartRef.current.x;
      const dy = e.clientY - lassoStartRef.current.y;
      if (!isDragSelectingRef.current && Math.hypot(dx, dy) > 5) isDragSelectingRef.current = true;
      if (isDragSelectingRef.current) {
        const r = { x1: lassoStartRef.current.x, y1: lassoStartRef.current.y, x2: e.clientX, y2: e.clientY };
        lassoRectRef.current = r;
        setLassoRect({ ...r });
      }
    };
    const onMouseUp = () => {
      if (isDragSelectingRef.current && lassoRectRef.current) selectBlocksInRect(lassoRectRef.current);
      isDragSelectingRef.current = false;
      lassoStartRef.current = null;
      lassoRectRef.current = null;
      setLassoRect(null);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [selectBlocksInRect]);

  useEffect(() => {
    void (async () => {
      try {
        const n = await getTodayNote();
        onDateChange(n.date);
        setNote(n);
        await loadDailyNotes();
      } catch (err) {
        console.error("DailyNote initial load failed:", err);
      } finally {
        setShowLoading(false);
      }
    })();
    const timer = setTimeout(() => setShowLoading(false), 2000);
    return () => clearTimeout(timer);
  }, [getTodayNote, loadDailyNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const inState = dailyNotes.find((n) => n.date === selectedDate);
    if (!inState) return;
    setNote(inState);
  }, [dailyNotes, selectedDate]);

  // Create/link tasks for unlinked items — only in linked mode, only on blur/Enter
  const syncNewTaskItems = useCallback(async (editor: Editor) => {
    const note = noteRef.current;
    if (!note || !isLinkedRef.current) return;

    const items = scanTaskItems(editor);
    for (const item of items) {
      if (item.taskId) continue;
      if (item.title.length < 3) continue;

      const existing = tasksRef.current.find(
        (t) => t.sourceDocumentId === note.id && t.title.trim() === item.title
      );

      let finalTaskId: string;
      if (existing) {
        finalTaskId = existing.id;
        const newStatus = item.checked ? "done" : "todo";
        if (existing.status !== newStatus) {
          await updateTaskRef.current(existing.id, { status: newStatus });
        }
      } else {
        const created = await createTaskRef.current({
          title: item.title,
          status: item.checked ? "done" : "todo",
          dueDate: selectedDateRef.current,
          sourceDocumentId: note.id,
          sourceDocumentTitle: note.date,
        });
        finalTaskId = created.id;
      }

      // Write taskId back to node so future passes skip creation
      const freshDoc = editor.state.doc;
      freshDoc.nodesBetween(0, freshDoc.nodeSize - 2, (node, pos) => {
        if (node.type.name === "taskItem" && !node.attrs.taskId && node.textContent.trim() === item.title) {
          writeTaskIdToNode(editor, pos, finalTaskId, node.attrs as Record<string, unknown>);
          return false;
        }
      });
    }
  }, []); // stable — reads only refs

  const [isLocked, setIsLocked] = useState(true);

  // Slash command TipTap extension — created once, captures stable refs/setters
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slashCommandExtension = useMemo(() => createSlashCommandExtension(slashPropsRef, slashMenuRef, setSlashMenu), []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ paragraph: false }),
        ParagraphWithLineHeight,
        TaskList,
        TaskItemWithId,
        XChecklistExtension,
        DragHandleExtension,
        Placeholder.configure({ placeholder: "Start writing…" }),
        slashCommandExtension,
        TextStyle,
        Color,
        Link.configure({ openOnClick: false }),
        FontSizeTextStyle,
        FontSizeKeyboardExtension,
      ],
      immediatelyRender: false,
      editable: false, // Default to read-only
      content: note?.content ? safeParseJson(note.content) ?? undefined : undefined,
      editorProps: {
        attributes: {
          class: "min-h-[200px] outline-none  text-[var(--fg)]",
        },
        handleDOMEvents: {
          // Shift+click range selection for all block types
          click: (view, event) => {
            // Don't intercept checkbox input clicks
            if ((event.target as HTMLElement).tagName === "INPUT") return false;

            const resolved = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!resolved) {
              if (dnSelectedPosesRef.current.size > 0) {
                setDnSelectedPoses(new Set());
                dnAnchorPosRef.current = null;
              }
              return false;
            }

            // Find the selectable position: list items at their own depth, other blocks at depth 1
            let blockPos = -1;
            try {
              const $pos = view.state.doc.resolve(resolved.pos);
              // Prefer taskItem or listItem (more granular than the wrapper list)
              for (let d = $pos.depth; d >= 1; d--) {
                const name = $pos.node(d).type.name;
                if (name === "taskItem" || name === "listItem") { blockPos = $pos.before(d); break; }
              }
              // Fall back to depth-1 top-level block
              if (blockPos < 0 && $pos.depth >= 1) blockPos = $pos.before(1);
            } catch { return false; }

            if (blockPos < 0) {
              if (dnSelectedPosesRef.current.size > 0) {
                setDnSelectedPoses(new Set());
                dnAnchorPosRef.current = null;
              }
              return false;
            }

            if (event.shiftKey && dnAnchorPosRef.current !== null) {
              event.preventDefault();
              // Collect ordered selectable positions from the doc
              const orderedPoses = collectSelectablePositions(view.state.doc);
              const aIdx = orderedPoses.indexOf(dnAnchorPosRef.current);
              const bIdx = orderedPoses.indexOf(blockPos);
              if (aIdx >= 0 && bIdx >= 0) {
                const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
                setDnSelectedPoses(new Set(orderedPoses.slice(lo, hi + 1)));
              }
              return true;
            }

            // Regular click: update anchor, clear any existing selection
            dnAnchorPosRef.current = blockPos;
            if (dnSelectedPosesRef.current.size > 0) {
              setDnSelectedPoses(new Set());
            }
            return false;
          },

          // Cross-component drag: set block-type so drop targets know what they received
          dragstart: (_view, event) => {
            const target = event.target as HTMLElement | null;
            if (!event.dataTransfer) return false;

            // Checklist item drag → block-type "task"
            const taskItem = target?.closest("li[data-checked]") as HTMLElement | null;
            if (taskItem) {
              const taskId = taskItem.getAttribute("data-task-id") ?? "";
              const title  = taskItem.querySelector("div")?.textContent?.trim() ?? "";
              if (!title) return false;
              event.dataTransfer.setData("text/block-type",  "task");
              event.dataTransfer.setData("text/task-title",  title);
              event.dataTransfer.setData("stride/taskTitle", title);
              event.dataTransfer.setData("text/plain",       title);
              if (taskId) {
                event.dataTransfer.setData("text/task-id",  taskId);
                event.dataTransfer.setData("stride/taskId", taskId);
              }
              event.dataTransfer.effectAllowed = "move";
              return false;
            }

            // Plain block drag (paragraph, heading, bullet item) → block-type "note"
            const plainBlock = target?.closest("p, h1, h2, h3, h4, li:not([data-checked])") as HTMLElement | null;
            if (plainBlock) {
              const title = plainBlock.textContent?.trim() ?? "";
              if (!title) return false;
              event.dataTransfer.setData("text/block-type",  "note");
              event.dataTransfer.setData("text/task-title",  title);
              event.dataTransfer.setData("stride/taskTitle", title);
              event.dataTransfer.setData("text/plain",       title);
              event.dataTransfer.effectAllowed = "move";
              return false;
            }

            return false;
          },
          contextmenu: (view, event) => {
            const liEl = (event.target as HTMLElement | null)?.closest('li[data-checked]') as HTMLElement | null;
            if (!liEl) return false;

            event.preventDefault();
            event.stopPropagation();

            let title   = "";
            let taskId: string | null = null;
            let checked = false;
            let nodePos = 0;

            // Primary: ProseMirror position resolution
            const resolved = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (resolved) {
              const $pos = view.state.doc.resolve(resolved.pos);
              for (let d = $pos.depth; d >= 0; d--) {
                const node = $pos.node(d);
                if (node.type.name === "taskItem") {
                  title   = node.textContent.trim();
                  taskId  = (node.attrs as Record<string, unknown>).taskId as string | null ?? null;
                  checked = Boolean((node.attrs as Record<string, unknown>).checked);
                  nodePos = $pos.before(d);
                  break;
                }
              }
            }

            // Fallback: read from DOM when posAtCoords fails or walk finds nothing
            if (!title) {
              const contentDiv = liEl.querySelector("div");
              title   = contentDiv?.textContent?.trim() ?? "";
              taskId  = liEl.getAttribute("data-task-id") ?? null;
              checked = liEl.getAttribute("data-checked") === "true";
              if (title) {
                view.state.doc.nodesBetween(0, view.state.doc.nodeSize - 2, (node, pos) => {
                  if (nodePos !== 0) return false;
                  if (node.type.name === "taskItem" && node.textContent.trim() === title) {
                    nodePos = pos;
                  }
                });
              }
            }

            if (!title) return true;
            setNoteContextMenu({ title, taskId, checked, pos: nodePos, x: event.clientX, y: event.clientY });
            return true;
          },
        },
      },
      onUpdate: ({ editor }) => {
        if (!noteRef.current) return;
        const content = JSON.stringify(editor.getJSON());

        // Debounced save
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          void updateNoteContent(noteRef.current!.id, content);
        }, 500);

        const currentItems  = scanTaskItems(editor);
        const currentIds    = new Set(currentItems.flatMap(i => (i.taskId ? [i.taskId] : [])));

        // Detect deletions: linked nodes that disappeared from the doc
        for (const prevId of prevTaskIdsRef.current) {
          if (currentIds.has(prevId)) continue;
          if (pendingMoveRef.current.has(prevId)) {
            pendingMoveRef.current.delete(prevId); // being moved, not deleted
          } else {
            void deleteTaskRef.current(prevId);
          }
        }
        prevTaskIdsRef.current = currentIds;

        // Sync check-state for already-linked tasks
        for (const item of currentItems) {
          if (!item.taskId) continue;
          const task = tasksRef.current.find((t) => t.id === item.taskId);
          if (!task) continue;
          const newStatus = item.checked ? "done" : "todo";
          if (task.status !== newStatus) {
            void updateTaskRef.current(item.taskId, { status: newStatus });
          }
        }
      },
      onBlur: ({ editor }) => { void syncNewTaskItems(editor); },
    },
    [note?.id, isLocked],
  );

  // Sync isLocked state with TipTap editor
  useEffect(() => {
    if (editor) editor.setEditable(!isLocked);
  }, [editor, isLocked]);

  // Keep editorRef current
  useEffect(() => { editorRef.current = editor ?? null; }, [editor]);

  // Track font size at cursor for toolbar readout
  useEffect(() => {
    if (!editor) return;
    const update = () => setEditorFontSize(getCurrentFontSize(editor));
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => { editor.off("selectionUpdate", update); editor.off("transaction", update); };
  }, [editor]);


  // Apply/clear selection highlights directly on the ProseMirror DOM
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    let dom: HTMLElement;
    try { dom = editor.view.dom as HTMLElement; } catch { return; }

    dom.querySelectorAll("[data-pm-selected]").forEach((el) => {
      const h = el as HTMLElement;
      h.removeAttribute("data-pm-selected");
      h.style.background = "";
      h.style.outline = "";
      h.style.borderRadius = "";
    });
    if (dnSelectedPoses.size === 0) return;
    dnSelectedPoses.forEach((pos) => {
      try {
        const nodeDom = editor.view.nodeDOM(pos) as HTMLElement | null;
        if (nodeDom) {
          nodeDom.setAttribute("data-pm-selected", "true");
          nodeDom.style.background = "color-mix(in srgb, var(--accent) 14%, transparent)";
          nodeDom.style.outline = "2px solid color-mix(in srgb, var(--accent) 35%, transparent)";
          nodeDom.style.borderRadius = "6px";
        }
      } catch { /* ignore stale pos */ }
    });
  }, [editor, dnSelectedPoses]);

  useEffect(() => {
    if (!editor || !note) return;
    const nextJson = note.content ? safeParseJson(note.content) : null;
    if (nextJson) {
      editor.commands.setContent(nextJson, { emitUpdate: false });
      // Seed prevTaskIdsRef from the freshly loaded content
      const items = scanTaskItems(editor);
      prevTaskIdsRef.current = new Set(items.flatMap(i => (i.taskId ? [i.taskId] : [])));
    }
  }, [editor, note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
  }, []);

  const goToDate = async (date: string) => {
    const existing = dailyNotes.find((n) => n.date === date);
    if (existing) { setNote(existing); return; }
    const createdOrFound = await ensureDailyNote(date);
    await loadDailyNotes();
    setNote(createdOrFound);
  };

  // Sync note content whenever the parent changes selectedDate
  useEffect(() => {
    void goToDate(selectedDate);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Move a checklist item to another date's note.
   * Removes it from the current editor, appends it to the target note, and updates
   * the linked task's dueDate. The pendingMoveRef prevents onUpdate from deleting
   * the task when it detects the node disappearing.
   */
  const handleMoveItem = useCallback(async (title: string, taskId: string | null, targetDate: string) => {
    const ed   = editorRef.current;
    const note = noteRef.current;
    if (!ed || !note) return;

    if (taskId) pendingMoveRef.current.add(taskId);

    // Detect node type before removing — only match taskItem/paragraph/heading directly,
    // skip wrapper nodes (taskList, bulletList, doc) whose textContent also matches
    const wrappers = new Set(["doc", "taskList", "bulletList", "orderedList", "blockquote"]);
    let nodeType = "paragraph";
    ed.state.doc.nodesBetween(0, ed.state.doc.nodeSize - 2, (node) => {
      if (wrappers.has(node.type.name)) return true; // descend into wrappers
      if (node.textContent.trim() === title) {
        nodeType = node.type.name; // e.g. "taskItem", "paragraph", "heading"
        return false; // stop traversal
      }
    });

    removeNodeFromEditor(ed, title);

    // Flush save immediately so the removal is persisted before writing to the target
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    await updateNoteContent(note.id, JSON.stringify(ed.getJSON()));

    // Get or create target note — use upsertNote which handles Supabase creation
    const storeState = useDailyNoteStore.getState();
    const existingTarget = storeState.dailyNotes.find(n => n.date === targetDate);
    const targetContent = existingTarget?.content ?? JSON.stringify({ type: "doc", content: [] });

    // If not in store, fetch from Supabase directly so we get the real content
    let resolvedContent = targetContent;
    if (!existingTarget) {
      const { data: row } = await (await import("@/lib/supabase/client")).createClient()
        .from("daily_notes").select("content").eq("date", targetDate).maybeSingle();
      if (row?.content) resolvedContent = row.content;
    }

    const targetDoc  = safeParseJson(resolvedContent) ?? { type: "doc", content: [] };
    const contentArr: JSONContent[] = Array.isArray((targetDoc as any).content) ? (targetDoc as any).content : [];

    if (nodeType === "taskItem") {
      // Append as a taskItem inside a taskList
      const newItem: JSONContent = {
        type: "taskItem",
        attrs: { checked: false, taskId },
        content: [{ type: "paragraph", content: [{ type: "text", text: title }] }],
      };
      const last = contentArr[contentArr.length - 1];
      if (last?.type === "taskList") {
        last.content = [...(last.content ?? []), newItem];
      } else {
        contentArr.push({ type: "taskList", content: [newItem] });
      }
    } else {
      // Append plain text blocks (paragraphs, headings, bullets) as a paragraph
      contentArr.push({ type: "paragraph", content: [{ type: "text", text: title }] });
    }

    // upsertNote creates the Supabase row if it doesn't exist, then writes content
    await upsertNote(targetDate, JSON.stringify({ ...targetDoc, content: contentArr }));

    // Update the task dueDate so it appears on the correct day in all filtered views
    if (taskId) {
      await updateTaskRef.current(taskId, { dueDate: targetDate });
    }
  }, [updateNoteContent, upsertNote]);

  // Expose handleMoveItem to parent via ref so external drop targets can trigger it
  useEffect(() => {
    if (moveItemRef) moveItemRef.current = handleMoveItem;
  }, [handleMoveItem, moveItemRef]);

  // Handle block move from EditorBubbleMenu
  useEffect(() => {
    const h = (e: any) => {
      const { date, editor: ed } = e.detail;
      if (ed !== editor) return;
      const { $from } = ed.state.selection;
      const node = $from.node($from.depth);
      const title = node.textContent.trim();
      const taskId = (node.attrs as any).taskId || null;
      if (title) void handleMoveItem(title, taskId, date);
    };
    window.addEventListener("stride-move-block" as any, h);
    return () => window.removeEventListener("stride-move-block" as any, h);
  }, [editor, handleMoveItem]);

  /**
   * Delete a checklist item from the editor.
   * For linked items, onUpdate detects the missing taskId and calls deleteTask automatically.
   */
  const handleDeleteItem = useCallback(async (title: string) => {
    const ed   = editorRef.current;
    const note = noteRef.current;
    if (!ed || !note) return;

    removeNodeFromEditor(ed, title);

    // Save immediately so the deleted item doesn't reappear on reload
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    await updateNoteContent(note.id, JSON.stringify(ed.getJSON()));
  }, [updateNoteContent]);

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !editor) return;
    const { $from } = editor.state.selection;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === "taskItem") {
        setTimeout(() => void syncNewTaskItems(editor), 0);
        break;
      }
    }
  };

  const handleScheduleItem = useCallback(async (title: string, taskId: string | null, dueDate: string) => {
    if (taskId) {
      await updateTask(taskId, { dueDate });
      return;
    }
    const n = noteRef.current;
    const created = await createTask({
      title, status: "todo", dueDate,
      sourceDocumentId: n?.id,
      sourceDocumentTitle: n?.date,
    });
    const ed = editorRef.current;
    if (!ed) return;
    ed.state.doc.nodesBetween(0, ed.state.doc.nodeSize - 2, (node, pos) => {
      if (node.type.name === "taskItem" && !node.attrs.taskId && node.textContent.trim() === title) {
        writeTaskIdToNode(ed, pos, created.id, node.attrs as Record<string, unknown>);
        return false;
      }
    });
  }, [updateTask, createTask]);

  const handleToggleChecked = useCallback((pos: number, checked: boolean, taskId: string | null) => {
    const ed = editorRef.current;
    if (!ed) return;
    const node = ed.state.doc.nodeAt(pos) as PmNode | null;
    if (!node) return;
    ed.view.dispatch(
      ed.view.state.tr
        .setNodeMarkup(pos, undefined, { ...node.attrs, checked: !checked })
        .setMeta("addToHistory", false)
    );
    if (taskId) void updateTask(taskId, { status: !checked ? "done" : "todo" });
  }, [updateTask]);

  const handleNavigateToTask = useCallback(async (title: string, taskId: string | null) => {
    if (!taskId) {
      const n = noteRef.current;
      const created = await createTask({
        title, status: "todo",
        sourceDocumentId: n?.id,
        sourceDocumentTitle: n?.date,
      });
      const ed = editorRef.current;
      if (ed) {
        ed.state.doc.nodesBetween(0, ed.state.doc.nodeSize - 2, (node, pos) => {
          if (node.type.name === "taskItem" && !node.attrs.taskId && node.textContent.trim() === title) {
            writeTaskIdToNode(ed, pos, created.id, node.attrs as Record<string, unknown>);
            return false;
          }
        });
      }
    }
    router.push("/tasks");
  }, [createTask, router]);

  if (!note) {
    return (
      <div className="flex h-full w-full items-center justify-center py-16 text-sm" style={{ color: "var(--fg-muted)" }}>
        {showLoading ? "Loading…" : "No note"}
      </div>
    );
  }

  return (
    <div className="group relative mx-auto w-full max-w-2xl px-8 py-8">
      {/* Floating controls — subtle, only visible on hover */}
      {!hideHeader && (
        <div
          className="absolute flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ top: 20, right: 32, zIndex: 10 }}
        >
          <span
            title="Font size — use Cmd+= / Cmd+- to adjust, Cmd+0 to reset"
            style={{ fontSize: 11, color: "var(--fg-muted)", userSelect: "none", fontVariantNumeric: "tabular-nums" }}
          >
            {editorFontSize}px
          </span>
          <button
            type="button"
            onClick={() => setIsLocked(!isLocked)}
            title={isLocked ? "Unlock to edit" : "Lock editor (Read-only)"}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: 8,
              border: "1px solid var(--border)",
              background: isLocked ? "var(--bg-subtle)" : "var(--bg-active)",
              color: isLocked ? "var(--fg-muted)" : "var(--accent)",
              fontSize: "0.7rem", fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {isLocked ? (
              <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                <path d="M5 6V4.5a2.5 2.5 0 1 1 5 0V6m-7 0h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                <path d="M10.5 4.5V3a2.5 2.5 0 0 0-5 0v1.5m-.5 2h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM5 9v2M10 9v2" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            )}
            {isLocked ? "Read-only" : "Editing"}
          </button>
          <button
            type="button"
            data-format-trigger
            onClick={toggleFormatPanel}
            className="flex items-center justify-center w-[25px] h-[25px] rounded-lg transition-colors border"
            style={{
              background: formatPanelOpen ? "var(--bg-active)" : "var(--bg-subtle)",
              borderColor: formatPanelOpen ? "var(--accent)" : "var(--border)",
              color: formatPanelOpen ? "var(--accent)" : "var(--fg-muted)"
            }}
            title="Format Panel (Cmd+Shift+F)"
          >
            <span className="text-[12px] font-bold font-serif leading-none">Aa</span>
          </button>
          <button
            type="button"
            onClick={toggleLinked}
            title={isLinked
              ? "Linked mode: checklist items sync as tasks. Click to switch to independent."
              : "Independent mode: checklist items are local only. Click to link to task manager."}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: 8,
              border: "1px solid var(--border)",
              background: isLinked ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--bg-subtle)",
              color: isLinked ? "var(--accent)" : "var(--fg-muted)",
              fontSize: "0.7rem", fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {isLinked ? <LinkIcon /> : <UnlinkIcon />}
            {isLinked ? "Linked" : "Independent"}
          </button>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorWrapperRef}
        onKeyDown={handleEditorKeyDown}
        onMouseDown={(e) => {
          // Only start lasso if clicking outside the editor content (on padding/empty area)
          if (e.button !== 0) return;
          if (editor && editor.view && editor.view.dom.contains(e.target as Node)) return;
          lassoStartRef.current = { x: e.clientX, y: e.clientY };
        }}
        style={{ position: "relative" }}
      >
        {editor ? (
          <>
            <EditorContent editor={editor} />
            <EditorBubbleMenu editor={editor} />
            <FormatPanel editor={editor} isOpen={formatPanelOpen} onClose={() => setFormatPanelOpen(false)} documentId={note.id} />
          </>
        ) : null}
      </div>


      {lassoRect && createPortal(
        <div
          style={{
            position: "fixed",
            pointerEvents: "none",
            zIndex: 9998,
            left:   Math.min(lassoRect.x1, lassoRect.x2),
            top:    Math.min(lassoRect.y1, lassoRect.y2),
            width:  Math.abs(lassoRect.x2 - lassoRect.x1),
            height: Math.abs(lassoRect.y2 - lassoRect.y1),
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            borderRadius: 4,
          }}
        />,
        document.body,
      )}

      {noteContextMenu && createPortal(
        <NoteItemContextMenu
          item={noteContextMenu}
          selectedDate={selectedDate}
          onMove={(date) => void handleMoveItem(noteContextMenu.title, noteContextMenu.taskId, date)}
          onDelete={() => void handleDeleteItem(noteContextMenu.title)}
          onSchedule={(dueDate) => void handleScheduleItem(noteContextMenu.title, noteContextMenu.taskId, dueDate)}
          onToggleChecked={() => handleToggleChecked(noteContextMenu.pos, noteContextMenu.checked, noteContextMenu.taskId)}
          onNavigateToTask={() => void handleNavigateToTask(noteContextMenu.title, noteContextMenu.taskId)}
          onClose={() => setNoteContextMenu(null)}
        />,
        document.body,
      )}

      {dnSelectedPoses.size >= 2 && createPortal(
        <DnSelectionBar
          selectedPoses={dnSelectedPoses}
          editorRef={editorRef}
          updateTask={updateTask}
          deleteTask={deleteTask}
          createTask={createTask}
          onClear={() => { setDnSelectedPoses(new Set()); dnAnchorPosRef.current = null; }}
        />,
        document.body,
      )}

      {slashMenu && slashMenu.items.length > 0 && createPortal(
        <SlashCommandMenu
          items={slashMenu.items}
          activeIndex={slashMenu.activeIndex}
          rect={slashMenu.rect}
          onSelect={(cmd) => {
            slashPropsRef.current?.command(cmd);
            setSlashMenu(null);
          }}
          onClose={() => setSlashMenu(null)}
        />,
        document.body,
      )}
    </div>
  );
}

function safeParseJson(value: string): JSONContent | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as JSONContent;
  } catch {
    return null;
  }
}