"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import type { RoutineTemplate, TimeBlock } from "@/types/index";

const supabase = createClient();

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function templateFromRow(row: Record<string, unknown>): RoutineTemplate {
  return {
    id: row.id as string,
    title: row.title as string,
    durationMinutes: row.duration_minutes as number,
    defaultStartTime: (row.default_start_time as string | null) ?? undefined,
    color: row.color as string,
    daysOfWeek: (row.days_of_week as number[]) ?? [],
    isBuiltIn: (row.is_built_in as boolean) ?? false,
    icon: (row.icon as string | null) ?? undefined,
    pinned: (row.pinned as boolean | null) ?? undefined,
    order: (row.order as number) ?? 0,
  };
}

function templateToRow(t: RoutineTemplate, userId: string) {
  return {
    id: t.id,
    title: t.title,
    duration_minutes: t.durationMinutes,
    default_start_time: t.defaultStartTime ?? null,
    color: t.color,
    days_of_week: t.daysOfWeek,
    is_built_in: t.isBuiltIn,
    icon: t.icon ?? null,
    pinned: t.pinned ?? null,
    order: t.order,
    user_id: userId,
  };
}

// ── Store ──────────────────────────────────────────────────────────────────────

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
    if (get()?.isLoaded) return;
    set({ isLoaded: true });

    try {
      const { data: rows, error } = await supabase.from("routine_templates").select("*");
      if (error) throw error;

      let templates: RoutineTemplate[] = (rows ?? []).map(templateFromRow);

      // Deduplicate by title (keep first occurrence, delete extras)
      const seen = new Set<string>();
      const dupes: string[] = [];
      templates = templates.filter((t) => {
        if (seen.has(t.title)) { dupes.push(t.id); return false; }
        seen.add(t.title);
        return true;
      });
      if (dupes.length > 0) {
        await supabase.from("routine_templates").delete().in("id", dupes);
      }

      if (templates.length === 0) {
        const userId = await getUserId();
        if (!userId) { set({ isLoading: false }); return; }

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
        const { error: insertError } = await supabase
          .from("routine_templates")
          .insert(seeded.map((t) => templateToRow(t, userId)));
        if (insertError) throw insertError;
        templates = seeded;
      }

      // One-time migration: fix any templates where pinned is undefined/null
      const needsFix = templates.filter((t) => t.pinned === undefined || t.pinned === null);
      if (needsFix.length > 0) {
        await supabase
          .from("routine_templates")
          .update({ pinned: true })
          .in("id", needsFix.map((t) => t.id));
        templates = templates.map((t) =>
          needsFix.some((f) => f.id === t.id) ? { ...t, pinned: true } : t,
        );
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
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");
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
    const { error } = await supabase
      .from("routine_templates")
      .insert(templateToRow(template, userId));
    if (error) console.error("Failed to create template:", error);
    set({ templates: [...get().templates, template] });
    return template;
  };

  const updateTemplate: RoutineTemplateStore["updateTemplate"] = async (id, changes) => {
    const before = get().templates.find((t) => t.id === id);

    // Optimistic update
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    }));

    const row: Record<string, unknown> = {};
    if ("title" in changes) row.title = changes.title;
    if ("durationMinutes" in changes) row.duration_minutes = changes.durationMinutes;
    if ("defaultStartTime" in changes) row.default_start_time = changes.defaultStartTime ?? null;
    if ("color" in changes) row.color = changes.color;
    if ("daysOfWeek" in changes) row.days_of_week = changes.daysOfWeek;
    if ("isBuiltIn" in changes) row.is_built_in = changes.isBuiltIn;
    if ("icon" in changes) row.icon = changes.icon ?? null;
    if ("pinned" in changes) row.pinned = changes.pinned ?? null;
    if ("order" in changes) row.order = changes.order;

    const { error } = await supabase.from("routine_templates").update(row).eq("id", id);
    if (error) {
      console.error("Failed to persist template update:", error);
      if (before) {
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...before } : t)),
        }));
      }
    }
  };

  const reorderTemplates: RoutineTemplateStore["reorderTemplates"] = async (orderedIds) => {
    const current = get().templates;
    const reordered = orderedIds
      .map((id, i) => {
        const t = current.find((t) => t.id === id);
        return t ? { ...t, order: i } : null;
      })
      .filter((t): t is RoutineTemplate => t !== null);

    for (const t of reordered) {
      await supabase.from("routine_templates").update({ order: t.order }).eq("id", t.id);
    }

    const reorderedIds = new Set(orderedIds);
    const rest = current.filter((t) => !reorderedIds.has(t.id));
    set({ templates: [...reordered, ...rest] });
  };

  const deleteTemplate: RoutineTemplateStore["deleteTemplate"] = async (id) => {
    if (!window.confirm("Delete this routine template?")) return;
    const { error } = await supabase.from("routine_templates").delete().eq("id", id);
    if (error) console.error("Failed to delete template:", error);
    set({ templates: get().templates.filter((t) => t.id !== id) });
  };

  const applyTemplatesToDay: RoutineTemplateStore["applyTemplatesToDay"] = async (
    templateIds,
    date,
  ) => {
    const userId = await getUserId();
    if (!userId) return;
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

    const { error } = await supabase.from("time_blocks").insert(
      blocks.map((b) => ({
        id: b.id,
        title: b.title,
        start_time: b.startTime,
        end_time: b.endTime,
        type: b.type,
        task_id: b.taskId ?? null,
        routine_template_id: b.routineTemplateId ?? null,
        color: b.color ?? null,
        user_id: userId,
      })),
    );
    if (error) console.error("Failed to apply templates to day:", error);

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
