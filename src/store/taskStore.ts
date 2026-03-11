import { create } from "zustand";

import { db } from "@/db/index";
import type { Task } from "@/types/index";
import { generateNextRecurringInstance } from "@/lib/recurrence";
import { useDocumentStore } from "./documentStore";

type TaskStore = {
  tasks: Task[];
  loadTasks: () => Promise<void>;
  createTask: (data: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, changes: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTasks: (updates: { id: string; order: number; sectionId?: string }[]) => Promise<void>;
  getTasksBySection: (sectionId: string) => Task[];
  getTasksDueToday: () => Task[];
  rolloverPastDueTasks: () => Promise<void>;
};

function toDateOnlyString(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIncomplete(task: Task): boolean {
  return task.status !== "done" && task.status !== "cancelled";
}

export const useTaskStore = create<TaskStore>((set, get) => {
  const loadTasks: TaskStore["loadTasks"] = async () => {
    const tasks = await db.tasks.toArray();
    set({ tasks });
    await get().rolloverPastDueTasks();
  };

  const createTask: TaskStore["createTask"] = async (data) => {
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title: data.title ?? "",
      notes: data.notes ?? "",
      status: data.status ?? "todo",
      priority: data.priority ?? "none",
      tags: data.tags ?? [],
      sectionId: data.sectionId,
      dueDate: data.dueDate,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      rolledOver: data.rolledOver ?? false,
      rolledOverFrom: data.rolledOverFrom,
      recurrence: data.recurrence,
      parentTaskId: data.parentTaskId,
      subtaskIds: data.subtaskIds ?? [],
      sourceDocumentId: data.sourceDocumentId,
      sourceDocumentTitle: data.sourceDocumentTitle,
      projectId: data.projectId,
      order: data.order ?? get().tasks.filter(t => t.sectionId === data.sectionId).length,
      createdAt: now,
      updatedAt: now,
    };

    await db.tasks.put(task);
    set({ tasks: [...get().tasks, task] });
    return task;
  };

  const updateTask: TaskStore["updateTask"] = async (id, changes) => {
    const currentState = get();
    const originalTask = currentState.tasks.find((t) => t.id === id);

    const updatedAt = new Date().toISOString();
    await db.tasks.update(id, { ...changes, updatedAt });
    
    set({
      tasks: get().tasks.map((t) =>
        t.id === id ? { ...t, ...changes, updatedAt } : t,
      ),
    });

    if (changes.status === "done" && originalTask?.recurrence) {
      const nextInstance = generateNextRecurringInstance(originalTask);
      if (nextInstance.dueDate) {
        await get().createTask(nextInstance);
      }
    }
  };

  const deleteTask: TaskStore["deleteTask"] = async (id) => {
    // Proactively clean up document references
    const docStore = useDocumentStore.getState();
    const affectedDocs = docStore.documents.filter((d) => 
      d.linkedTaskIds && d.linkedTaskIds.includes(id)
    );

    for (const doc of affectedDocs) {
      const nextLinked = doc.linkedTaskIds.filter((tid) => tid !== id);
      await docStore.updateDocument(doc.id, { linkedTaskIds: nextLinked });
    }

    await db.tasks.delete(id);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  };

  const reorderTasks: TaskStore["reorderTasks"] = async (updates) => {
    const updatedAt = new Date().toISOString();
    const updatedTasks = get().tasks.map((t) => {
      const update = updates.find((u) => u.id === t.id);
      if (update) {
        return { ...t, order: update.order, sectionId: update.sectionId ?? t.sectionId, updatedAt };
      }
      return t;
    });

    await db.transaction("rw", db.tasks, async () => {
      for (const update of updates) {
        await db.tasks.update(update.id, { 
          order: update.order, 
          sectionId: update.sectionId, 
          updatedAt 
        });
      }
    });

    set({ tasks: updatedTasks });
  };

  const getTasksBySection: TaskStore["getTasksBySection"] = (sectionId) => {
    return get().tasks.filter((t) => t.sectionId === sectionId);
  };

  const getTasksDueToday: TaskStore["getTasksDueToday"] = () => {
    const today = todayDateString();
    return get().tasks.filter((t) => {
      if (!t.dueDate) return false;
      return toDateOnlyString(t.dueDate) === today;
    });
  };

  const rolloverPastDueTasks: TaskStore["rolloverPastDueTasks"] = async () => {
    const today = todayDateString();
    const candidates = get().tasks.filter((t) => {
      if (!t.dueDate) return false;
      if (!isIncomplete(t)) return false;
      return toDateOnlyString(t.dueDate) < today;
    });

    if (candidates.length === 0) return;

    const updatedAt = new Date().toISOString();
    const updated = candidates.map((t) => ({
      ...t,
      dueDate: today,
      rolledOver: true,
      rolledOverFrom: toDateOnlyString(t.dueDate ?? today),
      updatedAt,
    }));

    await db.transaction("rw", db.tasks, async () => {
      await db.tasks.bulkPut(updated);
    });

    const byId = new Map(updated.map((t) => [t.id, t] as const));
    set({
      tasks: get().tasks.map((t) => byId.get(t.id) ?? t),
    });
  };

  void loadTasks();

  return {
    tasks: [],
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    getTasksBySection,
    getTasksDueToday,
    rolloverPastDueTasks,
  };
});

