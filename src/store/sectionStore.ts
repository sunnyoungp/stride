"use client";

import { create } from "zustand";

import { createClient } from "@/lib/supabase/client";
import type { DeletedSection } from "@/db/index";
import { useTaskStore } from "@/store/taskStore";
import type { TaskSection, TaskSubsection } from "@/types/index";

const supabase = createClient();

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function sectionFromRow(row: Record<string, unknown>): TaskSection {
  return {
    id: row.id as string,
    title: row.title as string,
    color: (row.color as string | null) ?? undefined,
    icon: (row.icon as string | null) ?? undefined,
    order: row.order as number,
  };
}

function sectionToRow(s: TaskSection, userId: string) {
  return {
    id: s.id,
    title: s.title,
    color: s.color ?? null,
    icon: s.icon ?? null,
    order: s.order,
    user_id: userId,
  };
}

function deletedSectionFromRow(row: Record<string, unknown>): DeletedSection {
  return {
    ...sectionFromRow(row),
    deletedAt: row.deleted_at as string,
  };
}

function deletedSectionToRow(s: DeletedSection, userId: string) {
  return {
    id: s.id,
    title: s.title,
    color: s.color ?? null,
    icon: s.icon ?? null,
    order: s.order,
    deleted_at: s.deletedAt,
    user_id: userId,
  };
}

function subsectionFromRow(row: Record<string, unknown>): TaskSubsection {
  return {
    id: row.id as string,
    title: row.title as string,
    sectionId: row.section_id as string,
    color: (row.color as string | null) ?? undefined,
    order: row.order as number,
  };
}

function subsectionToRow(s: TaskSubsection, userId: string) {
  return {
    id: s.id,
    title: s.title,
    section_id: s.sectionId,
    color: s.color ?? null,
    order: s.order,
    user_id: userId,
  };
}

// ── Store ──────────────────────────────────────────────────────────────────────

type SectionStore = {
  sections: TaskSection[];
  subsections: TaskSubsection[];
  deletedSections: DeletedSection[];
  isLoading: boolean;
  sectionsLoaded: boolean;
  subsectionsLoaded: boolean;
  loadSections: () => Promise<void>;
  createSection: (title: string, color?: string, icon?: string) => Promise<TaskSection>;
  updateSection: (id: string, changes: Partial<TaskSection>) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  restoreSection: (id: string) => Promise<void>;

  loadSubsections: () => Promise<void>;
  createSubsection: (title: string, sectionId: string) => Promise<TaskSubsection>;
  updateSubsection: (id: string, changes: Partial<TaskSubsection>) => Promise<void>;
  deleteSubsection: (id: string) => Promise<void>;
};

const defaultSections: Array<Pick<TaskSection, "title" | "icon" | "color">> = [
  { title: "Work", icon: "💼", color: "blue" },
  { title: "Personal", icon: "🏠", color: "green" },
  { title: "Health", icon: "🏃", color: "red" },
];

