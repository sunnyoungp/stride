"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTaskStore } from "@/store/taskStore";
import { useSectionStore } from "@/store/sectionStore";
import type { Task } from "@/types/index";

function todayStr()    { return new Date().toISOString().slice(0, 10); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }

function parse(input: string): Pick<Task, "title" | "tags" | "dueDate"> {
  const tags: string[] = [];
  for (const m of input.matchAll(/#([a-zA-Z0-9_-]+)/g)) {
    const t = m[1]?.trim();
    if (t && !tags.includes(t)) tags.push(t);
  }

  // FIX: don't use \b — @ is not a word char so boundary doesn't fire before @today
  const lower = input.toLowerCase();
  const dueDate = /@?tomorrow\b/i.test(lower) ? tomorrowStr()
    : /@?today\b/i.test(lower) ? todayStr()
    : undefined;

  const title = input
    .replace(/#[a-zA-Z0-9_-]+/g, "")
    .replace(/@?tomorrow\b/gi, "")
    .replace(/@?today\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { title, tags, dueDate };
}

export function QuickAdd() {
  const createTask = useTaskStore((s) => s.createTask);
  const sections   = useSectionStore((s) => s.sections);

  const [open, setOpen]         = useState(false);
  const [value, setValue]       = useState("");
  const [sectionId, setSectionId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (value.trim() ? parse(value) : null), [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen((v) => !v); return;
      }
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const p = parse(value);
        if (!p.title) return;
        void createTask({ ...p, sectionId: sectionId || undefined }).then(() => {
          setValue(""); setSectionId(""); setOpen(false);
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createTask, open, value, sectionId]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => { inputRef.current?.focus(); }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/[0.08] bg-[#18181b] shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden">

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-4">
          <svg className="w-4 h-4 text-zinc-600 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <input ref={inputRef} value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a task… (@today, @tomorrow, #tag)"
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-700"
          />
        </div>

        {/* Options row */}
        <div className="flex items-center gap-3 px-4 pb-3 border-t border-white/[0.05] pt-3">
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}
            className="bg-zinc-900 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 outline-none cursor-pointer hover:border-white/15 transition-colors"
          >
            <option value="">No section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.icon} {s.title}</option>
            ))}
          </select>

          {/* Live preview chips */}
          <div className="flex items-center gap-1.5 flex-1">
            {preview?.dueDate && (
              <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400">
                📅 {preview.dueDate === todayStr() ? "Today" : "Tomorrow"}
              </span>
            )}
            {preview?.tags?.map((t) => (
              <span key={t} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500">#{t}</span>
            ))}
          </div>

          <kbd className="text-[10px] text-zinc-700 rounded bg-zinc-800 px-1.5 py-0.5">↵</kbd>
        </div>
      </div>
    </div>
  );
}
