"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { JSONContent } from "@tiptap/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { db } from "@/db/index";
import { XChecklistExtension } from "@/lib/xChecklistExtension";
import { useDailyNoteStore } from "@/store/dailyNoteStore";
import { useTaskStore } from "@/store/taskStore";
import type { DailyNote } from "@/types/index";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
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

function formatHeading(date: string): string {
  const d = parseDateOnly(date);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric",
  }).format(d);
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
  editor.view.dispatch(
    editor.view.state.tr
      .setNodeMarkup(pos, undefined, { ...attrs, taskId })
      .setMeta("addToHistory", false)
  );
}

/** Remove a taskItem node from the editor by title match. Returns true if found. */
function removeNodeFromEditor(editor: Editor, title: string): boolean {
  const doc = editor.state.doc;
  const tr  = editor.state.tr;
  let found = false;
  doc.nodesBetween(0, doc.nodeSize - 2, (node, pos) => {
    if (found) return false;
    if (node.type.name === "taskItem" && node.textContent.trim() === title) {
      tr.delete(pos, pos + node.nodeSize);
      found = true;
      return false;
    }
  });
  if (found) editor.view.dispatch(tr);
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

// ─── NoteItemContextMenu ──────────────────────────────────────────────────────

type NoteMenuState = { title: string; taskId: string | null; x: number; y: number };

function NoteItemContextMenu({
  item, onMove, onDelete, onClose,
}: {
  item: NoteMenuState;
  onMove: (date: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef  = useRef<HTMLDivElement>(null);
  const dateRef  = useRef<HTMLInputElement>(null);
  const [clPos, setClPos] = useState({ x: item.x, y: item.y });

  const today    = useMemo(() => dateOnlyString(new Date()), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setClPos({
      x: Math.max(8, Math.min(item.x, window.innerWidth  - r.width  - 8)),
      y: Math.max(8, Math.min(item.y, window.innerHeight - r.height - 8)),
    });
  }, [item.x, item.y]);

  useEffect(() => {
    const h = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener("pointerdown", h);
    return () => window.removeEventListener("pointerdown", h);
  }, [onClose]);

  const row = (label: string, action: () => void, danger = false) => (
    <button key={label} type="button" onClick={action}
      style={{
        width: "100%", display: "block", textAlign: "left",
        padding: "6px 12px", borderRadius: 8,
        fontSize: "0.8125rem", color: danger ? "#ef4444" : "var(--fg)",
        background: "transparent", border: "none", cursor: "pointer",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : "var(--bg-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >{label}</button>
  );

  return (
    <div ref={menuRef} style={{
      position: "fixed", left: clPos.x, top: clPos.y, zIndex: 9999, width: 200,
      background: "var(--bg-card)", border: "1px solid var(--border-mid)",
      borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 4,
    }}>
      <div style={{ padding: "6px 12px 4px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
        <div style={{ fontSize: "0.75rem", color: "var(--fg-muted)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </div>
      </div>

      {row("Move to Today",    () => { onMove(today);    onClose(); })}
      {row("Move to Tomorrow", () => { onMove(tomorrow); onClose(); })}
      <button type="button"
        onClick={() => dateRef.current?.showPicker?.()}
        style={{ width: "100%", display: "block", textAlign: "left", padding: "6px 12px", borderRadius: 8, fontSize: "0.8125rem", color: "var(--fg)", background: "transparent", border: "none", cursor: "pointer" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >📅 Pick Date…</button>
      <input ref={dateRef} type="date" style={{ display: "none" }}
        onChange={e => { if (e.target.value) { onMove(e.target.value); onClose(); } }} />

      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
      {row(item.taskId ? "Delete Task" : "Remove Item", () => { onDelete(); onClose(); }, true)}
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

export function DailyNote() {
  const dailyNotes        = useDailyNoteStore((s) => s.dailyNotes);
  const loadDailyNotes    = useDailyNoteStore((s) => s.loadDailyNotes);
  const getTodayNote      = useDailyNoteStore((s) => s.getTodayNote);
  const updateNoteContent = useDailyNoteStore((s) => s.updateNoteContent);

  const tasks      = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const createTask = useTaskStore((s) => s.createTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const today = useMemo(() => dateOnlyString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [note, setNote]                 = useState<DailyNote | null>(null);
  const [showLoading, setShowLoading]   = useState(true);
  const [noteContextMenu, setNoteContextMenu] = useState<NoteMenuState | null>(null);

  // Linked mode: tasks sync to task manager. Default off (independent).
  const [isLinked, setIsLinked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dailynote-linked-mode") === "true";
  });
  const toggleLinked = () => {
    const next = !isLinked;
    setIsLinked(next);
    localStorage.setItem("dailynote-linked-mode", String(next));
  };

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

  useEffect(() => {
    void (async () => {
      try {
        const n = await getTodayNote();
        setSelectedDate(n.date);
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
  }, [getTodayNote, loadDailyNotes]);

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

  const editor = useEditor(
    {
      extensions: [StarterKit, TaskList, TaskItemWithId, XChecklistExtension],
      immediatelyRender: false,
      content: note?.content ? safeParseJson(note.content) ?? undefined : undefined,
      editorProps: {
        attributes: {
          class: "min-h-[200px] outline-none leading-7 text-[var(--fg)] [&_ul]:ml-6 [&_ol]:ml-6",
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
    [note?.id],
  );

  // Keep editorRef current
  useEffect(() => { editorRef.current = editor ?? null; }, [editor]);

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
    setSelectedDate(date);
    const existing = dailyNotes.find((n) => n.date === date);
    if (existing) { setNote(existing); return; }
    const createdOrFound = await ensureDailyNote(date);
    await loadDailyNotes();
    setNote(createdOrFound);
  };

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

    removeNodeFromEditor(ed, title);

    // Save current note immediately
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    await updateNoteContent(note.id, JSON.stringify(ed.getJSON()));

    // Get or create target note
    const storeState = useDailyNoteStore.getState();
    let targetNote = storeState.dailyNotes.find(n => n.date === targetDate);
    if (!targetNote) {
      targetNote = await ensureDailyNote(targetDate);
      await storeState.loadDailyNotes();
    }

    // Append the checklist item to the target note's content JSON
    const targetDoc  = safeParseJson(targetNote.content) ?? { type: "doc", content: [] };
    const contentArr: JSONContent[] = Array.isArray((targetDoc as any).content) ? (targetDoc as any).content : [];
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
    await updateNoteContent(targetNote.id, JSON.stringify({ ...targetDoc, content: contentArr }));

    // Update linked task dueDate and remove from pending set
    if (taskId) {
      await updateTaskRef.current(taskId, { dueDate: targetDate });
      pendingMoveRef.current.delete(taskId);
    }
  }, [updateNoteContent]);

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

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    if (!editor) return;
    const li = (e.target as HTMLElement).closest('li[data-type="taskItem"]');
    if (!li) return;
    e.preventDefault();
    const title  = (li.querySelector("div > p") ?? li).textContent?.trim() ?? "";
    if (!title) return;
    // Read taskId directly from the DOM attr set by TaskItemWithId.renderHTML
    const taskId = (li as HTMLElement).getAttribute("data-task-id") ?? null;
    setNoteContextMenu({ title, taskId, x: e.clientX, y: e.clientY });
  };

  if (!note) {
    return (
      <div className="flex h-full w-full items-center justify-center py-16 text-sm" style={{ color: "var(--fg-muted)" }}>
        {showLoading ? "Loading…" : "No note"}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-8">
      {/* Section label + sync-mode toggle */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--fg-faint)" }}>
          Daily Note
        </p>
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
            color: isLinked ? "var(--accent)" : "var(--fg-faint)",
            fontSize: "0.7rem", fontWeight: 500, cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {isLinked ? <LinkIcon /> : <UnlinkIcon />}
          {isLinked ? "Linked" : "Independent"}
        </button>
      </div>

      {/* Heading + inline nav arrows */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void goToDate(addDays(selectedDate, -1))}
            aria-label="Previous day"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg-faint)" }}
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M6 1L1 6l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <h1
            className="flex-1 leading-tight"
            style={{ fontSize: "28px", fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.022em" }}
          >
            {formatHeading(selectedDate)}
          </h1>

          <button
            type="button"
            onClick={() => void goToDate(addDays(selectedDate, 1))}
            aria-label="Next day"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg-faint)" }}
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {selectedDate !== today && (
          <button
            type="button"
            onClick={() => void goToDate(today)}
            className="mt-2 text-[12px] transition-all duration-150 ease-out hover:opacity-70"
            style={{ color: "var(--accent)" }}
          >
            ↩ Back to today
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="mb-5 h-px" style={{ background: "var(--border)" }} />

      {/* Editor */}
      <div onContextMenu={handleEditorContextMenu} onKeyDown={handleEditorKeyDown}>
        {editor ? <EditorContent editor={editor} /> : null}
      </div>

      {/* Hint */}
      <p className="mt-6 text-[11px]" style={{ color: "var(--fg-faint)" }}>
        {isLinked
          ? <>Type <kbd className="rounded px-1 py-0.5 text-[10px]" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>x </kbd> to create a linked task · Right-click to move or delete</>
          : <>Type <kbd className="rounded px-1 py-0.5 text-[10px]" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>x </kbd> to add a checklist item · Right-click to move or delete</>
        }
      </p>

      {noteContextMenu && (
        <NoteItemContextMenu
          item={noteContextMenu}
          onMove={(date) => void handleMoveItem(noteContextMenu.title, noteContextMenu.taskId, date)}
          onDelete={() => void handleDeleteItem(noteContextMenu.title)}
          onClose={() => setNoteContextMenu(null)}
        />
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
