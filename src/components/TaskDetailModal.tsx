"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSectionStore } from "@/store/sectionStore";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import type { Task, TaskPriority } from "@/types/index";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { RescheduleDatePopover } from "@/components/TaskList";
import { appConfirm } from "@/lib/confirm";

type Props = {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
};

type Panel = "none" | "date" | "section" | "more";

const URL_REGEX = /https?:\/\/[^\s]+/g;

function renderWithLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const url = match[0];
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "var(--accent)", textDecoration: "underline", wordBreak: "break-all" }}
      >{url}</a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

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
  const isMobile    = useIsMobile();
  const { height: vpHeight } = useVisualViewport();
  const [windowHeight, setWindowHeight] = useState(0);

  useEffect(() => {
    setWindowHeight(window.innerHeight);
    const update = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const keyboardHeight = Math.max(0, windowHeight - vpHeight);

  const modalRef   = useRef<HTMLDivElement>(null);
  const notesRef   = useRef<HTMLTextAreaElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);
  const dateBtnRef = useRef<HTMLDivElement>(null);
  const [dateBtnAnchor, setDateBtnAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Initial position slightly off-screen or at click, will be clamped by useLayoutEffect
  const [pos, setPos]           = useState({ x: position.x, y: position.y });
  const [titleDraft, setTitle]  = useState(task.title);
  const [notesDraft, setNotes]  = useState(task.notes ?? "");
  const [notesFocused, setNotesFocused] = useState(false);
  const [panel, setPanel]       = useState<Panel>("none");
  const [newSubtask, setNewSub] = useState("");
  const [editSubId, setEditSubId]   = useState<string | null>(null);
  const [editSubVal, setEditSubVal] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { 
    setMounted(true); 
  }, []);

  const isDone   = task.status === "done";
  const subtasks = useMemo(() => tasks.filter((t) => t.parentTaskId === task.id), [tasks, task.id]);
  const sectionSubsections = useMemo(
    () => subsections.filter((s) => s.sectionId === task.sectionId),
    [subsections, task.sectionId],
  );
  const currentSection  = sections.find((s) => s.id === task.sectionId);
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === task.priority) ?? PRIORITY_OPTIONS[0]!;


  useLayoutEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const pad = 12;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return; // Not yet sized

    setPos({
      x: Math.min(Math.max(position.x, pad), vw - width  - pad),
      y: Math.min(Math.max(position.y, pad), vh - height - pad),
    });
  }, [position, panel, mounted]); // re-clamp on mount and panels

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
      // Don't close if clicking on portal elements like the date popover
      if ((e.target as Element).closest?.("[data-selection-bar]")) return;
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
  }, [titleDraft, notesDraft]);

  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? "none" : p));

  const addSubtask = async (title?: string) => {
    const t = (title ?? newSubtask).trim();
    if (!t) return;
    const sub = await createTask({ title: t, parentTaskId: task.id, status: "todo" });
    await updateTask(task.id, { subtaskIds: [...(task.subtaskIds ?? []), sub.id] });
    if (!title) { setNewSub(""); subtaskRef.current?.focus(); }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-[10000] backdrop-fade"
          style={{ background: "rgba(0,0,0,0.28)" }}
          onClick={() => { save(); onClose(); }}
        />
      )}
      <div
        id="task-detail-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-[10001] flex flex-col overflow-hidden"
        style={isMobile ? {
          bottom: keyboardHeight > 0 ? keyboardHeight : 0,
          paddingBottom: keyboardHeight > 0 ? 0 : "calc(32px + env(safe-area-inset-bottom))",
          left: 0,
          right: 0,
          maxHeight: keyboardHeight > 0 ? `calc(100vh - ${keyboardHeight}px - 20px)` : "85vh",
          background: "var(--bg-card)",
          backdropFilter: "var(--glass-blur-card)",
          WebkitBackdropFilter: "var(--glass-blur-card)",
          borderTop: "1px solid var(--glass-border-top)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: "var(--shadow-float)",
          transition: "bottom 200ms ease",
        } : {
          left: pos.x,
          top:  pos.y,
          width: 400,
          background: "var(--bg-card)",
          backdropFilter: "var(--glass-blur-card)",
          WebkitBackdropFilter: "var(--glass-blur-card)",
          border: "1px solid var(--glass-border)",
          borderTop: "1px solid var(--glass-border-top)",
          boxShadow: "var(--shadow-float)",
          maxHeight: "calc(100vh - 24px)",
          borderRadius: 16,
        }}
      >
        {isMobile && (
          <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-mid)" }} />
          </div>
        )}

        <div className="flex-1 overflow-auto p-5 pb-0 custom-scrollbar">
          {/* Header with Title */}
          <div className="flex flex-col gap-4">
            <input
              autoFocus={!isMobile}
              value={titleDraft}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={save}
              className="w-full bg-transparent text-lg font-semibold outline-none"
              style={{ color: "var(--fg)" }}
              placeholder="Task name"
            />
            
            {/* Notes Section */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--fg-faint)" }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor">
                  <path d="M3 4.5h10M3 8h10M3 11.5h6" strokeLinecap="round" strokeWidth={1.5} />
                </svg>
                Notes
              </div>
              <textarea
                ref={notesRef}
                value={notesDraft}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => { setNotesFocused(false); save(); }}
                onFocus={() => setNotesFocused(true)}
                className="w-full bg-transparent text-sm leading-relaxed outline-none"
                style={{ 
                  color: "var(--fg-muted)", 
                  minHeight: notesFocused ? 120 : 60,
                  transition: "min-height 200ms ease"
                }}
                placeholder="Description…"
              />
            </div>

            {/* Subtasks Section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--fg-faint)" }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor">
                  <path d="M4 3h8M4 6h8M4 9h8" strokeLinecap="round" strokeWidth={1.5}/>
                </svg>
                Subtasks
              </div>
              <div className="flex flex-col gap-1">
                {subtasks.map((st) => (
                  <div key={st.id} className="group relative flex items-center gap-2 rounded-md py-1">
                    <button
                      onClick={() => void updateTask(st.id, { status: st.status === "done" ? "todo" : "done" })}
                      className="flex h-4 w-4 items-center justify-center rounded border transition-colors"
                      style={{
                        borderColor: st.status === "done" ? "var(--accent)" : "var(--border-mid)",
                        background: st.status === "done" ? "var(--accent)" : "transparent"
                      }}
                    >
                      {st.status === "done" && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={3}>
                          <path d="M3.5 8l3 3 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    {editSubId === st.id ? (
                      <input
                        autoFocus
                        value={editSubVal}
                        onChange={(e) => setEditSubVal(e.target.value)}
                        onBlur={() => {
                          if (editSubVal.trim()) void updateTask(st.id, { title: editSubVal.trim() });
                          setEditSubId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editSubVal.trim()) void updateTask(st.id, { title: editSubVal.trim() });
                            setEditSubId(null);
                          }
                          if (e.key === "Escape") setEditSubId(null);
                        }}
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                    ) : (
                      <span
                        onClick={() => { setEditSubId(st.id); setEditSubVal(st.title); }}
                        className="flex-1 cursor-text text-sm transition-colors"
                        style={{
                          color: st.status === "done" ? "var(--fg-faint)" : "var(--fg-muted)",
                          textDecoration: st.status === "done" ? "line-through" : "none"
                        }}
                      >
                        {st.title}
                      </span>
                    )}
                    <button
                      onClick={() => void deleteTask(st.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <svg className="w-3.5 h-3.5 text-[var(--error)]" fill="none" viewBox="0 0 16 16" stroke="currentColor">
                        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" strokeWidth={1.5}/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 py-1">
                  <div className="flex h-4 w-4 items-center justify-center text-[var(--fg-faint)]">+</div>
                  <input
                    ref={subtaskRef}
                    value={newSubtask}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); }}
                    className="flex-1 bg-transparent text-sm outline-none"
                    placeholder="Add subtask…"
                    style={{ color: "var(--fg-faint)" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Relative panels --- */}
        <div className="relative">
          {panel === "section" && (
            <div className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-xl border p-1 shadow-lg"
                 style={{ background: "var(--bg-card)", borderColor: "var(--glass-border)", backdropFilter: "var(--glass-blur-card)" }}>
              <div className="max-h-64 overflow-auto py-1 custom-scrollbar">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { void updateTask(task.id, { sectionId: s.id }); togglePanel("none"); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <div className="h-2 w-2 rounded-full" style={{ background: s.color || "var(--neutral)" }} />
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {panel === "more" && (
            <div className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-xl border p-3 shadow-lg"
                 style={{ background: "var(--bg-card)", borderColor: "var(--glass-border)", backdropFilter: "var(--glass-blur-card)" }}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map(t => (
                      <span key={t} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--bg-subtle)", color: "var(--fg-muted)" }}>
                        #{t}
                        <button onClick={() => void updateTask(task.id, { tags: task.tags.filter(x=>x!==t) })} className="hover:text-[var(--error)]">×</button>
                      </span>
                    ))}
                    <TagAdder task={task} updateTask={updateTask} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">Project</div>
                  <div className="flex flex-col gap-0.5">
                    {projects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => void updateTask(task.id, { projectId: p.id })}
                        className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                        style={task.projectId === p.id ? { background: "var(--bg-active)", color: "var(--accent)" } : {}}
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- Toolbar --- */}
        <div className="flex items-center border-t px-3 py-2" style={{ borderColor: "var(--glass-border-top)", gap: "4px" }}>
          
          {/* Section picker */}
          <ToolBtn active={panel === "section"} onClick={() => togglePanel("section")} title="Move to section">
            <div className="h-2 w-2 rounded-full" style={{ background: currentSection?.color || "var(--neutral)" }} />
            <span className="max-w-[80px] truncate text-xs font-medium">{currentSection?.title || "Inbox"}</span>
          </ToolBtn>

          <div style={{ width: 1, height: 16, background: "var(--border-mid)", opacity: 0.5, margin: "0 2px" }} />

          {/* Date picker */}
          <div ref={dateBtnRef}>
            <ToolBtn
              active={dateBtnAnchor !== null}
              onClick={() => {
                if (dateBtnAnchor) { setDateBtnAnchor(null); return; }
                togglePanel("none");
                const r = dateBtnRef.current?.getBoundingClientRect();
                if (r) setDateBtnAnchor({ x: r.left, y: r.top, width: r.width, height: r.height });
              }}
              title="Set due date"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor">
                <rect x="3" y="3.5" width="10" height="10" rx="2" strokeWidth={1.5}/>
                <path d="M3 7h10M5.5 2v2.5M10.5 2v2.5" strokeLinecap="round" strokeWidth={1.5}/>
              </svg>
              <span className="text-xs font-medium" style={{ color: task.dueDate ? "var(--accent)" : "var(--fg-faint)" }}>
                {task.dueDate ? friendlyDate(task.dueDate) : "No date"}
              </span>
            </ToolBtn>
          </div>

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
            onClick={async () => { if (await appConfirm("Delete this task?")) { await deleteTask(task.id); onClose(); } }}
            title="Delete task"
            className="flex items-center justify-center rounded-lg p-2 transition-all duration-150 ease-out hover:bg-[var(--error-bg)] hover:text-[var(--error)]"
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
      {dateBtnAnchor && (
        <RescheduleDatePopover
          anchor={dateBtnAnchor}
          onSelect={(date) => { void updateTask(task.id, { dueDate: date }); setDateBtnAnchor(null); }}
          onClose={() => setDateBtnAnchor(null)}
          currentDate={task.dueDate}
        />
      )}
    </>,
    document.body
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
      className="w-20 rounded-full bg-transparent px-2 py-0.5 outline-none"
      style={{ border: "1px solid var(--border-mid)", color: "var(--fg)", fontSize: "16px" }}
      placeholder="tag…"
    />
  );
}
