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

export class StrideDB extends Dexie {
  tasks!: Table<Task, string>;
  sections!: Table<TaskSection, string>;
  timeBlocks!: Table<TimeBlock, string>;
  dailyNotes!: Table<DailyNote, string>;
  documents!: Table<StrideDocument, string>;
  projects!: Table<Project, string>;
  routineTemplates!: Table<RoutineTemplate, string>;
  taskSubsections!: Table<any, string>;

  constructor() {
    super("StrideDB");

    this.version(2).stores({
      tasks:
        "&id, dueDate, sectionId, projectId, sourceDocumentId, parentTaskId, status, subsectionId",
      sections: "&id",
      timeBlocks: "&id, taskId, startTime",
      dailyNotes: "&id, date",
      documents: "&id, projectId",
      projects: "&id",
      routineTemplates: "&id",
      taskSubsections: "&id, sectionId",
    });
  }
}

export const db = new StrideDB();

