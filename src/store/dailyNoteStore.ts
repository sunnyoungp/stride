"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { DailyNote } from "@/types/index";

const supabase = createClient();

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function noteFromRow(row: Record<string, unknown>): DailyNote {
  return {
    id: row.id as string,
    date: row.date as string,
    content: row.content as string,
    linkedTaskIds: (row.linked_task_ids as string[]) ?? [],
  };
}

function noteToRow(n: DailyNote, userId: string) {
  return {
    id: n.id,
    date: n.date,
    content: n.content,
    linked_task_ids: n.linkedTaskIds,
    user_id: userId,
  };
}

// ── Store ──────────────────────────────────────────────────────────────────────

type DailyNoteStore = {
  dailyNotes: DailyNote[];
  isLoading: boolean;
  loadDailyNotes: () => Promise<void>;
  getTodayNote: () => Promise<DailyNote>;
  updateNoteContent: (id: string, content: string) => Promise<void>;
  upsertNote: (date: string, content: string) => Promise<DailyNote>;
};

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const useDailyNoteStore = create<DailyNoteStore>((set, get) => {
  const loadDailyNotes: DailyNoteStore["loadDailyNotes"] = async () => {
    try {
      const { data: rows, error } = await supabase.from("daily_notes").select("*");
      if (error) throw error;
      set({ dailyNotes: (rows ?? []).map(noteFromRow) });
    } catch (error) {
      console.error("Failed to load daily notes:", error);
      set({ dailyNotes: [] });
    } finally {
      set({ isLoading: false });
    }
  };

  const getTodayNote: DailyNoteStore["getTodayNote"] = async () => {
    try {
      const today = todayDateString();

      const existingInState = get().dailyNotes.find((n) => n.date === today);
      if (existingInState) return existingInState;

      const { data: row } = await supabase
        .from("daily_notes")
        .select("*")
        .eq("date", today)
        .maybeSingle();

      if (row) {
        const note = noteFromRow(row);
        set({ dailyNotes: [...get().dailyNotes, note] });
        return note;
      }

      const userId = await getUserId();
      if (!userId) throw new Error("Not authenticated");

      const note: DailyNote = {
        id: crypto.randomUUID(),
        date: today,
        content: JSON.stringify({ type: "doc", content: [] }),
        linkedTaskIds: [],
      };
      const { error } = await supabase.from("daily_notes").insert(noteToRow(note, userId));
      if (error) throw error;
      set({ dailyNotes: [...get().dailyNotes, note] });
      return note;
    } catch (error) {
      console.error("Failed to get today note:", error);
      throw error;
    }
  };

  const updateNoteContent: DailyNoteStore["updateNoteContent"] = async (id, content) => {
    const { error } = await supabase
      .from("daily_notes")
      .update({ content })
      .eq("id", id);
    if (error) console.error("Failed to update note content:", error);
    // Update in local state — only maps existing notes, new notes go through upsertNote
    set({
      dailyNotes: get().dailyNotes.map((n) => (n.id === id ? { ...n, content } : n)),
    });
  };

  const upsertNote: DailyNoteStore["upsertNote"] = async (date, content) => {
    // Check local store first
    const existing = get().dailyNotes.find((n) => n.date === date);
    if (existing) {
      await updateNoteContent(existing.id, content);
      return { ...existing, content };
    }

    // Check Supabase
    const { data: row } = await supabase
      .from("daily_notes")
      .select("*")
      .eq("date", date)
      .maybeSingle();

    if (row) {
      const note = noteFromRow(row);
      const updated = { ...note, content };
      await updateNoteContent(note.id, content);
      // Ensure it's in local state
      set({ dailyNotes: [...get().dailyNotes.filter(n => n.id !== note.id), updated] });
      return updated;
    }

    // Create new note in Supabase
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");
    const note: DailyNote = {
      id: crypto.randomUUID(),
      date,
      content,
      linkedTaskIds: [],
    };
    const { error } = await supabase.from("daily_notes").insert(noteToRow(note, userId));
    if (error) throw error;
    set({ dailyNotes: [...get().dailyNotes, note] });
    return note;
  };

  return {
    dailyNotes: [],
    isLoading: true,
    loadDailyNotes,
    getTodayNote,
    updateNoteContent,
    upsertNote,
  };
});