// Generates fresh demo data on every page load for portfolio visitors.
// Returns camelCase typed data for direct Zustand state injection.

import { setDemoTable, DEMO_USER_ID } from "./storage";
import type { Task, TaskSection, TimeBlock, DailyNote, StrideDocument, Project, RoutineTemplate } from "@/types/index";

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localISO(offsetDays: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const NOW = new Date().toISOString();

// ── Stable IDs ────────────────────────────────────────────────────────────────

const IDs = {
  sec:  { work: "demo-sec-work", personal: "demo-sec-personal", health: "demo-sec-health" },
  task: {
    roadmap: "demo-task-roadmap", prs: "demo-task-prs",
    docs: "demo-task-docs", docsA: "demo-task-docs-a", docsB: "demo-task-docs-b",
    sync: "demo-task-sync", audit: "demo-task-audit",
    flights: "demo-task-flights", parents: "demo-task-parents",
    run: "demo-task-run", meals: "demo-task-meals",
  },
  doc:  { roadmap: "demo-doc-roadmap", standup: "demo-doc-standup" },
  proj: { stride: "demo-proj-stride", client: "demo-proj-client" },
  tb:   {
    // Today
    sleepT: "demo-tb-sleep-0", morningT: "demo-tb-morning-0", workoutT: "demo-tb-workout-0",
    deepWork: "demo-tb-deep", sync: "demo-tb-sync", lunch0: "demo-tb-lunch-0", review: "demo-tb-review",
    // Tomorrow
    sleep1: "demo-tb-sleep-1", morning1: "demo-tb-morning-1", workout1: "demo-tb-workout-1",
    focus: "demo-tb-focus", lunch1: "demo-tb-lunch-1", plan: "demo-tb-plan",
    // Day after
    sleep2: "demo-tb-sleep-2", morning2: "demo-tb-morning-2", workout2: "demo-tb-workout-2",
    deep2: "demo-tb-deep-2", lunch2: "demo-tb-lunch-2", review2: "demo-tb-review-2",
    // Yesterday
    sleepY: "demo-tb-sleep-y", morningY: "demo-tb-morning-y", workoutY: "demo-tb-workout-y",
    deepY: "demo-tb-deep-y", lunchY: "demo-tb-lunch-y", reviewY: "demo-tb-review-y",
  },
  note: "demo-note-today",
  tmpl: { sleep: "demo-tmpl-sleep", morning: "demo-tmpl-morning", commute: "demo-tmpl-commute", workout: "demo-tmpl-workout", deep: "demo-tmpl-deep", lunch: "demo-tmpl-lunch" },
};

// ── Tiptap content helpers ────────────────────────────────────────────────────

const para  = (...texts: string[]) => ({ type: "paragraph", content: texts.map((t) => ({ type: "text", text: t })) });
const h     = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const li    = (text: string) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const ul    = (...items: string[]) => ({ type: "bulletList", content: items.map(li) });
const doc   = (...nodes: object[]) => JSON.stringify({ type: "doc", content: nodes });

// ── Builders ──────────────────────────────────────────────────────────────────

function buildSections(): TaskSection[] {
  return [
    { id: IDs.sec.work,     title: "Work",     icon: "💼", color: "blue",  order: 0 },
    { id: IDs.sec.personal, title: "Personal", icon: "🏠", color: "green", order: 1 },
    { id: IDs.sec.health,   title: "Health",   icon: "🏃", color: "red",   order: 2 },
  ];
}

function buildTasks(): Task[] {
  const today      = todayStr();
  const tomorrow   = offsetDate(1);
  const in3Days    = offsetDate(3);
  const nextSunday = offsetDate(7 - new Date().getDay() || 7);

  const base = (
    id: string, title: string, sectionId: string, overrides: Partial<Task> = {},
  ): Task => ({
    id, title, notes: "", status: "todo", priority: "none", tags: [], sectionId,
    rolledOver: false, subtaskIds: [], order: 0, createdAt: NOW, updatedAt: NOW,
    ...overrides,
  });

  return [
    base(IDs.task.roadmap, "Finalize Q2 roadmap slides", IDs.sec.work, {
      priority: "high", dueDate: today, order: 0,
      notes: "Presentation is Thursday. Need exec summary + timeline slide.",
    }),
    base(IDs.task.prs, "Review open pull requests", IDs.sec.work, {
      priority: "medium", dueDate: today, order: 1,
    }),
    base(IDs.task.docs, "Update API documentation", IDs.sec.work, {
      priority: "low", order: 2,
      subtaskIds: [IDs.task.docsA, IDs.task.docsB],
    }),
    base(IDs.task.docsA, "Add authentication endpoints section", IDs.sec.work, {
      parentTaskId: IDs.task.docs, order: 0,
    }),
    base(IDs.task.docsB, "Add rate limiting details", IDs.sec.work, {
      parentTaskId: IDs.task.docs, order: 1,
    }),
    base(IDs.task.sync, "Schedule 1:1 with team leads", IDs.sec.work, {
      priority: "medium", dueDate: tomorrow, order: 3,
    }),
    base(IDs.task.audit, "Design system audit", IDs.sec.work, {
      status: "done", order: 4,
    }),
    base(IDs.task.flights, "Book summer flights ✈️", IDs.sec.personal, {
      priority: "medium", dueDate: in3Days, order: 0,
    }),
    base(IDs.task.parents, "Call parents this weekend", IDs.sec.personal, {
      order: 1,
    }),
    base(IDs.task.run, "Morning run – 5 km", IDs.sec.health, {
      priority: "medium", dueDate: today, order: 0,
    }),
    base(IDs.task.meals, "Prep meals for the week", IDs.sec.health, {
      priority: "low", dueDate: nextSunday, order: 1,
    }),
  ];
}

function buildDocuments(): StrideDocument[] {
  return [
    {
      id: IDs.doc.roadmap, title: "Q2 Roadmap Notes",
      content: doc(
        h(1, "Q2 Roadmap Notes"),
        para("Key themes this quarter: performance, mobile, and developer experience."),
        h(2, "Priorities"),
        ul(
          "Ship the new calendar view by end of April",
          "Improve task load time by 40%",
          "Add iOS Shortcuts integration",
          "Kanban board column reordering (shipped ✓)",
        ),
        h(2, "Open questions"),
        para("Should we prioritize the API or the mobile app first? Discuss with stakeholders Thu."),
      ),
      projectId: IDs.proj.stride, linkedTaskIds: [IDs.task.roadmap],
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: IDs.doc.standup, title: "Daily Standup Template",
      content: doc(
        h(1, "Daily Standup"),
        h(2, "Yesterday"), para("What did you complete?"),
        h(2, "Today"),     para("What are you working on?"),
        h(2, "Blockers"),  para("Anything blocking progress?"),
      ),
      linkedTaskIds: [], createdAt: NOW, updatedAt: NOW,
    },
  ];
}

function buildProjects(): Project[] {
  return [
    {
      id: IDs.proj.stride, title: "Stride App",
      description: "The productivity app itself",
      status: "active",
      taskIds: [IDs.task.roadmap, IDs.task.prs, IDs.task.docs],
      documentIds: [IDs.doc.roadmap],
    },
    {
      id: IDs.proj.client, title: "Client Redesign",
      status: "active", taskIds: [], documentIds: [],
    },
  ];
}

function buildTimeBlocks(): TimeBlock[] {
  return [
    // ── Yesterday ──
    { id: IDs.tb.sleepY,    title: "Sleep",            startTime: localISO(-1, 22),    endTime: localISO(0, 6),      type: "routine", routineTemplateId: IDs.tmpl.sleep,   color: "#52525b" },
    { id: IDs.tb.morningY,  title: "Morning Routine",  startTime: localISO(-1, 7),     endTime: localISO(-1, 8, 30), type: "routine", routineTemplateId: IDs.tmpl.morning, color: "#f59e0b" },
    { id: IDs.tb.workoutY,  title: "Workout",          startTime: localISO(-1, 6),     endTime: localISO(-1, 7),     type: "routine", routineTemplateId: IDs.tmpl.workout, color: "#22c55e" },
    { id: IDs.tb.deepY,     title: "Deep Work",        startTime: localISO(-1, 9),     endTime: localISO(-1, 12),    type: "event",   color: "#3b82f6" },
    { id: IDs.tb.lunchY,    title: "Lunch Break",      startTime: localISO(-1, 12),    endTime: localISO(-1, 13),    type: "routine", routineTemplateId: IDs.tmpl.lunch,   color: "#f97316" },
    { id: IDs.tb.reviewY,   title: "Code Review",      startTime: localISO(-1, 14),    endTime: localISO(-1, 15),    type: "event",   color: "#f97316" },

    // ── Today ──
    { id: IDs.tb.sleepT,    title: "Sleep",            startTime: localISO(0, 22),     endTime: localISO(1, 6),      type: "routine", routineTemplateId: IDs.tmpl.sleep,   color: "#52525b" },
    { id: IDs.tb.morningT,  title: "Morning Routine",  startTime: localISO(0, 7),      endTime: localISO(0, 8, 30),  type: "routine", routineTemplateId: IDs.tmpl.morning, color: "#f59e0b" },
    { id: IDs.tb.workoutT,  title: "Workout",          startTime: localISO(0, 6),      endTime: localISO(0, 7),      type: "routine", routineTemplateId: IDs.tmpl.workout, color: "#22c55e" },
    { id: IDs.tb.deepWork,  title: "Deep Work",        startTime: localISO(0, 9),      endTime: localISO(0, 12),     type: "event",   color: "#3b82f6" },
    { id: IDs.tb.lunch0,    title: "Lunch Break",      startTime: localISO(0, 12),     endTime: localISO(0, 13),     type: "routine", routineTemplateId: IDs.tmpl.lunch,   color: "#f97316" },
    { id: IDs.tb.sync,      title: "Team Sync",        startTime: localISO(0, 14),     endTime: localISO(0, 14, 30), type: "event",   color: "#8b5cf6" },
    { id: IDs.tb.review,    title: "Code Review",      startTime: localISO(0, 15),     endTime: localISO(0, 16),     type: "event",   color: "#f97316" },

    // ── Tomorrow ──
    { id: IDs.tb.sleep1,    title: "Sleep",            startTime: localISO(1, 22),     endTime: localISO(2, 6),      type: "routine", routineTemplateId: IDs.tmpl.sleep,   color: "#52525b" },
    { id: IDs.tb.morning1,  title: "Morning Routine",  startTime: localISO(1, 7),      endTime: localISO(1, 8, 30),  type: "routine", routineTemplateId: IDs.tmpl.morning, color: "#f59e0b" },
    { id: IDs.tb.workout1,  title: "Workout",          startTime: localISO(1, 6),      endTime: localISO(1, 7),      type: "routine", routineTemplateId: IDs.tmpl.workout, color: "#22c55e" },
    { id: IDs.tb.focus,     title: "Focus Block",      startTime: localISO(1, 9),      endTime: localISO(1, 11),     type: "event",   color: "#3b82f6" },
    { id: IDs.tb.lunch1,    title: "Lunch Break",      startTime: localISO(1, 12),     endTime: localISO(1, 13),     type: "routine", routineTemplateId: IDs.tmpl.lunch,   color: "#f97316" },
    { id: IDs.tb.plan,      title: "Planning Session", startTime: localISO(1, 13),     endTime: localISO(1, 14),     type: "event",   color: "#22c55e" },

    // ── Day after tomorrow ──
    { id: IDs.tb.sleep2,    title: "Sleep",            startTime: localISO(2, 22),     endTime: localISO(3, 6),      type: "routine", routineTemplateId: IDs.tmpl.sleep,   color: "#52525b" },
    { id: IDs.tb.morning2,  title: "Morning Routine",  startTime: localISO(2, 7),      endTime: localISO(2, 8, 30),  type: "routine", routineTemplateId: IDs.tmpl.morning, color: "#f59e0b" },
    { id: IDs.tb.workout2,  title: "Workout",          startTime: localISO(2, 6),      endTime: localISO(2, 7),      type: "routine", routineTemplateId: IDs.tmpl.workout, color: "#22c55e" },
    { id: IDs.tb.deep2,     title: "Deep Work",        startTime: localISO(2, 9),      endTime: localISO(2, 12),     type: "event",   color: "#3b82f6" },
    { id: IDs.tb.lunch2,    title: "Lunch Break",      startTime: localISO(2, 12),     endTime: localISO(2, 13),     type: "routine", routineTemplateId: IDs.tmpl.lunch,   color: "#f97316" },
    { id: IDs.tb.review2,   title: "Code Review",      startTime: localISO(2, 14),     endTime: localISO(2, 15, 30), type: "event",   color: "#f97316" },
  ];
}

function buildDailyNote(): DailyNote {
  return {
    id: IDs.note, date: todayStr(),
    content: doc(
      h(2, "Morning check-in"),
      para("Big day — Q2 roadmap prep. Keep the head down until noon."),
      h(3, "Focus for today"),
      ul("Finish the executive summary slide", "Merge the auth PR before standup", "30-min run before dinner"),
      h(3, "Feeling"),
      para("Rested. Ready to push."),
    ),
    linkedTaskIds: [],
  };
}

function buildTemplates(): RoutineTemplate[] {
  return [
    { id: IDs.tmpl.sleep,   title: "Sleep",           durationMinutes: 480, defaultStartTime: "22:00", color: "#52525b", icon: "😴", daysOfWeek: [], isBuiltIn: true, pinned: true, order: 0 },
    { id: IDs.tmpl.morning, title: "Morning Routine", durationMinutes: 90,  defaultStartTime: "07:00", color: "#f59e0b", icon: "🌅", daysOfWeek: [], isBuiltIn: true, pinned: true, order: 1 },
    { id: IDs.tmpl.commute, title: "Commute",         durationMinutes: 30,  defaultStartTime: "08:30", color: "#64748b", icon: "🚌", daysOfWeek: [], isBuiltIn: true, pinned: true, order: 2 },
    { id: IDs.tmpl.workout, title: "Workout",         durationMinutes: 60,  defaultStartTime: "06:00", color: "#22c55e", icon: "🏋️", daysOfWeek: [], isBuiltIn: true, pinned: true, order: 3 },
    { id: IDs.tmpl.deep,    title: "Deep Work",       durationMinutes: 180, defaultStartTime: "09:00", color: "#3b82f6", icon: "🧠", daysOfWeek: [], isBuiltIn: true, pinned: true, order: 4 },
    { id: IDs.tmpl.lunch,   title: "Lunch Break",     durationMinutes: 60,  defaultStartTime: "12:00", color: "#f97316", icon: "🥗", daysOfWeek: [], isBuiltIn: true, pinned: true, order: 5 },
  ];
}

// ── Row converters (camelCase → snake_case for localStorage) ──────────────────

function taskRow(t: Task): Record<string, unknown> {
  return {
    id: t.id, user_id: DEMO_USER_ID, title: t.title, notes: t.notes,
    status: t.status, priority: t.priority, tags: t.tags,
    section_id: t.sectionId ?? null, due_date: t.dueDate ?? null,
    scheduled_start: t.scheduledStart ?? null, scheduled_end: t.scheduledEnd ?? null,
    rolled_over: t.rolledOver, rolled_over_from: t.rolledOverFrom ?? null,
    recurrence: t.recurrence ?? null, parent_task_id: t.parentTaskId ?? null,
    subtask_ids: t.subtaskIds, source_document_id: t.sourceDocumentId ?? null,
    source_document_title: t.sourceDocumentTitle ?? null, project_id: t.projectId ?? null,
    order: t.order, subsection_id: t.subsectionId ?? null,
    created_at: t.createdAt, updated_at: t.updatedAt,
  };
}

function sectionRow(s: TaskSection): Record<string, unknown> {
  return { id: s.id, user_id: DEMO_USER_ID, title: s.title, color: s.color ?? null, icon: s.icon ?? null, order: s.order };
}

function docRow(d: StrideDocument): Record<string, unknown> {
  return { id: d.id, user_id: DEMO_USER_ID, title: d.title, content: d.content, project_id: d.projectId ?? null, linked_task_ids: d.linkedTaskIds, created_at: d.createdAt, updated_at: d.updatedAt };
}

function projectRow(p: Project): Record<string, unknown> {
  return { id: p.id, user_id: DEMO_USER_ID, title: p.title, description: p.description ?? null, status: p.status, task_ids: p.taskIds, document_ids: p.documentIds, color: p.color ?? null };
}

function timeBlockRow(b: TimeBlock): Record<string, unknown> {
  return { id: b.id, user_id: DEMO_USER_ID, title: b.title, start_time: b.startTime, end_time: b.endTime, type: b.type, task_id: b.taskId ?? null, routine_template_id: b.routineTemplateId ?? null, color: b.color ?? null };
}

function noteRow(n: DailyNote): Record<string, unknown> {
  return { id: n.id, user_id: DEMO_USER_ID, date: n.date, content: n.content, linked_task_ids: n.linkedTaskIds };
}

function templateRow(t: RoutineTemplate): Record<string, unknown> {
  return { id: t.id, user_id: DEMO_USER_ID, title: t.title, duration_minutes: t.durationMinutes, default_start_time: t.defaultStartTime ?? null, color: t.color, days_of_week: t.daysOfWeek, is_built_in: t.isBuiltIn, icon: t.icon ?? null, pinned: t.pinned ?? null, order: t.order };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type DemoData = {
  sections:   TaskSection[];
  tasks:      Task[];
  documents:  StrideDocument[];
  projects:   Project[];
  timeBlocks: TimeBlock[];
  dailyNotes: DailyNote[];
  templates:  RoutineTemplate[];
};

/**
 * Ensures demo data exists in localStorage and returns the current state
 * as camelCase typed data ready for direct Zustand state injection.
 *
 * Always generates fresh demo data on every call (no persistence across refreshes).
 * Data is also written to localStorage demo tables so the supabase proxy can
 * serve CRUD operations during the session.
 */
export function initDemoData(): DemoData {
  const sections   = buildSections();
  const tasks      = buildTasks();
  const documents  = buildDocuments();
  const projects   = buildProjects();
  const timeBlocks = buildTimeBlocks();
  const dailyNotes = [buildDailyNote()];
  const templates  = buildTemplates();

  setDemoTable("sections",          sections.map(sectionRow));
  setDemoTable("deleted_sections",  []);
  setDemoTable("task_subsections",  []);
  setDemoTable("tasks",             tasks.map(taskRow));
  setDemoTable("documents",         documents.map(docRow));
  setDemoTable("projects",          projects.map(projectRow));
  setDemoTable("time_blocks",       timeBlocks.map(timeBlockRow));
  setDemoTable("daily_notes",       dailyNotes.map(noteRow));
  setDemoTable("routine_templates", templates.map(templateRow));

  // Always set demo mode to PST
  localStorage.setItem("stride-timezone", "America/Los_Angeles");

  return { sections, tasks, documents, projects, timeBlocks, dailyNotes, templates };
}
