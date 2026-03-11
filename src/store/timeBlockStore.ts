import { create } from "zustand";

import { db } from "@/db/index";
import type { TimeBlock } from "@/types/index";

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
    const timeBlocks = await db.timeBlocks.toArray();
    set({ timeBlocks });
  };

  const createTimeBlock: TimeBlockStore["createTimeBlock"] = async (data) => {
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

    await db.timeBlocks.put(timeBlock);
    set({ timeBlocks: [...get().timeBlocks, timeBlock] });
    return timeBlock;
  };

  const updateTimeBlock: TimeBlockStore["updateTimeBlock"] = async (id, changes) => {
    await db.timeBlocks.update(id, changes);
    set({
      timeBlocks: get().timeBlocks.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    });
  };

  const deleteTimeBlock: TimeBlockStore["deleteTimeBlock"] = async (id) => {
    await db.timeBlocks.delete(id);
    set({ timeBlocks: get().timeBlocks.filter((b) => b.id !== id) });
  };

  void loadTimeBlocks();

  return {
    timeBlocks: [],
    loadTimeBlocks,
    createTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
  };
});

