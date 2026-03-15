"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSectionStore } from "@/store/sectionStore";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import type { Task, TaskPriority } from "@/types/index";

type Props = {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
};

type Panel = "none" | "date" | "section" | "more";

function dateOnly(v: string) {
  return v.includes("T") ? v.slice(0, 10) : v;
}

function friendlyDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0)  return "Today";
  if (diff === 1)  return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < -1)  return `${Math.abs(diff)}d overdue`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function isOverdue(d: string): boolean {
  return new Date(d + "T00:00:00") < new Date(new Date().toDateString());
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "none",   label: "None",   color: "var(--fg-faint)"       },
  { value: "low",    label: "Low",    color: "var(--priority-low)"   },
  { value: "medium", label: "Medium", color: "var(--priority-medium)"},
  { value: "high",   label: "High",   color: "var(--priority-high)"  },
];

export function TaskDetailModal({ task, position, onClose }: Props) {
  const tasks      = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const createTask = useTaskStore((s) => s.createTask);

  const sections    = useSectionStore((s) => s.sections);
  const subsections = useSectionStore((s) => s.subsections);
  const projects    = useProjectStore((s) => s.projects);

  const modalRef   = useRef<HTMLDivElement>(null);
  const notesRef   = useRef<HTMLTextAreaElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);

  const [pos, setPos]           = useState({ x: -9999, y: 0 }); // hidden until clamped
  const [titleDraft, setTitle]  = useState(task.title);
  const [notesDraft, setNotes]  = useState(task.notes ?? "");
  const [panel, setPanel]       = useState<Panel>("none");
  const [newSubtask, setNewSub] = useState("");
  const [editSubId, setEditSubId]   = useState<string | null>(null);
  const [editSubVal, setEditSubVal] = useState("");

  const isDone   = task.status === "done";
  const subtasks = useMemo(() => tasks.filter((t) => t.parentTaskId === task.id), [tasks, task.id]);
  const sectionSubsections = useMemo(
    () => subsections.filter((s) => s.sectionId === task.sectionId),
    [subsections, task.sectionId],
  );
  const currentSection  = sections.find((s) => s.id === task.sectionId);
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === task.priority) ?? PRIORITY_OPTIONS[0]!;

  const localDate   = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr    = localDate(new Date());
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d); })();
  const nextWeekStr = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return localDate(d); })();

  // Clamp to viewport — runs after every render so expanding panels stay on-screen
  useLayoutEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const pad = 12;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.min(Math.max(position.x, pad), vw - width  - pad),
      y: Math.min(Math.max(position.y, pad), vh - height - pad),
    });
  }, [position, panel]); // re-clamp whenever a panel opens/closes

  const save = () => {
    const t = titleDraft.trim();
    if (t !== task.title) void updateTask(task.id, { title: t || task.title });
    if (notesDraft !== task.notes) void updateTask(task.id, { notes: notesDraft });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { save(); onClose(); }
    };
    const onOut = (e: PointerEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        save(); onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onOut);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onOut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleDraft, notesDraft]);

  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? "none" : p));

  const addSubtask = async (title?: string) => {
    const t = (title ?? newSubtask).trim();
    if (!t) return;
    const sub = await createTask({ title: t, parentTaskId: task.id, status: "todo" });
    await updateTask(task.id, { subtaskIds: [...(task.subtaskIds ?? []), sub.id] });
    if (!title) { setNewSub(""); subtaskRef.current?.focus(); }
  };

  return (
    <div
      ref={modalRef}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 flex flex-col rounded-2xl overflow-hidden"
      style={{
        left: pos.x,
        top:  pos.y,
        width: 400,
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        boxShadow: "var(--shadow-float)",
        // cap height so it never overflows the viewport
        maxHeight: "calc(100vh - 24px)",
      }}
    >
      {/* ── Top chrome ── */}
      <div className="flex flex-none items-center gap-1 px-3 pt-3 pb-2 flex-wrap">
        {/* Section chip */}
        <button
          onClick={() => togglePanel("section")}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
          style={{
            color: panel === "section"
              ? "var(--accent)"
              : currentSection ? "var(--fg-muted)" : "var(--fg-faint)",
            background: panel === "section" ? "var(--bg-active)" : "transparent",
          }}
        >
          {currentSection?.icon && <span>{currentSection.icon}</span>}
          <span>{currentSection?.title ?? "No section"}</span>
        </button>

        <span className="text-[10px]" style={{ color: "var(--border-strong)" }}>·</span>

        {/* Date chip */}
        <button
          onClick={() => togglePanel("date")}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
          style={{
            background: panel === "date" ? "var(--bg-active)" : "transparent",
            color: task.dueDate
              ? isOverdue(dateOnly(task.dueDate)) ? "var(--priority-high)" : "var(--accent)"
              : panel === "date" ? "var(--accent)" : "var(--fg-faint)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="flex-none">
            <rect x=".6" y="1.1" width="9.8" height="9.3" rx="1.6" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M3.5.5v1.5M7.5.5v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1=".6" y1="4.2" x2="10.4" y2="4.2" stroke="currentColor" strokeWidth="1.1"/>
          </svg>
          <span>{task.dueDate ? friendlyDate(dateOnly(task.dueDate)) : "Date"}</span>
        </button>

        <div className="flex-1" />

        {/* Complete toggle */}
        <button
          onClick={() => void updateTask(task.id, { status: isDone ? "todo" : "done" })}
          title={isDone ? "Mark incomplete" : "Mark complete"}
          className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-[5px] transition-all duration-200 ease-out"
          style={isDone
            ? { background: "var(--accent)", border: "1.5px solid var(--accent)" }
            : { border: "1.5px solid var(--border-strong)", background: "transparent" }
          }
        >
          {isDone && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={() => { save(); onClose(); }}
          className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-lg transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg-faint)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex flex-col overflow-y-auto" style={{ minHeight: 0 }}>

        {/* Title */}
        <div className="px-4 pb-1 pt-1">
          <textarea
            value={titleDraft}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const t = titleDraft.trim();
              if (t !== task.title) void updateTask(task.id, { title: t || task.title });
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); notesRef.current?.focus(); }
            }}
            rows={1}
            placeholder="Task title"
            className="w-full resize-none bg-transparent font-semibold leading-snug outline-none"
            style={{
              fontSize: "15px",
              color: isDone ? "var(--fg-faint)" : "var(--fg)",
              textDecoration: isDone ? "line-through" : "none",
              fieldSizing: "content",
            } as React.CSSProperties}
          />
        </div>

        {/* Notes */}
        <div className="px-4 pb-3">
          <textarea
            ref={notesRef}
            value={notesDraft}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notesDraft !== task.notes) void updateTask(task.id, { notes: notesDraft });
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                const pos       = e.currentTarget.selectionStart;
                const lineStart = notesDraft.lastIndexOf("\n", pos - 1) + 1;
                const line      = notesDraft.slice(lineStart, pos);
                if (/^[xX] \S/.test(line)) {
                  e.preventDefault();
                  const title    = line.slice(2).trim();
                  const before   = lineStart > 0 ? notesDraft.slice(0, lineStart - 1) : "";
                  const after    = notesDraft.slice(pos);
                  const newNotes = before + after;
                  setNotes(newNotes);
                  void updateTask(task.id, { notes: newNotes });
                  void addSubtask(title);
                }
              }
            }}
            placeholder="Notes… (type 'x Task name' + Enter to add a subtask)"
            rows={2}
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
            style={{
              color: "var(--fg-muted)",
              fieldSizing: "content",
              minHeight: 44,
            } as React.CSSProperties}
          />
        </div>

        {/* ── Subtasks — always visible ── */}
        {(subtasks.length > 0 || true) && (
          <div className="px-4 pb-3">
            {subtasks.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {subtasks.map((st) => (
                  <div key={st.id} className="group flex items-center gap-2">
                    <button
                      onClick={() => void updateTask(st.id, { status: st.status === "done" ? "todo" : "done" })}
                      className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[3px] transition-all duration-150 ease-out"
                      style={st.status === "done"
                        ? { background: "var(--accent)", border: "1.5px solid var(--accent)" }
                        : { border: "1.5px solid var(--border-strong)", background: "transparent" }
                      }
                    >
                      {st.status === "done" && (
                        <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
                          <path d="M1 3L3 5L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    {editSubId === st.id ? (
                      <input
                        autoFocus value={editSubVal}
                        onChange={(e) => setEditSubVal(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") { if (editSubVal.trim()) void updateTask(st.id, { title: editSubVal.trim() }); setEditSubId(null); }
                          if (e.key === "Escape") setEditSubId(null);
                        }}
                        onBlur={() => { if (editSubVal.trim()) void updateTask(st.id, { title: editSubVal.trim() }); setEditSubId(null); }}
                        className="flex-1 bg-transparent text-[13px] outline-none"
                        style={{ borderBottom: "1px solid var(--border-mid)", color: "var(--fg)", paddingBottom: "1px" }}
                      />
                    ) : (
                      <span
                        onClick={() => { setEditSubId(st.id); setEditSubVal(st.title); }}
                        className="flex-1 cursor-text text-[13px]"
                        style={st.status === "done"
                          ? { textDecoration: "line-through", color: "var(--fg-faint)" }
                          : { color: "var(--fg-muted)" }
                        }
                      >{st.title || "Untitled"}</span>
                    )}
                    <button
                      onClick={() => void deleteTask(st.id)}
                      className="flex-none opacity-0 group-hover:opacity-60 transition-opacity text-xs hover:opacity-100"
                      style={{ color: "var(--fg-faint)" }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
            {/* Inline add subtask */}
            <div className="flex items-center gap-2">
              <span
                className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[3px] text-[10px]"
                style={{ border: "1.5px dashed var(--border-strong)", color: "var(--fg-faint)" }}
              >+</span>
              <input
                ref={subtaskRef} value={newSubtask}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") void addSubtask();
                  if (e.key === "Escape") setNewSub("");
                }}
                placeholder="Add subtask…"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "var(--fg)", caretColor: "var(--accent)" }}
              />
            </div>
          </div>
        )}

        {/* ── Expanding panels — sit between notes and toolbar ── */}

        {panel === "date" && (
          <div
            className="mx-3 mb-3 rounded-xl p-3 space-y-2.5"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
          >
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Today",     val: todayStr    },
                { label: "Tomorrow",  val: tomorrowStr },
                { label: "Next week", val: nextWeekStr },
              ].map(({ label, val }) => {
                const active = task.dueDate && dateOnly(task.dueDate) === val;
                return (
                  <button
                    key={label}
                    onClick={() => { void updateTask(task.id, { dueDate: val }); setPanel("none"); }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ease-out"
                    style={active
                      ? { background: "var(--accent-bg-strong)", color: "var(--accent)" }
                      : { background: "var(--bg-card)", color: "var(--fg-muted)", border: "1px solid var(--border)" }
                    }
                  >
                    {label}
                  </button>
                );
              })}
              {task.dueDate && (
                <button
                  onClick={() => { void updateTask(task.id, { dueDate: undefined }); setPanel("none"); }}
                  className="rounded-lg px-3 py-1.5 text-xs transition-all duration-150 ease-out hover:bg-[var(--bg-card)]"
                  style={{ color: "var(--fg-faint)" }}
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="date"
              value={task.dueDate ? dateOnly(task.dueDate) : ""}
              onChange={(e) => void updateTask(task.id, { dueDate: e.target.value || undefined })}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
              }}
            />
          </div>
        )}

        {panel === "section" && (
          <div
            className="mx-3 mb-3 rounded-xl p-1.5"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
          >
            <button
              onClick={() => { void updateTask(task.id, { sectionId: undefined, subsectionId: undefined }); setPanel("none"); }}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-left transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
              style={{ color: !task.sectionId ? "var(--fg)" : "var(--fg-muted)" }}
            >
              <span className="flex-1">No section</span>
              {!task.sectionId && <span style={{ color: "var(--accent)" }}>✓</span>}
            </button>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => { void updateTask(task.id, { sectionId: s.id, subsectionId: undefined }); setPanel("none"); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--fg-muted)" }}
              >
                {s.icon && <span>{s.icon}</span>}
                <span className="flex-1">{s.title}</span>
                {task.sectionId === s.id && <span style={{ color: "var(--accent)" }}>✓</span>}
              </button>
            ))}
            {task.sectionId && sectionSubsections.length > 0 && (
              <>
                <div className="mx-2 my-1 h-px" style={{ background: "var(--border)" }} />
                <p className="px-3 py-1 text-[10px] uppercase tracking-widest" style={{ color: "var(--fg-faint)" }}>Subsection</p>
                <button
                  onClick={() => void updateTask(task.id, { subsectionId: undefined })}
                  className="flex w-full items-center rounded-lg px-3 py-1.5 text-xs text-left transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
                  style={{ color: !task.subsectionId ? "var(--fg)" : "var(--fg-muted)" }}
                >
                  <span className="flex-1">None</span>
                  {!task.subsectionId && <span style={{ color: "var(--accent)" }}>✓</span>}
                </button>
                {sectionSubsections.map((su) => (
                  <button
                    key={su.id}
                    onClick={() => void updateTask(task.id, { subsectionId: su.id })}
                    className="flex w-full items-center rounded-lg px-3 py-1.5 text-xs text-left transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    <span className="flex-1"># {su.title}</span>
                    {task.subsectionId === su.id && <span style={{ color: "var(--accent)" }}>✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {panel === "more" && (
          <div
            className="mx-3 mb-3 rounded-xl p-3 space-y-3"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
          >
            {/* Repeat */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--fg-faint)" }}>Repeat</p>
              <select
                value={task.recurrence?.frequency ?? "none"}
                onChange={(e) => {
                  const v = e.target.value;
                  void updateTask(task.id, v === "none" ? { recurrence: undefined } : { recurrence: { frequency: v as any, interval: 1 } });
                }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                <option value="none">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Project */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--fg-faint)" }}>Project</p>
              <select
                value={task.projectId ?? ""}
                onChange={(e) => void updateTask(task.id, { projectId: e.target.value || undefined })}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            {/* Tags */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--fg-faint)" }}>Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="group inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]"
                    style={{ background: "var(--bg-hover)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                  >
                    #{tag}
                    <button
                      onClick={() => void updateTask(task.id, { tags: task.tags.filter((t) => t !== tag) })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--fg-faint)" }}
                    >✕</button>
                  </span>
                ))}
                <TagAdder task={task} updateTask={updateTask} />
              </div>
            </div>

            {/* Source doc */}
            {task.sourceDocumentId && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--fg-faint)" }}>Source</p>
                <Link
                  href={`/documents/${task.sourceDocumentId}`}
                  onClick={() => { save(); onClose(); }}
                  className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--fg-muted)" }}
                >
                  📄 {task.sourceDocumentTitle || "Untitled"}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div
        className="flex flex-none items-center gap-0.5 px-2 py-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <ToolBtn active={panel === "date" || !!task.dueDate} onClick={() => togglePanel("date")} title="Due date">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
            <rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3" strokeLinecap="round"/><line x1="1.5" y1="7" x2="14.5" y2="7"/>
          </svg>
        </ToolBtn>

        <ToolBtn active={panel === "section" || !!task.sectionId} onClick={() => togglePanel("section")} title="Section">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
            <path d="M2 12V4.5A1.5 1.5 0 013.5 3h4.3l1.7 2H13A1.5 1.5 0 0114.5 6.5V12A1.5 1.5 0 0113 13.5H3.5A1.5 1.5 0 012 12z"/>
          </svg>
        </ToolBtn>

        {/* Priority cycle */}
        <button
          type="button"
          title={`Priority: ${currentPriority.label}`}
          onClick={() => {
            const order: Array<typeof task.priority> = ["none","low","medium","high"];
            const next = order[(order.indexOf(task.priority) + 1) % order.length]!;
            void updateTask(task.id, { priority: next });
          }}
          className="relative flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
          style={task.priority !== "none" ? { color: currentPriority.color } : { color: "var(--fg-faint)" }}
        >
          <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ flexShrink: 0 }}>
            <line x1="1.5" y1="1" x2="1.5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M1.5 1.5H8.5L6.5 5L8.5 8.5H1.5V1.5Z" fill="currentColor" opacity=".85"/>
          </svg>
        </button>

        <ToolBtn active={panel === "more"} onClick={() => togglePanel("more")} title="Repeat, tags, project">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
            <circle cx="4"  cy="8" r="1.3" fill="currentColor"/>
            <circle cx="8"  cy="8" r="1.3" fill="currentColor"/>
            <circle cx="12" cy="8" r="1.3" fill="currentColor"/>
          </svg>
        </ToolBtn>

        <div className="flex-1" />

        <button
          onClick={async () => { if (confirm("Delete this task?")) { await deleteTask(task.id); onClose(); } }}
          title="Delete task"
          className="flex items-center justify-center rounded-lg p-2 transition-all duration-150 ease-out hover:bg-red-500/10 hover:text-red-400"
          style={{ color: "var(--fg-faint)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
            <path d="M2.5 4.5h11M6 4.5V3h4v1.5M5.5 4.5l.5 9h4l.5-9" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="7" y1="7.5" x2="7" y2="11" strokeLinecap="round"/>
            <line x1="9" y1="7.5" x2="9" y2="11" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  active, onClick, title, children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="relative flex items-center gap-0.5 rounded-lg px-2 py-2 text-sm transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
      style={active
        ? { background: "var(--bg-active)", color: "var(--accent)" }
        : { color: "var(--fg-faint)" }
      }
    >
      {children}
    </button>
  );
}

function TagAdder({ task, updateTask }: {
  task: Task;
  updateTask: (id: string, c: Partial<Task>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState("");

  const commit = () => {
    const tag = draft.trim().replace(/^#/, "");
    if (tag && !task.tags.includes(tag)) void updateTask(task.id, { tags: [...task.tags, tag] });
    setDraft(""); setAdding(false);
  };

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-xs transition-all duration-150 ease-out hover:opacity-80"
        style={{ border: "1px solid var(--border-mid)", color: "var(--fg-faint)" }}
      >+</button>
    );
  }
  return (
    <input
      autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setDraft(""); setAdding(false); }
      }}
      className="w-20 rounded-full bg-transparent px-2 py-0.5 text-[11px] outline-none"
      style={{ border: "1px solid var(--border-mid)", color: "var(--fg)" }}
      placeholder="tag…"
    />
  );
}
