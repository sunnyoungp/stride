import { create } from 'zustand';
import { Task } from '../types';

export type FocusMode = 'tunnel' | 'timer' | 'vault' | null;

export interface FocusState {
  isActive: boolean;
  mode: FocusMode;
  playlist: Task[];
  currentIndex: number;
  timeRemaining: number;
  duration: number;
  isPaused: boolean;
}

export interface FocusStore {
  isZenMode: boolean;
  isSetupModalOpen: boolean;
  focusState: FocusState;
  toggleZenMode: () => void;
  setSetupModalOpen: (isOpen: boolean) => void;
  // Note: selectedTasks are the parents you picked in the CMD+J modal
  // allTasks are all tasks from useTaskStore.getState().tasks
  startFocusSession: (mode: FocusMode, selectedTasks: Task[], allTasks: Task[], durationInSeconds: number) => void;
  endFocusSession: () => void;
  nextTask: () => void;
  prevTask: () => void;
  setTimeRemaining: (seconds: number) => void;
  togglePause: () => void;
}

// HELPER: Improved logic to find subtasks by either parent ID or the parent's subtaskIds array
const flattenTasksWithSubtasks = (selectedTasks: Task[], allTasks: Task[]): Task[] => {
  return selectedTasks.reduce((acc: Task[], parentTask) => {
    // 1. Add the parent task first
    acc.push(parentTask);
    
    // 2. Find all subtasks that belong to this parent
    const subtasks = allTasks.filter(t => {
      const isChildOfThisParent = t.parentTaskId === parentTask.id;
      const isInParentsList = parentTask.subtaskIds?.includes(t.id);
      const isNotDone = t.status !== 'done' && t.status !== 'cancelled';
      
      return (isChildOfThisParent || isInParentsList) && isNotDone;
    });

    // 3. Add the found subtasks to the playlist
    acc.push(...subtasks);
    
    return acc;
  }, []);
};

const initialFocusState: FocusState = {
  isActive: false,
  mode: null,
  playlist: [],
  currentIndex: 0,
  timeRemaining: 0,
  duration: 0,
  isPaused: false,
};

export const useFocusStore = create<FocusStore>((set) => ({
  isZenMode: false,
  isSetupModalOpen: false,
  focusState: initialFocusState,

  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),
  setSetupModalOpen: (isOpen) => set({ isSetupModalOpen: isOpen }),

  startFocusSession: (mode, selectedTasks, allTasks, durationInSeconds) => {
    // Process the list to include the subtask objects
    const flatPlaylist = flattenTasksWithSubtasks(selectedTasks, allTasks);
    
    set({
      isSetupModalOpen: false,
      isZenMode: true,
      focusState: {
        isActive: true,
        mode,
        playlist: flatPlaylist,
        currentIndex: 0,
        timeRemaining: durationInSeconds,
        duration: durationInSeconds,
        isPaused: false,
      }
    });
  },

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