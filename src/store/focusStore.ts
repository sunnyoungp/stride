import { create } from 'zustand';
import { Task } from '../types';

export type FocusMode = 'tunnel' | 'timer' | 'vault' | null;

export interface FocusState {
  isActive: boolean;
  mode: FocusMode;
  playlist: Task[];
  currentIndex: number;
  timeRemaining: number;
  duration: number; // Added
  isPaused: boolean;
}

export interface FocusStore {
  // --- UI State ---
  isZenMode: boolean;
  isSetupModalOpen: boolean;

  // --- Session State ---
  focusState: FocusState;

  // --- Actions ---
  toggleZenMode: () => void;
  setSetupModalOpen: (isOpen: boolean) => void;

  startFocusSession: (mode: FocusMode, playlist: Task[], durationInSeconds: number) => void;
  endFocusSession: () => void;
  nextTask: () => void;
  prevTask: () => void;
  setTimeRemaining: (seconds: number) => void;
  togglePause: () => void;
}

const initialFocusState: FocusState = {
  isActive: false,
  mode: null,
  playlist: [],
  currentIndex: 0,
  timeRemaining: 0,
  duration: 0, // Added
  isPaused: false,
};

export const useFocusStore = create<FocusStore>((set) => ({
  // --- Initial UI State ---
  isZenMode: false,
  isSetupModalOpen: false,

  // --- Initial Session State (THIS WAS MISSING) ---
  focusState: initialFocusState,

  // --- UI Actions ---
  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),

  setSetupModalOpen: (isOpen) => set({ isSetupModalOpen: isOpen }),

  // --- Session Actions ---
  startFocusSession: (mode, playlist, durationInSeconds) => set({
    isSetupModalOpen: false,
    isZenMode: true,
    focusState: {
      isActive: true,
      mode,
      playlist,
      currentIndex: 0,
      timeRemaining: durationInSeconds,
      duration: durationInSeconds, // Added
      isPaused: false,
    }
  }),

  endFocusSession: () => set({
    focusState: initialFocusState,
  }),

  nextTask: () => set((state) => {
    const { focusState } = state;
    if (focusState.playlist.length === 0) return state;

    return {
      focusState: {
        ...focusState,
        currentIndex: Math.min(focusState.currentIndex + 1, focusState.playlist.length - 1)
      }
    };
  }),

  prevTask: () => set((state) => {
    const { focusState } = state;
    if (focusState.playlist.length === 0) return state;

    return {
      focusState: {
        ...focusState,
        currentIndex: Math.max(focusState.currentIndex - 1, 0)
      }
    };
  }),

  setTimeRemaining: (seconds) => set((state) => ({
    focusState: {
      ...state.focusState,
      timeRemaining: Math.max(0, seconds)
    }
  })),

  togglePause: () => set((state) => ({
    focusState: {
      ...state.focusState,
      isPaused: !state.focusState.isPaused
    }
  }))
}));