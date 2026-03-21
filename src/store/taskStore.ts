"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types/index";
import { generateNextRecurringInstance } from "@/lib/recurrence";
import { useDocumentStore } from "./documentStore";

const supabase = createClient();

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function taskFromRow(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    notes: (row.notes as string) ?? "",
    status: row.status as Task["status"],
    priority: row.priority as Task["priority"],
    tags: (row.tags as string[]) ?? [],
    sectionId: (row.section_id as string | null) ?? undefined,
    dueDate: (row.due_date as string | null) ?? undefined,
    scheduledStart: (row.scheduled_start as string | null) ?? undefined,
    scheduledEnd: (row.scheduled_end as string | null) ?? undefined,
    rolledOver: (row.rolled_over as boolean) ?? false,
    rolledOverFrom: (row.rolled_over_from as string | null) ?? undefined,
    recurrence: (row.recurrence as Task["recurrence"] | null) ?? undefined,
    parentTaskId: (row.parent_task_id as string | null) ?? undefined,
    subtaskIds: (row.subtask_ids as string[]) ?? [],
    sourceDocumentId: (row.source_document_id as string | null) ?? undefined,
    sourceDocumentTitle: (row.source_document_title as string | null) ?? undefined,
    projectId: (row.project_id as string | null) ?? undefined,
    order: (row.order as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    subsectionId: (row.subsection_id as string | null) ?? undefined,
  };
}

function taskToRow(t: Task, userId: string): Record<string, unknown> {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    status: t.status,
    priority: t.priority,
    tags: t.tags,
    section_id: t.sectionId ?? null,
    due_date: t.dueDate ?? null,
    scheduled_start: t.scheduledStart ?? null,
    scheduled_end: t.scheduledEnd ?? null,
    rolled_over: t.rolledOver,
    rolled_over_from: t.rolledOverFrom ?? null,
    recurrence: t.recurrence ?? null,
    parent_task_id: t.parentTaskId ?? null,
    subtask_ids: t.subtaskIds,
    source_document_id: t.sourceDocumentId ?? null,
    source_document_title: t.sourceDocumentTitle ?? null,
    project_id: t.projectId ?? null,
    order: t.order,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    subsection_id: t.subsectionId ?? null,
    user_id: userId,
  };
}

// Maps only the provided camelCase change keys to snake_case for partial updates
function taskChangesToRow(changes: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("title" in changes) row.title = changes.title;
  if ("notes" in changes) row.notes = changes.notes;
  if ("status" in changes) row.status = changes.status;
  if ("priority" in changes) row.priority = changes.priority;
  if ("tags" in changes) row.tags = changes.tags;
  if ("sectionId" in changes) row.section_id = changes.sectionId ?? null;
  if ("dueDate" in changes) row.due_date = changes.dueDate ?? null;
  if ("scheduledStart" in changes) row.scheduled_start = changes.scheduledStart ?? null;
  if ("scheduledEnd" in changes) row.scheduled_end = changes.scheduledEnd ?? null;
  if ("rolledOver" in changes) row.rolled_over = changes.rolledOver;
  if ("rolledOverFrom" in changes) row.rolled_over_from = changes.rolledOverFrom ?? null;
  if ("recurrence" in changes) row.recurrence = changes.recurrence ?? null;
  if ("parentTaskId" in changes) row.parent_task_id = changes.parentTaskId ?? null;
  if ("subtaskIds" in changes) row.subtask_ids = changes.subtaskIds;
  if ("sourceDocumentId" in changes) row.source_document_id = changes.sourceDocumentId ?? null;
  if ("sourceDocumentTitle" in changes) row.source_document_title = changes.sourceDocumentTitle ?? null;
  if ("projectId" in changes) row.project_id = changes.projectId ?? null;
  if ("order" in changes) row.order = changes.order;
  if ("subsectionId" in changes) row.subsection_id = changes.subsectionId ?? null;
  return row;
}

// ── Store ──────────────────────────────────────────────────────────────────────

