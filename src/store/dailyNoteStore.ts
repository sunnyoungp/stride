"use client";

import { create } from "zustand";

import { db } from "@/db/index";
import type { DailyNote } from "@/types/index";

type DailyNoteStore = {
  dailyNotes: DailyNote[];
  loadDailyNotes: () => Promise<void>;
  getTodayNote: () => Promise<DailyNote>;
  updateNoteContent: (id: string, content: string) => Promise<void>;
};

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useDailyNoteStore = create<DailyNoteStore>((set, get) => {
  const loadDailyNotes: DailyNoteStore["loadDailyNotes"] = async () => {
    const dailyNotes = await db.dailyNotes.toArray();
    set({ dailyNotes });
  };

  const getTodayNote: DailyNoteStore["getTodayNote"] = async () => {
    const today = todayDateString();

    const existingInState = get().dailyNotes.find((n) => n.date === today);
    if (existingInState) return existingInState;

    const existingInDb = await db.dailyNotes.where("date").equals(today).first();
    if (existingInDb) {
      set({ dailyNotes: [...get().dailyNotes, existingInDb] });
      return existingInDb;
    }

    const note: DailyNote = {
      id: crypto.randomUUID(),
      date: today,
      content: JSON.stringify({ type: "doc", content: [] }),
      linkedTaskIds: [],
    };

    await db.dailyNotes.put(note);
    set({ dailyNotes: [...get().dailyNotes, note] });
    return note;
  };

  const updateNoteContent: DailyNoteStore["updateNoteContent"] = async (
    id,
    content,
  ) => {
    await db.dailyNotes.update(id, { content });
    set({
      dailyNotes: get().dailyNotes.map((n) => (n.id === id ? { ...n, content } : n)),
    });
  };

  return {
    dailyNotes: [],
    loadDailyNotes,
    getTodayNote,
    updateNoteContent,
  };
});

