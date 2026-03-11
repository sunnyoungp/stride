import { create } from "zustand";

import { db } from "@/db/index";
import { useTaskStore } from "@/store/taskStore";
import type { TaskSection, TaskSubsection } from "@/types/index";

type SectionStore = {
  sections: TaskSection[];
  subsections: TaskSubsection[];
  loadSections: () => Promise<void>;
  createSection: (title: string, color?: string, icon?: string) => Promise<TaskSection>;
  updateSection: (id: string, changes: Partial<TaskSection>) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  
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
    const existingSections = await db.sections.toArray();

    if (existingSections.length > 0) {
      set({ sections: existingSections.sort((a, b) => a.order - b.order) });
      return;
    }

    const seeded: TaskSection[] = defaultSections.map((s, idx) => ({
      id: crypto.randomUUID(),
      title: s.title,
      icon: s.icon,
      color: s.color,
      order: idx,
    }));

    await db.sections.bulkPut(seeded);
    set({ sections: seeded });
  };

  const createSection: SectionStore["createSection"] = async (
    title,
    color,
    icon,
  ) => {
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
    await db.transaction("rw", db.sections, db.tasks, db.taskSubsections, async () => {
      await db.sections.delete(id);
      await db.tasks.where("sectionId").equals(id).modify({ sectionId: undefined, subsectionId: undefined });
      await db.taskSubsections.where("sectionId").equals(id).delete();
    });

    set({ 
      sections: get().sections.filter((s) => s.id !== id),
      subsections: get().subsections.filter(sub => sub.sectionId !== id)
    });
    await useTaskStore.getState().loadTasks();
  };

  const loadSubsections: SectionStore["loadSubsections"] = async () => {
    const subsections = await db.taskSubsections.toArray();
    set({ subsections: subsections.sort((a, b) => a.order - b.order) });
  };

  const createSubsection: SectionStore["createSubsection"] = async (title, sectionId) => {
    const maxOrder = get().subsections
      .filter(s => s.sectionId === sectionId)
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
    
    set({ subsections: get().subsections.filter(s => s.id !== id) });
    await useTaskStore.getState().loadTasks();
  };

  void loadSections();
  void loadSubsections();

  return {
    sections: [],
    subsections: [],
    loadSections,
    loadSubsections,
    createSection,
    updateSection,
    deleteSection,
    createSubsection,
    updateSubsection,
    deleteSubsection,
  };
});

