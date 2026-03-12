"use client";

import { create } from "zustand";

import { db } from "@/db/index";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import type { RoutineTemplate, TimeBlock } from "@/types/index";

type RoutineTemplateStore = {
  templates: RoutineTemplate[];
  isLoading: boolean;
  loadTemplates: () => Promise<void>;
  createTemplate: (data: Partial<RoutineTemplate>) => Promise<RoutineTemplate>;
  updateTemplate: (id: string, changes: Partial<RoutineTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  applyTemplatesToDay: (templateIds: string[], date: string) => Promise<void>;
};

const builtIns: Array<
  Pick<RoutineTemplate, "title" | "startTime" | "endTime" | "color" | "icon">
> = [
  { title: "Sleep", startTime: "22:00", endTime: "07:00", color: "#52525b", icon: "😴" }, // zinc
  {
    title: "Morning Routine",
    startTime: "07:00",
    endTime: "08:30",
    color: "#f59e0b",
    icon: "🌅",
  }, // amber
  { title: "Commute", startTime: "08:30", endTime: "09:00", color: "#64748b", icon: "🚌" }, // slate
  { title: "Workout", startTime: "06:00", endTime: "07:00", color: "#22c55e", icon: "🏋️" }, // green
  { title: "Deep Work", startTime: "09:00", endTime: "12:00", color: "#3b82f6", icon: "🧠" }, // blue
  { title: "Lunch Break", startTime: "12:00", endTime: "13:00", color: "#f97316", icon: "🥗" }, // orange
];

function combineDateTime(date: string, timeHHmm: string): Date {
  const [y, m, d] = date.split("-").map((n) => Number(n));
  const [hh, mm] = timeHHmm.split(":").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export const useRoutineTemplateStore = create<RoutineTemplateStore>((set, get) => {
  const loadTemplates: RoutineTemplateStore["loadTemplates"] = async () => {
    try {
      let templates = await db.routineTemplates.toArray();

      if (templates.length === 0) {
        const seeded: RoutineTemplate[] = builtIns.map((t) => ({
          id: crypto.randomUUID(),
          title: t.title,
          startTime: t.startTime,
          endTime: t.endTime,
          color: t.color,
          icon: t.icon,
          daysOfWeek: [],
          isBuiltIn: true,
        }));
        await db.routineTemplates.bulkPut(seeded);
        templates = seeded;
      }

      set({ templates });
    } catch (error) {
      console.error("Failed to load routine templates:", error);
      set({ templates: [] });
    } finally {
      set({ isLoading: false });
    }
  };

  const createTemplate: RoutineTemplateStore["createTemplate"] = async (data) => {
    const template: RoutineTemplate = {
      id: crypto.randomUUID(),
      title: data.title ?? "New Template",
      startTime: data.startTime ?? "09:00",
      endTime: data.endTime ?? "10:00",
      color: data.color ?? "#52525b",
      icon: data.icon,
      daysOfWeek: data.daysOfWeek ?? [],
      isBuiltIn: data.isBuiltIn ?? false,
    };

    await db.routineTemplates.put(template);
    set({ templates: [...get().templates, template] });
    return template;
  };

  const updateTemplate: RoutineTemplateStore["updateTemplate"] = async (id, changes) => {
    await db.routineTemplates.update(id, changes);
    set({
      templates: get().templates.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    });
  };

  const deleteTemplate: RoutineTemplateStore["deleteTemplate"] = async (id) => {
    const template = get().templates.find((t) => t.id === id);
    if (!template) return;
    if (template.isBuiltIn) return;

    await db.routineTemplates.delete(id);
    set({ templates: get().templates.filter((t) => t.id !== id) });
  };

  const applyTemplatesToDay: RoutineTemplateStore["applyTemplatesToDay"] = async (
    templateIds,
    date,
  ) => {
    const selected = get().templates.filter((t) => templateIds.includes(t.id));
    if (selected.length === 0) return;

    const blocks: TimeBlock[] = selected.map((t) => {
      const start = combineDateTime(date, t.startTime);
      let end = combineDateTime(date, t.endTime);
      if (end <= start) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
      return {
        id: crypto.randomUUID(),
        title: t.title,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        type: "routine",
        routineTemplateId: t.id,
        color: t.color,
      };
    });

    await db.transaction("rw", db.timeBlocks, async () => {
      await db.timeBlocks.bulkPut(blocks);
    });

    // Keep in-memory time blocks in sync.
    await useTimeBlockStore.getState().loadTimeBlocks();
  };

  void loadTemplates();

  return {
    templates: [],
    isLoading: true,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplatesToDay,
  };
});