type TaskStore = {
  tasks: Task[];
  isLoading: boolean;
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isIncomplete(task: Task): boolean {
  return task.status !== "done" && task.status !== "cancelled";
}

export const useTaskStore = create<TaskStore>((set, get) => {
  const loadTasks: TaskStore["loadTasks"] = async () => {
    try {
      const { data: rows, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      const tasks = (rows ?? []).map(taskFromRow);
      set({ tasks });
      await get().rolloverPastDueTasks();
    } catch (error) {
      console.error("Failed to load tasks:", error);
      set({ tasks: [] });
    } finally {
      set({ isLoading: false });
    }
  };

  const createTask: TaskStore["createTask"] = async (data) => {
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");
    const now = new Date().toISOString();
    const currentTasks = get().tasks;

    let inheritedDueDate = data.dueDate;
    if (data.parentTaskId) {
      const parent = currentTasks.find((t) => t.id === data.parentTaskId);
      if (parent?.dueDate) inheritedDueDate = parent.dueDate;
    }

    const task: Task = {
      id: crypto.randomUUID(),
      title: data.title ?? "",
      notes: data.notes ?? "",
      status: data.status ?? "todo",
      priority: data.priority ?? (
        typeof window !== "undefined"
          ? (localStorage.getItem("stride-default-priority") as Task["priority"] ?? "none")
          : "none"
      ),
      tags: data.tags ?? [],
      sectionId: data.sectionId,
      dueDate: inheritedDueDate,
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
      order: data.order ?? currentTasks.filter((t) => t.sectionId === data.sectionId).length,
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase.from("tasks").insert(taskToRow(task, userId));
    if (error) console.error("Failed to create task:", error);
    set({ tasks: [...currentTasks, task] });
    return task;
  };

  const updateTask: TaskStore["updateTask"] = async (id, changes) => {
    const currentState = get();
    const originalTask = currentState.tasks.find((t) => t.id === id);
    if (!originalTask) return;

    const updatedAt = new Date().toISOString();
    const subtaskIds = originalTask.subtaskIds ?? [];
    const shouldSyncSubtasks = !!(changes.dueDate && subtaskIds.length > 0);

    const row = { ...taskChangesToRow(changes), updated_at: updatedAt };
    const { error } = await supabase.from("tasks").update(row).eq("id", id);
    if (error) console.error("Failed to update task:", error);

    if (shouldSyncSubtasks && changes.dueDate) {
      for (const subId of subtaskIds) {
        await supabase
          .from("tasks")
          .update({ due_date: changes.dueDate, updated_at: updatedAt })
          .eq("id", subId);
      }
    }

    set({
      tasks: currentState.tasks.map((t) => {
        if (t.id === id) return { ...t, ...changes, updatedAt };
        if (shouldSyncSubtasks && subtaskIds.includes(t.id)) {
          return { ...t, dueDate: changes.dueDate, updatedAt };
        }
        return t;
      }),
    });

    if (changes.status === "done" && originalTask.recurrence) {
      const nextInstance = generateNextRecurringInstance(originalTask);
      if (nextInstance.dueDate) {
        await get().createTask(nextInstance);
      }
    }
  };

  const deleteTask: TaskStore["deleteTask"] = async (id) => {
    const docStore = useDocumentStore.getState();
    const affectedDocs = docStore.documents.filter(
      (d) => d.linkedTaskIds && d.linkedTaskIds.includes(id),
    );
    for (const doc of affectedDocs) {
      const nextLinked = doc.linkedTaskIds.filter((tid) => tid !== id);
      await docStore.updateDocument(doc.id, { linkedTaskIds: nextLinked });
    }
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) console.error("Failed to delete task:", error);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  };

  const reorderTasks: TaskStore["reorderTasks"] = async (updates) => {
    const updatedAt = new Date().toISOString();
    const currentTasks = get().tasks;

    for (const update of updates) {
      await supabase
        .from("tasks")
        .update({ order: update.order, section_id: update.sectionId ?? null, updated_at: updatedAt })
        .eq("id", update.id);
    }

    set({
      tasks: currentTasks.map((t) => {
        const update = updates.find((u) => u.id === t.id);
        if (update) {
          return { ...t, order: update.order, sectionId: update.sectionId ?? t.sectionId, updatedAt };
        }
        return t;
      }),
    });
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
    const autoRollover = typeof window !== "undefined"
      ? localStorage.getItem("stride-auto-rollover") !== "false"
      : true;
    if (!autoRollover) return;

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

    for (const task of updated) {
      await supabase
        .from("tasks")
        .update({
          due_date: task.dueDate,
          rolled_over: true,
          rolled_over_from: task.rolledOverFrom,
          updated_at: updatedAt,
        })
        .eq("id", task.id);
    }

    const byId = new Map(updated.map((t) => [t.id, t] as const));
    set({ tasks: get().tasks.map((t) => byId.get(t.id) ?? t) });
  };

  if (typeof window !== "undefined") void loadTasks();

  return {
    tasks: [],
    isLoading: true,
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
