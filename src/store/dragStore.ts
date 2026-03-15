"use client";

import { create } from "zustand";

type DragStore = {
  draggingTaskId: string | null;
  setDragging: (id: string) => void;
  clearDragging: () => void;
};

export const useDragStore = create<DragStore>((set) => ({
  draggingTaskId: null,
  setDragging: (id) => set({ draggingTaskId: id }),
  clearDragging: () => set({ draggingTaskId: null }),
}));
