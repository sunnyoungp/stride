"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types/index";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function parseQuickAddInput(input: string): Pick<Task, "title" | "tags" | "dueDate"> {
  const tags: string[] = [];
  const tagMatches = input.matchAll(/#([a-zA-Z0-9_-]+)/g);
  for (const match of tagMatches) {
    const tag = match[1]?.trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }

  const lower = input.toLowerCase();
  const dueDate = /\b(@?tomorrow)\b/i.test(lower)
    ? tomorrowDateString()
    : /\b(@?today)\b/i.test(lower)
      ? todayDateString()
      : undefined;

  const title = input
    .replace(/#([a-zA-Z0-9_-]+)/g, "")
    .replace(/\b@?(today|tomorrow)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { title, tags, dueDate };
}

export function QuickAdd() {
  const createTask = useTaskStore((s) => s.createTask);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hintText = useMemo(() => "Press Enter to create task", []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen(true);
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
          await createTask(parsed);
          setValue("");
          setOpen(false);
        })();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createTask, open, value]);

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
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={() => setOpen(false)}
      />

      <div className="relative mx-auto mt-24 w-full max-w-xl px-4">
        <div className="rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
          <div className="border-b border-white/10 px-4 py-3">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Add a task…"
              className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>
          <div className="px-4 py-3 text-xs text-zinc-500">{hintText}</div>
        </div>
      </div>
    </div>
  );
}

