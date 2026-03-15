"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function dateOnly(v: string) {
  return v.includes("T") ? v.slice(0, 10) : v;
}

function friendlyDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function isOverdue(d: string): boolean {
  return new Date(d + "T00:00:00") < new Date(new Date().toDateString());
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  none:   { label: "Priority", dot: "bg-zinc-700", text: "text-zinc-500" },
  low:    { label: "Low",      dot: "bg-blue-500",   text: "text-blue-400" },
  medium: { label: "Medium",   dot: "bg-amber-500",  text: "text-amber-400" },
  high:   { label: "High",     dot: "bg-red-500",    text: "text-red-400" },
};

const PRIORITY_CYCLE: TaskPriority[] = ["none", "low", "medium", "high"];

type Drawer = "none" | "date" | "section" | "subtasks" | "more";

export function TaskDetailModal({ task, position, onClose }: Props) {
  const tasks      = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const createTask = useTaskStore((s) => s.createTask);

  // FIX: use reactive hooks, never getState() in render
  const sections    = useSectionStore((s) => s.sections);
  const subsections = useSectionStore((s) => s.subsections);
  const projects    = useProjectStore((s) => s.projects);

  const modalRef   = useRef<HTMLDivElement>(null);
  const titleRef   = useRef<HTMLTextAreaElement>(null);
  const notesRef   = useRef<HTMLTextAreaElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);

  const [pos, setPos]             = useState(position);
  const [titleDraft, setTitle]    = useState(task.title);
  const [notesDraft, setNotes]    = useState(task.notes ?? "");
  const [drawer, setDrawer]       = useState<Drawer>("none");
  const [newSubtask, setNewSub]   = useState("");
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editSubVal, setEditSubVal] = useState("");

  const isDone = task.status === "done";
  const subtasks = useMemo(() => tasks.filter((t) => t.parentTaskId === task.id), [tasks, task.id]);
  const sectionSubsections = useMemo(
    () => subsections.filter((s) => s.sectionId === task.sectionId),
    [subsections, task.sectionId]
  );
  const currentSection = sections.find((s) => s.id === task.sectionId);
  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;

  // Clamp to viewport after first paint
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 16;
    const vw = window.innerWidth, vh = window.innerHeight;
    setPos({
      x: clamp(position.x, pad, vw - r.width - pad),
      y: clamp(position.y, pad, vh - r.height - pad),
    });
  }, [position]);

  // Escape closes; outside click saves + closes
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
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onOut); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleDraft, notesDraft]);

  const save = () => {
    const t = titleDraft.trim();
    if (t !== task.title) void updateTask(task.id, { title: t || task.title });
    if (notesDraft !== task.notes) void updateTask(task.id, { notes: notesDraft });
  };

  const toggleDrawer = (d: Drawer) => setDrawer((v) => v === d ? "none" : d);

  const cyclePriority = () => {
    const idx = PRIORITY_CYCLE.indexOf(task.priority);
    void updateTask(task.id, { priority: PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length] ?? "none" });
  };

  const addSubtask = async () => {
    const title = newSubtask.trim();
    if (!title) return;
    const sub = await createTask({ title, parentTaskId: task.id, status: "todo" });
    await updateTask(task.id, { subtaskIds: [...(task.subtaskIds ?? []), sub.id] });
    setNewSub("");
    subtaskRef.current?.focus();
  };

  // Date quick-pick helpers
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
  const nextWeekStr = (() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,10); })();

  return (
    <div
      ref={modalRef}
      style={{ left: pos.x, top: pos.y, width: 400 }}
      className="fixed z-50 flex flex-col rounded-2xl border border-white/[0.08] bg-[#18181b] shadow-[0_24px_80px_rgba(0,0,0,0.7)] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── Top chrome: section · date · complete · close ─── */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-0">
        <button
          onClick={() => toggleDrawer("section")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-white/5 ${
            currentSection ? "text-zinc-300" : "text-zinc-600"
          }`}
        >
          <span>{currentSection?.icon ?? "·"}</span>
          <span>{currentSection?.title ?? "No section"}</span>
        </button>

        <span className="text-zinc-700 text-xs">·</span>

        <button
          onClick={() => toggleDrawer("date")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-white/5 ${
            task.dueDate
              ? isOverdue(dateOnly(task.dueDate))
                ? "text-red-400"
                : "text-blue-400"
              : "text-zinc-600"
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>{task.dueDate ? friendlyDate(dateOnly(task.dueDate)) : "No date"}</span>
        </button>

        <button
          onClick={cyclePriority}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-white/5 ${pc.text}`}
          title="Click to cycle priority"
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${pc.dot}`} />
          <span>{pc.label}</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => void updateTask(task.id, { status: isDone ? "todo" : "done" })}
          title={isDone ? "Mark incomplete" : "Mark complete"}
          className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border text-[10px] transition-all ${
            isDone
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
              : "border-white/15 text-zinc-600 hover:border-white/25 hover:text-zinc-400"
          }`}
        >
          {isDone ? "✓" : ""}
        </button>

        <button
          onClick={() => { save(); onClose(); }}
          className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ─── Inline drawers ─── */}
      {drawer === "date" && (
        <div className="mx-3 mt-2 rounded-xl border border-white/8 bg-zinc-900 p-3">
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {[
              { label: "Today", val: todayStr },
              { label: "Tomorrow", val: tomorrowStr },
              { label: "Next week", val: nextWeekStr },
            ].map(({ label, val }) => (
              <button key={label}
                onClick={() => { void updateTask(task.id, { dueDate: val }); setDrawer("none"); }}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  task.dueDate && dateOnly(task.dueDate) === val
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/25"
                    : "bg-white/5 text-zinc-300 hover:bg-white/8"
                }`}
              >{label}</button>
            ))}
            {task.dueDate && (
              <button
                onClick={() => { void updateTask(task.id, { dueDate: undefined }); setDrawer("none"); }}
                className="rounded-lg px-3 py-1.5 text-xs bg-white/[0.03] text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
              >Clear</button>
            )}
          </div>
          <input type="date"
            value={task.dueDate ? dateOnly(task.dueDate) : ""}
            onChange={(e) => void updateTask(task.id, { dueDate: e.target.value || undefined })}
            className="w-full rounded-lg border border-white/8 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 outline-none"
          />
        </div>
      )}

      {drawer === "section" && (
        <div className="mx-3 mt-2 rounded-xl border border-white/8 bg-zinc-900 p-2">
          <button
            onClick={() => { void updateTask(task.id, { sectionId: undefined, subsectionId: undefined }); setDrawer("none"); }}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${!task.sectionId ? "bg-white/8 text-zinc-100" : "text-zinc-400 hover:bg-white/5"}`}
          >No section</button>
          {sections.map((s) => (
            <button key={s.id}
              onClick={() => { void updateTask(task.id, { sectionId: s.id, subsectionId: undefined }); setDrawer("none"); }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${task.sectionId === s.id ? "bg-white/8 text-zinc-100" : "text-zinc-400 hover:bg-white/5"}`}
            >
              <span>{s.icon}</span><span>{s.title}</span>
              {task.sectionId === s.id && <span className="ml-auto text-emerald-500 text-xs">✓</span>}
            </button>
          ))}
          {task.sectionId && sectionSubsections.length > 0 && (
            <>
              <div className="mx-2 my-1.5 h-px bg-white/5" />
              <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-zinc-600">Subsection</div>
              <button
                onClick={() => void updateTask(task.id, { subsectionId: undefined })}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${!task.subsectionId ? "bg-white/8 text-zinc-200" : "text-zinc-500 hover:bg-white/5"}`}
              >None</button>
              {sectionSubsections.map((su) => (
                <button key={su.id}
                  onClick={() => void updateTask(task.id, { subsectionId: su.id })}
                  className={`w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${task.subsectionId === su.id ? "bg-white/8 text-zinc-200" : "text-zinc-500 hover:bg-white/5"}`}
                ># {su.title}</button>
              ))}
            </>
          )}
        </div>
      )}

      {drawer === "subtasks" && (
        <div className="mx-3 mt-2 rounded-xl border border-white/8 bg-zinc-900 p-3">
          {subtasks.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => void updateTask(st.id, { status: st.status === "done" ? "todo" : "done" })}
                    className={`h-4 w-4 flex-none rounded border transition-colors ${
                      st.status === "done" ? "border-emerald-600/50 bg-emerald-600/20" : "border-zinc-700 hover:border-zinc-500"
                    }`}
                  >
                    {st.status === "done" && <div className="h-2 w-2 m-auto bg-emerald-400/70 rounded-[1px]" />}
                  </button>
                  {editSubId === st.id ? (
                    <input autoFocus value={editSubVal}
                      onChange={(e) => setEditSubVal(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") { if (editSubVal.trim()) void updateTask(st.id, { title: editSubVal.trim() }); setEditSubId(null); }
                        if (e.key === "Escape") setEditSubId(null);
                      }}
                      onBlur={() => { if (editSubVal.trim()) void updateTask(st.id, { title: editSubVal.trim() }); setEditSubId(null); }}
                      className="flex-1 border-b border-white/15 bg-transparent text-sm text-zinc-200 outline-none"
                    />
                  ) : (
                    <span onClick={() => { setEditSubId(st.id); setEditSubVal(st.title); }}
                      className={`flex-1 cursor-text text-sm ${st.status === "done" ? "line-through text-zinc-600" : "text-zinc-300"}`}
                    >{st.title || "subtask"}</span>
                  )}
                  <button onClick={() => void deleteTask(st.id)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-zinc-600 hover:text-red-400 transition-all px-1"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
          {/* FIX: stopPropagation on keydown prevents modal closing on Enter/Escape */}
          <div className="flex gap-2">
            <input ref={subtaskRef} value={newSubtask}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") void addSubtask();
                if (e.key === "Escape") { setNewSub(""); }
              }}
              placeholder="Add subtask…"
              className="flex-1 rounded-lg border border-white/8 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-white/15"
            />
            <button onClick={() => void addSubtask()} disabled={!newSubtask.trim()}
              className="rounded-lg bg-white/8 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/12 disabled:opacity-30 transition-colors"
            >Add</button>
          </div>
        </div>
      )}

      {drawer === "more" && (
        <div className="mx-3 mt-2 rounded-xl border border-white/8 bg-zinc-900 p-3 space-y-3">
          {/* Repeat */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Repeat</div>
            <select
              value={task.recurrence?.frequency ?? "none"}
              onChange={(e) => {
                const v = e.target.value;
                void updateTask(task.id, v === "none" ? { recurrence: undefined } : { recurrence: { frequency: v as any, interval: 1 } });
              }}
              className="w-full rounded-lg border border-white/8 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 outline-none"
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
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Project</div>
            <select
              value={task.projectId ?? ""}
              onChange={(e) => void updateTask(task.id, { projectId: e.target.value || undefined })}
              className="w-full rounded-lg border border-white/8 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 outline-none"
            >
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="group inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400">
                  #{tag}
                  <button onClick={() => void updateTask(task.id, { tags: task.tags.filter((t) => t !== tag) })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-200"
                  >✕</button>
                </span>
              ))}
              <TagAdder task={task} updateTask={updateTask} />
            </div>
          </div>

          {/* Source doc */}
          {task.sourceDocumentId && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Source</div>
              <Link href={`/documents/${task.sourceDocumentId}`}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >📄 {task.sourceDocumentTitle || "Untitled"}</Link>
            </div>
          )}
        </div>
      )}

      {/* ─── Title ─── */}
      <div className="px-4 pt-3 pb-1">
        <textarea ref={titleRef} value={titleDraft}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { const t = titleDraft.trim(); if (t !== task.title) void updateTask(task.id, { title: t || task.title }); }}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); notesRef.current?.focus(); } }}
          rows={1}
          placeholder="Task title"
          className={`w-full resize-none bg-transparent text-[15px] font-semibold leading-snug outline-none placeholder:text-zinc-700 ${
            isDone ? "line-through text-zinc-600" : "text-zinc-100"
          }`}
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
      </div>

      {/* ─── Notes — always open ─── */}
      <div className="px-4 pb-3">
        <textarea ref={notesRef} value={notesDraft}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notesDraft !== task.notes) void updateTask(task.id, { notes: notesDraft }); }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Notes"
          rows={3}
          className="w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-500 outline-none placeholder:text-zinc-700 focus:text-zinc-300 transition-colors"
          style={{ minHeight: 56, fieldSizing: "content" } as React.CSSProperties}
        />
      </div>

      {/* ─── Bottom toolbar ─── */}
      <div className="flex items-center border-t border-white/[0.06] px-2 py-1.5">
        {/* Date */}
        <ToolBtn active={drawer === "date" || !!task.dueDate} onClick={() => toggleDrawer("date")} title="Due date">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </ToolBtn>

        {/* Section */}
        <ToolBtn active={drawer === "section" || !!task.sectionId} onClick={() => toggleDrawer("section")} title="Section">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
        </ToolBtn>

        {/* Priority */}
        <ToolBtn active={task.priority !== "none"} onClick={cyclePriority} title={`Priority: ${task.priority}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          {task.priority !== "none" && (
            <span className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${pc.dot}`} />
          )}
        </ToolBtn>

        {/* Subtasks */}
        <ToolBtn active={drawer === "subtasks"} onClick={() => toggleDrawer("subtasks")} title="Subtasks">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>
          </svg>
          {subtasks.length > 0 && (
            <span className="ml-1 text-[10px] tabular-nums text-zinc-600">{subtasks.filter(s=>s.status==="done").length}/{subtasks.length}</span>
          )}
        </ToolBtn>

        {/* More */}
        <ToolBtn active={drawer === "more"} onClick={() => toggleDrawer("more")} title="More options">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/>
          </svg>
        </ToolBtn>

        <div className="flex-1" />

        {/* Delete */}
        <button
          onClick={async () => { if (confirm("Delete this task?")) { await deleteTask(task.id); onClose(); } }}
          title="Delete task"
          className="flex items-center justify-center rounded-lg p-2 text-zinc-700 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`relative flex items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-sm transition-colors ${
        active ? "bg-white/8 text-zinc-200" : "text-zinc-600 hover:bg-white/5 hover:text-zinc-400"
      }`}
    >{children}</button>
  );
}

function TagAdder({ task, updateTask }: { task: Task; updateTask: (id: string, c: Partial<Task>) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const commit = () => {
    const tag = draft.trim().replace(/^#/, "");
    if (tag && !task.tags.includes(tag)) void updateTask(task.id, { tags: [...task.tags, tag] });
    setDraft(""); setAdding(false);
  };
  if (!adding) return (
    <button onClick={() => setAdding(true)}
      className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-600 hover:border-white/20 hover:text-zinc-400 transition-colors"
    >+</button>
  );
  return (
    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setAdding(false); }}
      className="w-20 rounded-full border border-white/10 bg-transparent px-2 py-0.5 text-[11px] text-zinc-300 outline-none"
      placeholder="tag…"
    />
  );
}
