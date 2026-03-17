"use client";

import { create } from "zustand";

type UIStore = {
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  isSearchOpen: false,
  openSearch:   () => set({ isSearchOpen: true }),
  closeSearch:  () => set({ isSearchOpen: false }),
}));
