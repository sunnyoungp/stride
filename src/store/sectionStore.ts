"use client";

import { create } from "zustand";

import { db } from "@/db/index";
import type { DeletedSection } from "@/db/index";
import { useTaskStore } from "@/store/taskStore";
import type { TaskSection, TaskSubsection } from "@/types/index";

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
    if (get().sectionsLoaded) return;
    try {
      // Use count() first — faster and avoids loading all records just to check
      const count = await db.sections.count();
      if (count > 0) {
        const existingSections = await db.sections.toArray();
        set({ sections: existingSections.sort((a, b) => a.order - b.order), sectionsLoaded: true });
        return;
      }
      // DB is confirmed empty — safe to seed defaults
      const seeded: TaskSection[] = defaultSections.map((s, idx) => ({
        id: crypto.randomUUID(),
        title: s.title,
        icon: s.icon,
        color: s.color,
        order: idx,
      }));
      await db.sections.bulkPut(seeded);
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
      const deleted = await db.deletedSections.toArray();
      set({ deletedSections: deleted.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)) });
    } catch {
      // table may not exist on older DB versions — ignore
    }
  };

  const createSection: SectionStore["createSection"] = async (title, color, icon) => {
    const maxOrder = get().sections.reduce((m, s) => Math.max(m, s.order), -1);
    const section: TaskSection = {
      id: crypto.randomUUID(),
      title,
      color,
      icon,
      order: maxOrder + 1,
    };
    await db.sections.put(section);
    set({ sections: [...get().sections, section].sort((a, b) => a.order - b.order) });
    return section;
  };

  const updateSection: SectionStore["updateSection"] = async (id, changes) => {
    await db.sections.update(id, changes);
    set({
      sections: get().sections.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    });
  };

  const deleteSection: SectionStore["deleteSection"] = async (id) => {
    const section = get().sections.find((s) => s.id === id);
    if (!section) return;

    const deletedSection: DeletedSection = { ...section, deletedAt: new Date().toISOString() };

    await db.transaction("rw", db.sections, db.tasks, db.taskSubsections, db.deletedSections, async () => {
      await db.sections.delete(id);
      await db.deletedSections.put(deletedSection);
      await db.tasks.where("sectionId").equals(id).modify({ sectionId: undefined, subsectionId: undefined });
      await db.taskSubsections.where("sectionId").equals(id).delete();
    });

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
    const { deletedAt: _deletedAt, ...section } = deleted;
    await db.transaction("rw", db.sections, db.deletedSections, async () => {
      await db.sections.put(section);
      await db.deletedSections.delete(id);
    });
    set({
      sections: [...get().sections, section].sort((a, b) => a.order - b.order),
      deletedSections: get().deletedSections.filter((s) => s.id !== id),
    });
  };

  const loadSubsections: SectionStore["loadSubsections"] = async () => {
    if (get().subsectionsLoaded) return;
    try {
      const subsections = await db.taskSubsections.toArray();
      set({ subsections: subsections.sort((a, b) => a.order - b.order), subsectionsLoaded: true });
    } catch (error) {
      console.error("Failed to load subsections:", error);
      set({ subsections: [] });
    }
  };

  const createSubsection: SectionStore["createSubsection"] = async (title, sectionId) => {
    const maxOrder = get().subsections
      .filter((s) => s.sectionId === sectionId)
      .reduce((m, s) => Math.max(m, s.order), -1);
    const sub: TaskSubsection = {
      id: crypto.randomUUID(),
      title,
      sectionId,
      order: maxOrder + 1,
    };
    await db.taskSubsections.put(sub);
    set({ subsections: [...get().subsections, sub].sort((a, b) => a.order - b.order) });
    return sub;
  };

  const updateSubsection: SectionStore["updateSubsection"] = async (id, changes) => {
    await db.taskSubsections.update(id, changes);
    set({
      subsections: get().subsections.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    });
  };

  const deleteSubsection: SectionStore["deleteSubsection"] = async (id) => {
    await db.transaction("rw", db.taskSubsections, db.tasks, async () => {
      await db.taskSubsections.delete(id);
      await db.tasks.where("subsectionId").equals(id).modify({ subsectionId: undefined });
    });
    set({ subsections: get().subsections.filter((s) => s.id !== id) });
    await useTaskStore.getState().loadTasks();
  };

  void loadSections();
  void loadSubsections();
  void loadDeletedSections();

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
