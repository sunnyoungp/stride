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

    this.version(4).stores({
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

    this.version(5).stores({
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

    this.version(6).stores({
      tasks: "&id, dueDate, sectionId, projectId, sourceDocumentId, parentTaskId, status, subsectionId",
      sections: "&id",
      timeBlocks: "&id, taskId, startTime",
      dailyNotes: "&id, date",
      documents: "&id, projectId",
      projects: "&id",
      routineTemplates: "&id, pinned",
      taskSubsections: "&id, sectionId",
      deletedSections: "&id",
    }).upgrade(async (tx) => {
      const rows = await tx.table("routineTemplates").toArray() as any[];
      for (let i = 0; i < rows.length; i++) {
        const t = rows[i] as any;
        if (t.durationMinutes == null && t.startTime && t.endTime) {
          const [sh = 0, sm = 0] = (t.startTime as string).split(":").map(Number);
          const [eh = 0, em = 0] = (t.endTime as string).split(":").map(Number);
          let diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff <= 0) diff += 24 * 60;
          t.durationMinutes = diff;
          t.defaultStartTime = t.startTime as string;
        }
        if (t.order == null) t.order = i;
        if (t.pinned == null) t.pinned = true;
        delete t.startTime;
        delete t.endTime;
        await tx.table("routineTemplates").put(t);
      }
    });

    // v7 — force pinned: true on any templates where pinned is still undefined
    this.version(7).stores({
      tasks: "&id, dueDate, sectionId, projectId, sourceDocumentId, parentTaskId, status, subsectionId",
      sections: "&id",
      timeBlocks: "&id, taskId, startTime",
      dailyNotes: "&id, date",
      documents: "&id, projectId",
      projects: "&id",
      routineTemplates: "&id, pinned",
      taskSubsections: "&id, sectionId",
      deletedSections: "&id",
    }).upgrade(async (tx) => {
      const rows = await tx.table("routineTemplates").toArray() as any[];
      for (const t of rows) {
        if (t.pinned == null) {
          await tx.table("routineTemplates").put({ ...t, pinned: true });
        }
      }
    });

  } // end constructor
}

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