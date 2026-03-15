"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTaskStore } from "@/store/taskStore";
import { useSectionStore } from "@/store/sectionStore";
import type { Task } from "@/types/index";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function parseQuickAddInput(input: string): Pick<Task, "title" | "tags" | "dueDate" | "sectionId"> {
  const tags: string[] = [];
  const tagMatches = input.matchAll(/#([a-zA-Z0-9_-]+)/g);
  for (const match of tagMatches) {
    const tag = match[1]?.trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }

  // Fix: use a character class [@ ] or just strip @ separately so word boundaries work
  const lower = input.toLowerCase();
  const dueDate = /(?:^|\s)@?tomorrow(?:\s|$)/i.test(lower)
    ? tomorrowDateString()
    : /(?:^|\s)@?today(?:\s|$)/i.test(lower)
      ? todayDateString()
      : undefined;

  // Strip tags, @today, @tomorrow, standalone "today"/"tomorrow" (with or without @)
  const title = input
    .replace(/#([a-zA-Z0-9_-]+)/g, "")
    .replace(/@?tomorrow/gi, "")
    .replace(/@?today/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { title, tags, dueDate, sectionId: undefined };
}

export function QuickAdd() {
  const createTask = useTaskStore((s) => s.createTask);
  const sections = useSectionStore((s) => s.sections);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Preview what's being parsed
  const preview = useMemo(() => {
    if (!value.trim()) return null;
    return parseQuickAddInput(value);
  }, [value]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const parsed = parseQuickAddInput(value);
        if (!parsed.title) return;
        void (async () => {
          await createTask({
            ...parsed,
            sectionId: selectedSectionId || undefined,
            dueDate: parsed.dueDate,
          });
          setValue("");
          setSelectedSectionId("");
          setOpen(false);
        })();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createTask, open, value, selectedSectionId]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close quick add"
        className="absolute inset-0 cursor-default bg-black/60"
        onClick={() => setOpen(false)}
      />

      <div className="relative mx-auto mt-[15vh] w-full max-w-xl px-4">
        <div className="rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60 overflow-hidden">
          {/* Input row */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8">
            <span className="text-zinc-500 text-lg flex-none">+</span>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Add a task… (use @today, @tomorrow, #tag)"
              className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
          </div>

          {/* Section selector + preview row */}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-zinc-600">Section:</span>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="bg-transparent text-xs text-zinc-400 outline-none cursor-pointer hover:text-zinc-200 transition-colors"
              >
                <option value="">None</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Parsed preview chips */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {preview?.dueDate && (
                <span className="rounded-full bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 text-[11px] text-blue-300 font-medium">
                  📅 {preview.dueDate === todayDateString() ? "Today" : "Tomorrow"}
                </span>
              )}
              {preview?.tags?.map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 bg-zinc-950/40 flex items-center justify-between">
            <span className="text-[11px] text-zinc-600">
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 mr-1">↵ Enter</kbd>
              to create
              <span className="mx-2 text-zinc-700">·</span>
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 mr-1">Esc</kbd>
              to cancel
            </span>
            {preview?.title && (
              <span className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                "{preview.title}"
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
