// src/types/index.ts
// THIS FILE IS THE SOURCE OF TRUTH. Do not let AI modify this file.

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "none" | "low" | "medium" | "high";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[];
  endDate?: string;
  endAfterOccurrences?: number;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  sectionId?: string;
  dueDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  rolledOver: boolean;
  rolledOverFrom?: string;
  recurrence?: RecurrenceRule;
  parentTaskId?: string;
  subtaskIds: string[];
  sourceDocumentId?: string;
  sourceDocumentTitle?: string;
  projectId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  subsectionId?: string;
}

export interface TaskSection {
  id: string;
  title: string;
  color?: string;
  icon?: string;
  order: number;
}

export interface TimeBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: "task" | "routine" | "event";
  taskId?: string;
  routineTemplateId?: string;
  color?: string;
}

export interface DailyNote {
  id: string;
  date: string;
  content: string;
  linkedTaskIds: string[];
}

export interface StrideDocument {
  id: string;
  title: string;
  content: string;
  projectId?: string;
  linkedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "archived";
  taskIds: string[];
  documentIds: string[];
  color?: string;
}

export interface RoutineTemplate {
  id: string;
  title: string;
  durationMinutes: number;
  defaultStartTime?: string;
  color: string;
  daysOfWeek: number[];
  isBuiltIn: boolean;
  icon?: string;
  pinned?: boolean;
  order: number;
}

export interface TaskSubsection {
  id: string
  title: string
  sectionId: string
  color?: string
  order: number
}