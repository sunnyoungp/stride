"use client";

import Dexie, { type Table } from "dexie";

import type {
  DailyNote,
  Project,
  RoutineTemplate,
  StrideDocument,
  Task,
  TaskSection,
  TimeBlock,
} from "@/types/index";

export interface DeletedSection extends TaskSection {
  deletedAt: string;
}

export class StrideDB extends Dexie {
  tasks!: Table<Task, string>;
  sections!: Table<TaskSection, string>;
  timeBlocks!: Table<TimeBlock, string>;
  dailyNotes!: Table<DailyNote, string>;
  documents!: Table<StrideDocument, string>;
  projects!: Table<Project, string>;
  routineTemplates!: Table<RoutineTemplate, string>;
  taskSubsections!: Table<any, string>;
  deletedSections!: Table<DeletedSection, string>;

  constructor() {
    super("StrideDB");

    this.version(2).stores({
      tasks: "&id, dueDate, sectionId, projectId, sourceDocumentId, parentTaskId, status, subsectionId",
      sections: "&id",
      timeBlocks: "&id, taskId, startTime",
      dailyNotes: "&id, date",
      documents: "&id, projectId",
      projects: "&id",
      routineTemplates: "&id",
      taskSubsections: "&id, sectionId",
    });

    this.version(3).stores({
      tasks: "&id, dueDate, sectionId, projectId, sourceDocumentId, parentTaskId, status, subsectionId",
      sections: "&id",
      timeBlocks: "&id, taskId, startTime",
      dailyNotes: "&id, date",
      documents: "&id, projectId",
      projects: "&id",
      routineTemplates: "&id",
      taskSubsections: "&id, sectionId",
      deletedSections: "&id",
    });
  }
}

// Lazy initialization to avoid SSR issues
let innerDb: StrideDB | null = null;

export const db = new Proxy({} as StrideDB, {
  get(_, prop) {
    if (typeof window === "undefined") {
      return undefined;
    }
    if (!innerDb) {
      innerDb = new StrideDB();
    }
    return (innerDb as any)[prop];
  },
});
