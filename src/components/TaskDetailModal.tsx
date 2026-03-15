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

const PRIORITIES: { value: TaskPriority; label: string; color: string; icon: string }[] = [
  { value: "none", label: "None", color: "text-zinc-500", icon: "○" },
  { value: "low", label: "Low", color: "text-blue-400", icon: "⚑" },
  { value: "medium", label: "Medium", color: "text-yellow-400", icon: "⚑" },
  { value: "high", label: "High", color: "text-red-400", icon: "⚑" },
];

function dateOnly(v: string) {
  return v.includes("T") ? v.slice(0, 10) : v;
}

function formatDateLabel(d: string): string {
  const date = new Date(d + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

type Panel = "none" | "date" | "section" | "priority" | "repeat" | "subtasks" | "more";

export function TaskDetailModal({ task, position, onClose }: Props) {
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const createTask = useTaskStore((s) => s.createTask);

  const sections = useSectionStore((s) => s.sections);
  const subsections = useSectionStore((s) => s.subsections);
  const projects = useProjectStore((s) => s.projects);

  const modalRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [clampedPos, setClampedPos] = useState(position);

  const [titleDraft, setTitleDraft] = useState(task.title);
  const [notesDraft, setNotesDraft] = useState(task.notes ?? "");
  const [openPanel, setOpenPanel] = useState<Panel>("none");
  const [newSubtask, setNewSubtask] = useState("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubTitle, setEditingSubTitle] = useState("");

  const subtasks = useMemo(() => tasks.filter((t) => t.parentTaskId === task.id), [tasks, task.id]);
  const sectionSubsections = useMemo(
    () => subsections.filter((s) => s.sectionId === task.sectionId),
    [subsections, task.sectionId],
  );
  const currentSection = sections.find((s) => s.id === task.sectionId);
  const isDone = task.status === "done";

  // Clamp modal to viewport
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setClampedPos({
      x: clamp(position.x, pad, vw - rect.width - pad),
      y: clamp(position.y, pad, vh - rect.height - pad),
    });
  }, [position]);

  // Close on Escape or outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: PointerEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        // Save drafts before closing
        void updateTask(task.id, { title: titleDraft.trim() || task.title, notes: notesDraft });
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [onClose, titleDraft, notesDraft, task.id, task.title, updateTask]);

  const togglePanel = (p: Panel) => setOpenPanel((v) => (v === p ? "none" : p));

  const addSubtask = async () => {
    const title = newSubtask.trim();
    if (!title) return;
    const sub = await createTask({ title, parentTaskId: task.id, status: "todo" });
    await updateTask(task.id, { subtaskIds: [...(task.subtaskIds ?? []), sub.id] });
    setNewSubtask("");
  };

  const priorityInfo = PRIORITIES.find((p) => p.value === task.priority) ?? PRIORITIES[0]!;

  // Bottom toolbar icon button
  const ToolbarBtn = ({
    label, active, onClick, children,
  }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      title={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex items-center justify-center rounded-lg p-2 text-base transition-colors ${active ? "bg-white/10 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        }`}
    >
      {children}
    </button>
  );

  return (
    <div
      ref={modalRef}
      style={{ left: clampedPos.x, top: clampedPos.y }}
      className="fixed z-50 flex w-[420px] flex-col rounded-2xl border border-white/10 bg-[#1c1c1e] shadow-2xl shadow-black/70 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Top bar: section + date + close ── */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
        {/* Section pill */}
        <button
          onClick={() => togglePanel("section")}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 transition-colors"
        >
          <span>{currentSection?.icon ?? "□"}</span>
          <span>{currentSection?.title ?? "No section"}</span>
        </button>

        <span className="text-zinc-700">·</span>

        {/* Due date pill */}
        <button
          onClick={() => togglePanel("date")}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-white/5 ${task.dueDate
              ? formatDateLabel(dateOnly(task.dueDate)) === "Yesterday" ||
                new Date(dateOnly(task.dueDate)) < new Date(new Date().toISOString().slice(0, 10))
                ? "text-red-400"
                : "text-blue-400"
              : "text-zinc-500"
            }`}
        >
          <span>📅</span>
          <span>{task.dueDate ? formatDateLabel(dateOnly(task.dueDate)) : "No date"}</span>
        </button>

        <div className="flex-1" />

        {/* Complete toggle */}
        <button
          onClick={() => void updateTask(task.id, { status: isDone ? "todo" : "done" })}
          title={isDone ? "Mark incomplete" : "Mark complete"}
          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${isDone
              ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
              : "border-white/20 text-zinc-600 hover:border-white/30 hover:text-zinc-400"
            }`}
        >
          {isDone ? "✓" : "○"}
        </button>

        {/* Close */}
        <button
          onClick={() => { void updateTask(task.id, { title: titleDraft.trim() || task.title, notes: notesDraft }); onClose(); }}
          className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 hover:bg-white/5 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* ── Inline panels (date / section / etc.) ── */}
      {openPanel === "date" && (
        <div className="border-b border-white/5 px-4 py-3 bg-zinc-900/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Due date</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { label: "Today", val: new Date().toISOString().slice(0, 10) },
              { label: "Tomorrow", val: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })() },
              { label: "Next week", val: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })() },
            ].map(({ label, val }) => (
              <button
                key={label}
                onClick={() => { void updateTask(task.id, { dueDate: val }); togglePanel("date"); }}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${task.dueDate && dateOnly(task.dueDate) === val
                    ? "bg-blue-500/25 text-blue-300 border border-blue-500/30"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
              >
                {label}
              </button>
            ))}
            {task.dueDate && (
              <button
                onClick={() => { void updateTask(task.id, { dueDate: undefined }); togglePanel("date"); }}
                className="rounded-full px-3 py-1 text-xs bg-white/5 text-zinc-500 hover:bg-white/8 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="date"
            value={task.dueDate ? dateOnly(task.dueDate) : ""}
            onChange={(e) => { void updateTask(task.id, { dueDate: e.target.value || undefined }); }}
            className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none"
          />
        </div>
      )}

      {openPanel === "section" && (
        <div className="border-b border-white/5 px-4 py-3 bg-zinc-900/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Section</div>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => { void updateTask(task.id, { sectionId: undefined, subsectionId: undefined }); togglePanel("section"); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${!task.sectionId ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5"}`}
            >
              No section
            </button>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => { void updateTask(task.id, { sectionId: s.id, subsectionId: undefined }); togglePanel("section"); }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${task.sectionId === s.id ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5"}`}
              >
                <span>{s.icon}</span>
                <span>{s.title}</span>
                {task.sectionId === s.id && <span className="ml-auto text-[10px] text-zinc-500">✓</span>}
              </button>
            ))}
          </div>
          {task.sectionId && sectionSubsections.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mt-3 mb-1.5">Subsection</div>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => void updateTask(task.id, { subsectionId: undefined })}
                  className={`rounded-lg px-3 py-1.5 text-sm text-left transition-colors ${!task.subsectionId ? "bg-white/8 text-white" : "text-zinc-400 hover:bg-white/5"}`}
                >
                  None
                </button>
                {sectionSubsections.map((su) => (
                  <button
                    key={su.id}
                    onClick={() => void updateTask(task.id, { subsectionId: su.id })}
                    className={`rounded-lg px-3 py-1.5 text-sm text-left transition-colors ${task.subsectionId === su.id ? "bg-white/8 text-white" : "text-zinc-400 hover:bg-white/5"}`}
                  >
                    # {su.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {openPanel === "priority" && (
        <div className="border-b border-white/5 px-4 py-3 bg-zinc-900/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Priority</div>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                onClick={() => { void updateTask(task.id, { priority: p.value }); togglePanel("priority"); }}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors border ${task.priority === p.value
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/5 bg-white/[0.03] text-zinc-500 hover:bg-white/8"
                  }`}
              >
                <span className={p.color}>{p.icon}</span>
                <span className="ml-1.5">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {openPanel === "repeat" && (
        <div className="border-b border-white/5 px-4 py-3 bg-zinc-900/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Repeat</div>
          <div className="flex flex-col gap-0.5">
            {[
              { label: "Never", val: "none" },
              { label: "Daily", val: "daily" },
              { label: "Weekly", val: "weekly" },
              { label: "Monthly", val: "monthly" },
              { label: "Yearly", val: "yearly" },
            ].map(({ label, val }) => {
              const active = val === "none" ? !task.recurrence : task.recurrence?.frequency === val;
              return (
                <button
                  key={val}
                  onClick={() => {
                    if (val === "none") void updateTask(task.id, { recurrence: undefined });
                    else void updateTask(task.id, { recurrence: { frequency: val as any, interval: 1 } });
                    togglePanel("repeat");
                  }}
                  className={`rounded-lg px-3 py-2 text-sm text-left transition-colors ${active ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5"}`}
                >
                  {label}
                  {active && <span className="ml-2 text-[10px] text-zinc-500">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {openPanel === "subtasks" && (
        <div className="border-b border-white/5 px-4 py-3 bg-zinc-900/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
            Subtasks {subtasks.length > 0 ? `(${subtasks.length})` : ""}
          </div>
          <div className="flex flex-col gap-1 mb-2">
            {subtasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => void updateTask(st.id, { status: st.status === "done" ? "todo" : "done" })}
                  className={`h-4 w-4 flex-none rounded border transition-colors ${st.status === "done"
                      ? "border-emerald-500/50 bg-emerald-500/20"
                      : "border-zinc-700 hover:border-zinc-500"
                    }`}
                >
                  {st.status === "done" && <div className="h-2 w-2 m-auto bg-emerald-400/70 rounded-[1px]" />}
                </button>
                {editingSubId === st.id ? (
                  <input
                    autoFocus
                    value={editingSubTitle}
                    onChange={(e) => setEditingSubTitle(e.target.value)}
                    onBlur={() => {
                      if (editingSubTitle.trim()) void updateTask(st.id, { title: editingSubTitle.trim() });
                      setEditingSubId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editingSubTitle.trim()) void updateTask(st.id, { title: editingSubTitle.trim() });
                        setEditingSubId(null);
                      }
                      if (e.key === "Escape") setEditingSubId(null);
                    }}
                    className="flex-1 bg-transparent text-sm text-zinc-200 outline-none border-b border-white/15"
                  />
                ) : (
                  <span
                    onClick={() => { setEditingSubId(st.id); setEditingSubTitle(st.title); }}
                    className={`flex-1 cursor-text text-sm ${st.status === "done" ? "line-through text-zinc-600" : "text-zinc-300"}`}
                  >
                    {st.title || "subtask"}
                  </span>
                )}
                <button
                  onClick={() => void useTaskStore.getState().deleteTask(st.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {/* FIX: subtask input is a plain controlled input — no stopPropagation issues */}
          <div className="flex items-center gap-2">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation(); // prevent modal close on Enter/Escape
                if (e.key === "Enter") void addSubtask();
                if (e.key === "Escape") { setNewSubtask(""); togglePanel("subtasks"); }
              }}
              placeholder="Add subtask…"
              className="flex-1 rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
            <button
              onClick={() => void addSubtask()}
              disabled={!newSubtask.trim()}
              className="rounded-lg bg-white/8 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/12 disabled:opacity-30 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {openPanel === "more" && (
        <div className="border-b border-white/5 px-4 py-3 bg-zinc-900/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">More</div>

          {/* Project */}
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-700 mb-1.5">Project</div>
            <select
              value={task.projectId || ""}
              onChange={(e) => void updateTask(task.id, { projectId: e.target.value || undefined })}
              className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 outline-none"
            >
              <option value="">No Project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-700 mb-1.5">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400 group">
                  #{tag}
                  <button
                    onClick={() => void updateTask(task.id, { tags: task.tags.filter((t) => t !== tag) })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-200"
                  >✕</button>
                </span>
              ))}
              <TagAdder task={task} updateTask={updateTask} />
            </div>
          </div>

          {/* Source doc */}
          {task.sourceDocumentId && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-700 mb-1.5">Source</div>
              <Link
                href={`/documents/${task.sourceDocumentId}`}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                📄 {task.sourceDocumentTitle || "Untitled"}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Title ── */}
      <div className="px-4 pt-4 pb-2">
        <textarea
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => void updateTask(task.id, { title: titleDraft.trim() || task.title })}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); notesRef.current?.focus(); }
          }}
          rows={1}
          className={`w-full resize-none bg-transparent text-lg font-semibold leading-snug outline-none ${isDone ? "line-through text-zinc-500" : "text-zinc-100"
            }`}
          style={{ fieldSizing: "content" } as any}
          placeholder="Task title"
        />
      </div>

      {/* ── Notes — always open, ready to type ── */}
      <div className="px-4 pb-4 flex-1">
        <textarea
          ref={notesRef}
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => void updateTask(task.id, { notes: notesDraft })}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Notes"
          rows={3}
          className="w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700"
          style={{ minHeight: "60px", fieldSizing: "content" } as any}
        />
      </div>

      {/* ── Bottom toolbar ── */}
      <div className="flex items-center gap-0.5 border-t border-white/5 px-3 py-2">
        <ToolbarBtn label="Due date" active={!!task.dueDate} onClick={() => togglePanel("date")}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </ToolbarBtn>

        <ToolbarBtn label="Section" active={!!task.sectionId} onClick={() => togglePanel("section")}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        </ToolbarBtn>

        <ToolbarBtn label="Priority" active={task.priority !== "none"} onClick={() => togglePanel("priority")}>
          <span className={`text-sm font-bold leading-none ${task.priority === "high" ? "text-red-400" :
              task.priority === "medium" ? "text-yellow-400" :
                task.priority === "low" ? "text-blue-400" : ""
            }`}>⚑</span>
        </ToolbarBtn>

        <ToolbarBtn label="Repeat" active={!!task.recurrence} onClick={() => togglePanel("repeat")}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
        </ToolbarBtn>

        <ToolbarBtn
          label={`Subtasks${subtasks.length > 0 ? ` (${subtasks.length})` : ""}`}
          active={openPanel === "subtasks"}
          onClick={() => togglePanel("subtasks")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          {subtasks.length > 0 && (
            <span className="ml-1 text-[10px] tabular-nums text-zinc-500">{subtasks.length}</span>
          )}
        </ToolbarBtn>

        <ToolbarBtn label="More" active={openPanel === "more"} onClick={() => togglePanel("more")}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
          </svg>
        </ToolbarBtn>

        <div className="flex-1" />

        {/* Delete */}
        <button
          onClick={async () => {
            if (confirm("Delete this task?")) {
              await deleteTask(task.id);
              onClose();
            }
          }}
          title="Delete task"
          className="flex items-center justify-center rounded-lg p-2 text-zinc-700 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Separate small component to avoid hooks-in-loop issues
function TagAdder({ task, updateTask }: { task: Task; updateTask: (id: string, c: Partial<Task>) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = draft.trim().replace(/^#/, "");
    if (tag && !task.tags.includes(tag)) void updateTask(task.id, { tags: [...task.tags, tag] });
    setDraft("");
    setAdding(false);
  };

  if (adding) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setAdding(false); }}
        className="w-20 rounded-full border border-white/10 bg-transparent px-2 py-0.5 text-xs text-zinc-200 outline-none"
        placeholder="tag…"
      />
    );
  }
  return (
    <button
      onClick={() => setAdding(true)}
      className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-600 hover:border-white/20 hover:text-zinc-300 transition-colors"
    >+</button>
  );
}