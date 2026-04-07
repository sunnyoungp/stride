import { create } from 'zustand';
import { Task } from '../types';

export type FocusMode = 'tunnel' | 'timer' | 'vault' | 'stopwatch' | null;

export interface FocusState {
  isActive: boolean;
  mode: FocusMode;
  playlist: Task[];
  currentIndex: number;
  timeRemaining: number;
  duration: number;
  isPaused: boolean;
  autoFlow: boolean;
}

export interface FocusStore {
  isZenMode: boolean;
  isSetupModalOpen: boolean;
  isMinimized: boolean;
  focusState: FocusState;
  toggleZenMode: () => void;
  setSetupModalOpen: (isOpen: boolean) => void;
  toggleMinimized: () => void;
  addTasksToPlaylist: (tasks: Task[]) => void;
  removeTaskFromPlaylist: (taskId: string) => void;
  // Note: selectedTasks are the parents you picked in the CMD+J modal
  // allTasks are all tasks from useTaskStore.getState().tasks
  startFocusSession: (mode: FocusMode, selectedTasks: Task[], allTasks: Task[], durationInSeconds: number, autoFlow?: boolean) => void;
  /** Atomically wipes all session state — call on ESC and Leave. Never call on minimize. */
  clearSession: () => void;
  endFocusSession: () => void;
  nextTask: () => void;
  prevTask: () => void;
  setTimeRemaining: (seconds: number) => void;
  togglePause: () => void;
}

// HELPER: Improved logic to find subtasks by either parent ID or the parent's subtaskIds array
const flattenTasksWithSubtasks = (selectedTasks: Task[], allTasks: Task[]): Task[] => {
  const seen = new Set<string>();
  return selectedTasks.reduce((acc: Task[], parentTask) => {
    if (!seen.has(parentTask.id)) {
      acc.push(parentTask);
      seen.add(parentTask.id);
    }

    const subtasks = allTasks.filter(t => {
      const isChildOfThisParent = t.parentTaskId === parentTask.id;
      const isInParentsList = parentTask.subtaskIds?.includes(t.id);
      const isNotDone = t.status !== 'done' && t.status !== 'cancelled';
      return (isChildOfThisParent || isInParentsList) && isNotDone && !seen.has(t.id);
    });

    subtasks.forEach(t => { acc.push(t); seen.add(t.id); });

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
  autoFlow: false,
};

export const useFocusStore = create<FocusStore>((set) => ({
  isZenMode: false,
  isSetupModalOpen: false,
  isMinimized: false,
  focusState: initialFocusState,

  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),
  setSetupModalOpen: (isOpen) => set({ isSetupModalOpen: isOpen }),
  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),

  addTasksToPlaylist: (tasks) => set((state) => {
    const existingIds = new Set(state.focusState.playlist.map(t => t.id));
    const newTasks = tasks.filter(t => !existingIds.has(t.id));
    if (newTasks.length === 0) return state;
    return {
      focusState: {
        ...state.focusState,
        playlist: [...state.focusState.playlist, ...newTasks],
      },
    };
  }),

  removeTaskFromPlaylist: (taskId) => set((state) => {
    const { playlist, currentIndex } = state.focusState;
    const taskIdx = playlist.findIndex(t => t.id === taskId);
    if (taskIdx === -1) return state;
    const newPlaylist = playlist.filter(t => t.id !== taskId);
    let newIndex = currentIndex;
    if (taskIdx < currentIndex) {
      newIndex = currentIndex - 1; // item before current removed → shift back
    } else if (taskIdx === currentIndex) {
      newIndex = Math.min(currentIndex, newPlaylist.length - 1); // stay at same slot or last
    }
    return {
      focusState: {
        ...state.focusState,
        playlist: newPlaylist,
        currentIndex: Math.max(0, newIndex),
      },
    };
  }),

  startFocusSession: (mode, selectedTasks, allTasks, durationInSeconds, autoFlow = false) => {
    // Process the list to include the subtask objects
    const flatPlaylist = flattenTasksWithSubtasks(selectedTasks, allTasks);

    set({
      isSetupModalOpen: false,
      isZenMode: true,
      isMinimized: false,
      focusState: {
        isActive: true,
        mode,
        playlist: flatPlaylist,
        currentIndex: 0,
        timeRemaining: durationInSeconds,
        duration: durationInSeconds,
        isPaused: false,
        autoFlow,
      }
    });
  },

  clearSession: () => set({
    focusState: initialFocusState,
    isZenMode: false,
    isMinimized: false,
  }),

  endFocusSession: () => set({
    focusState: initialFocusState,
    isZenMode: false,
    isMinimized: false,
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
