"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/storage";
import type { TimeBlock } from "@/types/index";

const supabase = createClient();

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function isAllDay(startTime: string, endTime: string): boolean {
  const s = new Date(startTime);
  const e = new Date(endTime);
  if (s.getHours() !== 0 || s.getMinutes() !== 0 || s.getSeconds() !== 0) return false;
  if (e.getHours() !== 0 || e.getMinutes() !== 0 || e.getSeconds() !== 0) return false;
  return (e.getTime() - s.getTime()) % (24 * 60 * 60 * 1000) === 0 && e.getTime() > s.getTime();
}

function timeBlockFromRow(row: Record<string, unknown>): TimeBlock {
  const startTime = row.start_time as string;
  const endTime = row.end_time as string;
  return {
    id: row.id as string,
    title: row.title as string,
    startTime,
    endTime,
    type: row.type as TimeBlock["type"],
    taskId: (row.task_id as string | null) ?? undefined,
    routineTemplateId: (row.routine_template_id as string | null) ?? undefined,
    color: (row.color as string | null) ?? undefined,
    allDay: isAllDay(startTime, endTime),
  };
}

function timeBlockToRow(b: TimeBlock, userId: string) {
  return {
    id: b.id,
    title: b.title,
    start_time: b.startTime,
    end_time: b.endTime,
    type: b.type,
    task_id: b.taskId ?? null,
    routine_template_id: b.routineTemplateId ?? null,
    color: b.color ?? null,
    user_id: userId,
  };
}

// ── Store ──────────────────────────────────────────────────────────────────────

type TimeBlockStore = {
  timeBlocks: TimeBlock[];
  loadTimeBlocks: () => Promise<void>;
  createTimeBlock: (data: Partial<TimeBlock>) => Promise<TimeBlock>;
  updateTimeBlock: (id: string, changes: Partial<TimeBlock>) => Promise<void>;
  deleteTimeBlock: (id: string) => Promise<void>;
};

function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export const useTimeBlockStore = create<TimeBlockStore>((set, get) => {
  const loadTimeBlocks: TimeBlockStore["loadTimeBlocks"] = async () => {
    try {
      const [{ data: blockRows }, { data: taskRows }] = await Promise.all([
        supabase.from("time_blocks").select("*"),
        supabase.from("tasks").select("id"),
      ]);
      if (isDemoMode()) return;

      const taskIdSet = new Set((taskRows ?? []).map((t: Record<string, unknown>) => t.id as string));
      const blocks = (blockRows ?? []).map(timeBlockFromRow);

      // Clear taskId references that point to deleted/non-existent tasks
      const cleaned: TimeBlock[] = [];
      for (const block of blocks) {
        if (block.taskId && !taskIdSet.has(block.taskId)) {
          await supabase
            .from("time_blocks")
            .update({ task_id: null })
            .eq("id", block.id);
          cleaned.push({ ...block, taskId: undefined });
        } else {
          cleaned.push(block);
        }
      }
      set({ timeBlocks: cleaned });
    } catch (error) {
      console.error("Failed to load time blocks:", error);
      set({ timeBlocks: [] });
    }
  };

  const createTimeBlock: TimeBlockStore["createTimeBlock"] = async (data) => {
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");
    const startTime = data.startTime ?? new Date().toISOString();
    const endTime = data.endTime ?? addMinutes(startTime, 30);
    const timeBlock: TimeBlock = {
      id: crypto.randomUUID(),
      title: data.title ?? "New Block",
      startTime,
      endTime,
      type: data.type ?? "event",
      taskId: data.taskId,
      routineTemplateId: data.routineTemplateId,
      color: data.color,
    };
    const { error } = await supabase.from("time_blocks").insert(timeBlockToRow(timeBlock, userId));
    if (error) console.error("Failed to create time block:", error);
    set({ timeBlocks: [...get().timeBlocks, timeBlock] });
    return timeBlock;
  };

  const updateTimeBlock: TimeBlockStore["updateTimeBlock"] = async (id, changes) => {
    const row: Record<string, unknown> = {};
    if ("title" in changes) row.title = changes.title;
    if ("startTime" in changes) row.start_time = changes.startTime;
    if ("endTime" in changes) row.end_time = changes.endTime;
    if ("type" in changes) row.type = changes.type;
    if ("taskId" in changes) row.task_id = changes.taskId ?? null;
    if ("routineTemplateId" in changes) row.routine_template_id = changes.routineTemplateId ?? null;
    if ("color" in changes) row.color = changes.color ?? null;
    const { error } = await supabase.from("time_blocks").update(row).eq("id", id);
    if (error) console.error("Failed to update time block:", error);
    set({
      timeBlocks: get().timeBlocks.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    });
  };

  const deleteTimeBlock: TimeBlockStore["deleteTimeBlock"] = async (id) => {
    const { error } = await supabase.from("time_blocks").delete().eq("id", id);
    if (error) console.error("Failed to delete time block:", error);
    set({ timeBlocks: get().timeBlocks.filter((b) => b.id !== id) });
  };

  if (typeof window !== "undefined") void loadTimeBlocks();

  return {
    timeBlocks: [],
    loadTimeBlocks,
    createTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
  };
});