export const useSectionStore = create<SectionStore>((set, get) => {
  const loadSections: SectionStore["loadSections"] = async () => {
    if (get()?.sectionsLoaded) return;
    try {
      const { data: rows, error } = await supabase.from("sections").select("*");
      if (error) throw error;

      if (rows && rows.length > 0) {
        const sections: TaskSection[] = (rows.map(sectionFromRow) as TaskSection[]).sort((a, b) => a.order - b.order);
        set({ sections, sectionsLoaded: true });
        return;
      }

      // No sections yet — seed defaults for this user
      const userId = await getUserId();
      if (!userId) { set({ sectionsLoaded: true }); return; }

      const seeded: TaskSection[] = defaultSections.map((s, idx) => ({
        id: crypto.randomUUID(),
        title: s.title,
        icon: s.icon,
        color: s.color,
        order: idx,
      }));
      const { error: insertError } = await supabase
        .from("sections")
        .insert(seeded.map((s) => sectionToRow(s, userId)));
      if (insertError) throw insertError;
      set({ sections: seeded, sectionsLoaded: true });
    } catch (error) {
      console.error("Failed to load sections:", error);
      set({ sections: [] });
    } finally {
      set({ isLoading: false });
    }
  };

  const loadDeletedSections = async () => {
    try {
      const { data: rows } = await supabase.from("deleted_sections").select("*");
      if (rows) {
        const deleted = (rows.map(deletedSectionFromRow) as DeletedSection[])
          .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
        set({ deletedSections: deleted });
      }
    } catch {
      // table may not exist — ignore
    }
  };

  const createSection: SectionStore["createSection"] = async (title, color, icon) => {
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");
    const maxOrder = get().sections.reduce((m, s) => Math.max(m, s.order), -1);
    const section: TaskSection = {
      id: crypto.randomUUID(),
      title,
      color,
      icon,
      order: maxOrder + 1,
    };
    const { error } = await supabase.from("sections").insert(sectionToRow(section, userId));
    if (error) console.error("Failed to create section:", error);
    set({ sections: [...get().sections, section].sort((a, b) => a.order - b.order) });
    return section;
  };

  const updateSection: SectionStore["updateSection"] = async (id, changes) => {
    const row: Record<string, unknown> = {};
    if ("title" in changes) row.title = changes.title;
    if ("color" in changes) row.color = changes.color ?? null;
    if ("icon" in changes) row.icon = changes.icon ?? null;
    if ("order" in changes) row.order = changes.order;
    const { error } = await supabase.from("sections").update(row).eq("id", id);
    if (error) console.error("Failed to update section:", error);
    set({ sections: get().sections.map((s) => (s.id === id ? { ...s, ...changes } : s)) });
  };

  const deleteSection: SectionStore["deleteSection"] = async (id) => {
    const section = get().sections.find((s) => s.id === id);
    if (!section) return;
    const userId = await getUserId();
    if (!userId) return;

    const deletedSection: DeletedSection = { ...section, deletedAt: new Date().toISOString() };

    await supabase.from("sections").delete().eq("id", id);
    await supabase.from("deleted_sections").insert(deletedSectionToRow(deletedSection, userId));
    await supabase.from("tasks").update({ section_id: null, subsection_id: null }).eq("section_id", id);
    await supabase.from("task_subsections").delete().eq("section_id", id);

    set({
      sections: get().sections.filter((s) => s.id !== id),
      subsections: get().subsections.filter((sub) => sub.sectionId !== id),
      deletedSections: [deletedSection, ...get().deletedSections],
    });
    await useTaskStore.getState().loadTasks();
  };

  const restoreSection: SectionStore["restoreSection"] = async (id) => {
    const deleted = get().deletedSections.find((s) => s.id === id);
    if (!deleted) return;
    const userId = await getUserId();
    if (!userId) return;
    const { deletedAt: _deletedAt, ...section } = deleted;
    await supabase.from("sections").insert(sectionToRow(section, userId));
    await supabase.from("deleted_sections").delete().eq("id", id);
    set({
      sections: [...get().sections, section].sort((a, b) => a.order - b.order),
      deletedSections: get().deletedSections.filter((s) => s.id !== id),
    });
  };

  const loadSubsections: SectionStore["loadSubsections"] = async () => {
    if (get()?.subsectionsLoaded) return;
    try {
      const { data: rows, error } = await supabase.from("task_subsections").select("*");
      if (error) throw error;
      const subsections = ((rows ?? []).map(subsectionFromRow) as TaskSubsection[])
        .sort((a, b) => a.order - b.order);
      set({ subsections, subsectionsLoaded: true });
    } catch (error) {
      console.error("Failed to load subsections:", error);
      set({ subsections: [] });
    }
  };

  const createSubsection: SectionStore["createSubsection"] = async (title, sectionId) => {
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");
    const maxOrder = get().subsections
      .filter((s) => s.sectionId === sectionId)
      .reduce((m, s) => Math.max(m, s.order), -1);
    const sub: TaskSubsection = {
      id: crypto.randomUUID(),
      title,
      sectionId,
      order: maxOrder + 1,
    };
    const { error } = await supabase.from("task_subsections").insert(subsectionToRow(sub, userId));
    if (error) console.error("Failed to create subsection:", error);
    set({ subsections: [...get().subsections, sub].sort((a, b) => a.order - b.order) });
    return sub;
  };

  const updateSubsection: SectionStore["updateSubsection"] = async (id, changes) => {
    const row: Record<string, unknown> = {};
    if ("title" in changes) row.title = changes.title;
    if ("color" in changes) row.color = changes.color ?? null;
    if ("order" in changes) row.order = changes.order;
    if ("sectionId" in changes) row.section_id = changes.sectionId;
    const { error } = await supabase.from("task_subsections").update(row).eq("id", id);
    if (error) console.error("Failed to update subsection:", error);
    set({ subsections: get().subsections.map((s) => (s.id === id ? { ...s, ...changes } : s)) });
  };

  const deleteSubsection: SectionStore["deleteSubsection"] = async (id) => {
    await supabase.from("task_subsections").delete().eq("id", id);
    await supabase.from("tasks").update({ subsection_id: null }).eq("subsection_id", id);
    set({ subsections: get().subsections.filter((s) => s.id !== id) });
    await useTaskStore.getState().loadTasks();
  };

  if (typeof window !== "undefined") void loadSections();
  if (typeof window !== "undefined") void loadSubsections();
  if (typeof window !== "undefined") void loadDeletedSections();

  return {
    sections: [],
    subsections: [],
    deletedSections: [],
    isLoading: true,
    sectionsLoaded: false,
    subsectionsLoaded: false,
    loadSections,
    loadSubsections,
    createSection,
    updateSection,
    deleteSection,
    restoreSection,
    createSubsection,
    updateSubsection,
    deleteSubsection,
  };
});
