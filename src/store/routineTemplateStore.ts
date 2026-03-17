"use client";

import { create } from "zustand";

import { db } from "@/db/index";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import type { RoutineTemplate, TimeBlock } from "@/types/index";

type RoutineTemplateStore = {
  templates: RoutineTemplate[];
  isLoading: boolean;
  isLoaded: boolean;
  loadTemplates: () => Promise<void>;
  createTemplate: (data: Partial<RoutineTemplate>) => Promise<RoutineTemplate>;
  updateTemplate: (id: string, changes: Partial<RoutineTemplate>) => Promise<void>;
  reorderTemplates: (orderedIds: string[]) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  applyTemplatesToDay: (templateIds: string[], date: string) => Promise<void>;
};

const builtIns: Array<Pick<RoutineTemplate, "title" | "durationMinutes" | "defaultStartTime" | "color" | "icon">> = [
  { title: "Sleep",           durationMinutes: 480, defaultStartTime: "22:00", color: "#52525b", icon: "😴" },
  { title: "Morning Routine", durationMinutes: 90,  defaultStartTime: "07:00", color: "#f59e0b", icon: "🌅" },
  { title: "Commute",         durationMinutes: 30,  defaultStartTime: "08:30", color: "#64748b", icon: "🚌" },
  { title: "Workout",         durationMinutes: 60,  defaultStartTime: "06:00", color: "#22c55e", icon: "🏋️" },
  { title: "Deep Work",       durationMinutes: 180, defaultStartTime: "09:00", color: "#3b82f6", icon: "🧠" },
  { title: "Lunch Break",     durationMinutes: 60,  defaultStartTime: "12:00", color: "#f97316", icon: "🥗" },
];

function combineDateTime(date: string, timeHHmm: string): Date {
  const [y, m, d]   = date.split("-").map(Number);
  const [hh, mm]    = timeHHmm.split(":").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export const useRoutineTemplateStore = create<RoutineTemplateStore>((set, get) => {
  const loadTemplates: RoutineTemplateStore["loadTemplates"] = async () => {
    // Guard: set synchronously before any await to prevent concurrent calls
    if (get()?.isLoaded) return;
    set({ isLoaded: true });

    try {
      let templates = await db.routineTemplates.toArray();

      // Deduplicate by title (keep first occurrence, delete extras)
      const seen = new Set<string>();
      const dupes: string[] = [];
      templates = templates.filter((t) => {
        if (seen.has(t.title)) { dupes.push(t.id); return false; }
        seen.add(t.title);
        return true;
      });
      dupes.forEach((id) => void db.routineTemplates.delete(id));

      if (templates.length === 0) {
        const seeded: RoutineTemplate[] = builtIns.map((t, i) => ({
          id: crypto.randomUUID(),
          title: t.title,
          durationMinutes: t.durationMinutes,
          defaultStartTime: t.defaultStartTime,
          color: t.color,
          icon: t.icon,
          daysOfWeek: [],
          isBuiltIn: true,
          pinned: true,
          order: i,
        }));
        await db.routineTemplates.bulkPut(seeded);
        templates = seeded;
      }

      // One-time migration: any template with pinned === undefined gets pinned: true written to DB.
      // Without this, the strict === true filter in the strip hides them and !undefined = true
      // means the toggle button can never unpin them (it always sets pinned: true).
      const needsFix = templates.filter((t) => t.pinned === undefined);
      if (needsFix.length > 0) {
        await db.transaction("rw", db.routineTemplates, async () => {
          for (const t of needsFix) {
            await db.routineTemplates.update(t.id, { pinned: true });
          }
        });
        const fixed = await db.routineTemplates.toArray();
        set({ templates: fixed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), isLoaded: true });
        return;
      }

      set({ templates: [...templates].sort((a, b) => a.order - b.order) });
    } catch (error) {
      console.error("Failed to load routine templates:", error);
      set({ templates: [] });
    } finally {
      set({ isLoading: false });
    }
  };

  const createTemplate: RoutineTemplateStore["createTemplate"] = async (data) => {
    const maxOrder = get().templates.reduce((m, t) => Math.max(m, t.order ?? 0), -1);
    const template: RoutineTemplate = {
      id:              crypto.randomUUID(),
      title:           data.title ?? "New Template",
      durationMinutes: data.durationMinutes ?? 60,
      defaultStartTime: data.defaultStartTime,
      color:           data.color ?? "#52525b",
      icon:            data.icon,
      daysOfWeek:      data.daysOfWeek ?? [],
      isBuiltIn:       data.isBuiltIn ?? false,
      pinned:          data.pinned ?? true,
      order:           maxOrder + 1,
    };

    await db.routineTemplates.put(template);
    set({ templates: [...get().templates, template] });
    return template;
  };

  const updateTemplate: RoutineTemplateStore["updateTemplate"] = async (id, changes) => {
    const before = get().templates.find((t) => t.id === id);

    // Use callback form so Zustand always has the freshest state and
    // always notifies subscribers (avoids stale-get + shallow-equality issues)
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, ...changes } : t
      ),
    }));

    try {
      await db.routineTemplates.update(id, changes);
    } catch (err) {
      console.error("Failed to persist template update:", err);
      if (before) {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...before } : t
          ),
        }));
      }
    }
  };

  const reorderTemplates: RoutineTemplateStore["reorderTemplates"] = async (orderedIds) => {
    const current = get().templates;
    // Build the new ordered array with updated order values
    const reordered = orderedIds
      .map((id, i) => {
        const t = current.find((t) => t.id === id);
        return t ? { ...t, order: i } : null;
      })
      .filter((t): t is RoutineTemplate => t !== null);

    // Write all order changes atomically
    await db.transaction("rw", db.routineTemplates, async () => {
      for (const t of reordered) {
        await db.routineTemplates.update(t.id, { order: t.order });
      }
    });

    // Update store — keep any templates not in orderedIds at the end
    const reorderedIds = new Set(orderedIds);
    const rest = current.filter((t) => !reorderedIds.has(t.id));
    set({ templates: [...reordered, ...rest] });
  };

  const deleteTemplate: RoutineTemplateStore["deleteTemplate"] = async (id) => {
    if (!window.confirm("Delete this routine template?")) return;
    await db.routineTemplates.delete(id);
    set({ templates: get().templates.filter((t) => t.id !== id) });
  };

  const applyTemplatesToDay: RoutineTemplateStore["applyTemplatesToDay"] = async (templateIds, date) => {
    const selected = get().templates.filter((t) => templateIds.includes(t.id));
    if (selected.length === 0) return;

    const blocks: TimeBlock[] = selected.map((t) => {
      const startDate = combineDateTime(date, t.defaultStartTime ?? "09:00");
      const endDate   = new Date(startDate.getTime() + (t.durationMinutes ?? 60) * 60_000);
      return {
        id:               crypto.randomUUID(),
        title:            t.title,
        startTime:        startDate.toISOString(),
        endTime:          endDate.toISOString(),
        type:             "routine",
        routineTemplateId: t.id,
        color:            t.color,
      };
    });

    await db.transaction("rw", db.timeBlocks, async () => {
      await db.timeBlocks.bulkPut(blocks);
    });

    await useTimeBlockStore.getState().loadTimeBlocks();
  };

  if (typeof window !== "undefined") void loadTemplates();

  return {
    templates: [],
    isLoading: true,
    isLoaded:  false,
    loadTemplates,
    createTemplate,
    updateTemplate,
    reorderTemplates,
    deleteTemplate,
    applyTemplatesToDay,
  };
});
