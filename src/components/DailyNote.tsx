"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { JSONContent } from "@tiptap/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { db } from "@/db/index";
import { XChecklistExtension } from "@/lib/xChecklistExtension";
import { useDailyNoteStore } from "@/store/dailyNoteStore";
import { useTaskStore } from "@/store/taskStore";
import type { DailyNote, Task } from "@/types/index";

function dateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateOnly(date: string): Date {
  // Interpret YYYY-MM-DD in local time to avoid timezone shifts.
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
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

type TaskCheckState = Map<string, boolean>;

function extractTaskItemChecks(json: unknown): TaskCheckState {
  const map: TaskCheckState = new Map();

  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;

    if (node.type === "taskItem") {
      const checked = Boolean(node.attrs?.checked);
      const text = extractText(node);
      const title = text.trim();
      if (title) map.set(title, checked);
    }

    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) walk(child);
    }
  };

  const extractText = (node: any): string => {
    if (!node || typeof node !== "object") return "";
    if (node.type === "text" && typeof node.text === "string") return node.text;
    const content = node.content;
    if (!Array.isArray(content)) return "";
    return content.map(extractText).join("");
  };

  walk(json);
  return map;
}

async function ensureDailyNote(date: string): Promise<DailyNote> {
  const existing = await db.dailyNotes.where("date").equals(date).first();
  if (existing) return existing;

  const note: DailyNote = {
    id: crypto.randomUUID(),
    date,
    content: JSON.stringify({ type: "doc", content: [] }),
    linkedTaskIds: [],
  };
  await db.dailyNotes.put(note);
  return note;
}

export function DailyNote() {
  const dailyNotes = useDailyNoteStore((s) => s.dailyNotes);
  const loadDailyNotes = useDailyNoteStore((s) => s.loadDailyNotes);
  const getTodayNote = useDailyNoteStore((s) => s.getTodayNote);
  const updateNoteContent = useDailyNoteStore((s) => s.updateNoteContent);

  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);

  const today = useMemo(() => dateOnlyString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [note, setNote] = useState<DailyNote | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const lastChecksRef = useRef<TaskCheckState>(new Map());

  useEffect(() => {
    void (async () => {
      const n = await getTodayNote();
      setSelectedDate(n.date);
      setNote(n);
      await loadDailyNotes();
    })();
  }, [getTodayNote, loadDailyNotes]);

  useEffect(() => {
    const inState = dailyNotes.find((n) => n.date === selectedDate);
    if (!inState) return;
    setNote(inState);
  }, [dailyNotes, selectedDate]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        XChecklistExtension,
      ],
      immediatelyRender: false,
      content: note?.content ? safeParseJson(note.content) ?? undefined : undefined,
      editorProps: {
        attributes: {
          class:
            "min-h-[240px] outline-none leading-7 text-zinc-100 [&_ul]:ml-6 [&_ol]:ml-6",
        },
      },
      onUpdate: ({ editor }) => {
        if (!note) return;

        const json = editor.getJSON();
        const content = JSON.stringify(json);

        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          void updateNoteContent(note.id, content);
        }, 500);

        const checks = extractTaskItemChecks(json);
        const prev = lastChecksRef.current;
        lastChecksRef.current = checks;

        for (const [title, checked] of checks.entries()) {
          const prevChecked = prev.get(title);
          if (prevChecked === undefined || prevChecked === checked) continue;
          const match = tasks.find((t) => t.title.trim() === title);
          if (!match) continue;
          void updateTask(match.id, { status: checked ? "done" : "todo" });
        }
      },
    },
    [note?.id],
  );

  useEffect(() => {
    if (!editor || !note) return;
    const nextJson = note.content ? safeParseJson(note.content) : null;
    if (nextJson) editor.commands.setContent(nextJson, { emitUpdate: false });
    lastChecksRef.current = extractTaskItemChecks(editor.getJSON());
  }, [editor, note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const goToDate = async (date: string) => {
    setSelectedDate(date);
    const existing = dailyNotes.find((n) => n.date === date);
    if (existing) {
      setNote(existing);
      return;
    }
    const createdOrFound = await ensureDailyNote(date);
    await loadDailyNotes();
    setNote(createdOrFound);
  };

  if (!note) {
    return (
      <div className="flex h-full w-full items-center justify-center py-16 text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => void goToDate(addDays(selectedDate, -1))}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
          aria-label="Previous day"
        >
          ←
        </button>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          {formatHeading(selectedDate)}
        </h1>

        <button
          type="button"
          onClick={() => void goToDate(addDays(selectedDate, 1))}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
          aria-label="Next day"
        >
          →
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900/30 p-4">
        {editor ? <EditorContent editor={editor} /> : null}
      </div>
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

