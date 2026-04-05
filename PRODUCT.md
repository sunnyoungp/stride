# Stride — Product Architecture & Feature Spec
# READ THIS FILE BEFORE TOUCHING ANY CODE.
# Every bug fix and feature must be consistent with the architecture described here.

---

## 1. App Overview

Stride is a productivity desktop app (Next.js + Tauri) with five core modules:
- **Tasks** — section-based task manager with Kanban, subtasks, priorities, due dates
- **Calendar** — time-blocking calendar with routines and events
- **Documents** — rich text editor (TipTap), linked to tasks
- **Notes** — daily notes (TipTap), with task checklist blocks
- **Focus** — Pomodoro focus mode with dynamic island pill

Stack: Next.js 14 (App Router, static export), TypeScript, Tailwind CSS, Supabase (Postgres), Zustand, TipTap, dnd-kit, Tauri 2.0.

---

## 2. Data Model (source of truth: `src/types/index.ts` — DO NOT MODIFY)

### Task
```
id, title, notes, status (todo|in_progress|done|cancelled), priority (none|low|medium|high)
tags[], sectionId?, dueDate?, scheduledStart?, scheduledEnd?
rolledOver, rolledOverFrom?, recurrence? (RecurrenceRule)
parentTaskId?,      ← if set, this task is a subtask
subtaskIds[],       ← ordered list of child task IDs (order stored here, NOT in child's `order` field)
sourceDocumentId?, sourceDocumentTitle?, projectId?
order, createdAt, updatedAt, subsectionId?
```

### TaskSection
```
id, title, color?, icon?, order, hidden?
```

### StrideDocument
```
id, title, content (TipTap JSON string), projectId?, linkedTaskIds[], createdAt, updatedAt
```

### DailyNote
```
id, date (YYYY-MM-DD), content (TipTap JSON string), linkedTaskIds[]
```

### Project
```
id, title, description?, status (active|completed|archived), taskIds[], documentIds[], color?
```

### RoutineTemplate
```
id, title, durationMinutes, defaultStartTime?, color, daysOfWeek[], isBuiltIn, icon?, pinned?, order
```

### TimeBlock
```
id, title, startTime, endTime, type (task|routine|event), taskId?, routineTemplateId?, color?, allDay?
```

---

## 3. Store Architecture (Zustand — `src/store/`)

### `taskStore.ts` — PRIMARY TASK STATE
- `tasks: Task[]` — ALL tasks flat in one array (parent and subtask alike)
- `loadTasks()` — fetches from Supabase, then runs `rolloverPastDueTasks()`
- `createTask(data)` → inserts to DB + optimistic local add
- `updateTask(id, changes)` → partial update; auto-clears `parentTaskId` if `sectionId` changes cross-section; cascades `done` to subtasks; generates next recurrence instance on complete
- `deleteTask(id)` → removes from parent's `subtaskIds`; removes from document `linkedTaskIds`; deletes from DB
- `reorderTasks(updates[])` → bulk order/section update; handles subtask reparenting on section move
- `getTasksBySection(sectionId)` → filter helper
- `getTasksDueToday()` → filter helper

**⚠️ SUBTASK ORDERING RULE:** Subtask order is stored in `parent.subtaskIds[]`. When reordering subtasks, call `updateTask(parentId, { subtaskIds: [...] })`. Never use `reorderTasks` for subtask ordering.

**⚠️ SECTION CHANGE RULE:** Moving a subtask to a different section auto-promotes it to standalone (clears `parentTaskId`, removes from parent's `subtaskIds`).

### `sectionStore.ts` — SECTION STATE
- Sections used as grouping in all task views and Kanban columns (when `groupBy === "list"`)
- `updateSection({ order })` used for Kanban column reorder

### `documentStore.ts` — DOCUMENT STATE
- `documents: StrideDocument[]`
- `createDocument(title)` → empty TipTap doc
- `updateDocument(id, changes)` → guards against empty content overwrites
- `deleteDocument(id)` → also deletes all `linkedTaskIds` tasks from DB, then reloads tasks
- `cleanOrphanedTaskRefs()` → runs on load; removes stale task IDs from `linkedTaskIds`

### `dailyNoteStore.ts` — DAILY NOTE STATE
- One note per calendar date (YYYY-MM-DD key)
- Content is TipTap JSON

### `uiStore.ts` — MINIMAL GLOBAL UI
- Only: `isSearchOpen`, `openSearch`, `closeSearch`
- All other UI state is local component state

### `focusStore.ts` — FOCUS MODE STATE
- Pomodoro session, selected tasks, timer state

### `routineTemplateStore.ts` — ROUTINE TEMPLATES
- Templates draggable onto Calendar to create TimeBlocks

### `timeBlockStore.ts` — CALENDAR TIME BLOCKS
- TimeBlocks displayed on Calendar view

### `projectStore.ts` — PROJECTS (currently underspecified — see Section 8)

### `dragStore.ts` — DRAG STATE
- Cross-component drag coordination (e.g. DailyNote → MiniCalendar)

### `shortcutStore.ts` — KEYBOARD SHORTCUTS

---

## 4. Component Dependency Map

### Pages → Components

```
/app/page.tsx (Dashboard)
  └─ TaskListView          ← task list (list view)
  └─ MiniCalendar          ← small calendar, drop target for task drags
  └─ DailyNote             ← TipTap editor for today's note
  └─ FocusPill             ← persistent focus mode pill

/app/inbox/page.tsx
  └─ TaskListView          ← list view (same component as Dashboard)
  └─ KanbanBoard           ← kanban view (toggled)

/app/tasks/page.tsx
  └─ TaskListView          ← list view
  └─ KanbanBoard           ← kanban view

/app/next7/page.tsx (Next 7 Days)
  └─ TaskListView (via DroppableDateGroup) ← grouped by date
  └─ KanbanBoard

/app/calendar/page.tsx
  └─ CalendarView          ← FullCalendar wrapper
  └─ RoutineTemplateStrip  ← draggable routine chips
  └─ RoutineTemplatePanel  ← mobile bottom sheet for routines
  └─ EventPanel            ← event detail panel
  └─ MiniCalendar          ← date navigation

/app/documents/page.tsx
  └─ DocumentList          ← sidebar list of documents
  └─ DocumentEditor        ← TipTap editor (selected doc inline)

/app/documents/[id]/page.tsx
  └─ DocumentPageClient    ← full-page document view
      └─ DocumentEditor

/app/notes/page.tsx
  └─ DailyNote             ← TipTap notes editor
  └─ MiniCalendar          ← date picker + drop target
```

### Shared Components (used across multiple pages)

```
TaskListView.tsx
  ├─ reads:  taskStore, sectionStore
  ├─ uses:   TaskRow (inline), TaskContextMenu, SectionContextMenu
  ├─ uses:   KanbanBoard (toggled)
  └─ CANONICAL REFERENCE for task row design

TaskList.tsx
  ├─ contains: TaskRow, TaskSelectionProvider, ConnectedTaskContextMenu
  ├─ contains: RescheduleDatePopover (viewport-aware date picker — use this, never <input type="date">)
  └─ exports:  ConnectedTaskContextMenu, TaskSelectionProvider, SelectionContext

KanbanBoard.tsx
  ├─ reads:  taskStore, sectionStore
  ├─ used on: Inbox, Tasks, Next7Days pages
  └─ ⚠️ Changes here affect ALL THREE pages

DailyNote.tsx
  ├─ reads:  dailyNoteStore, taskStore
  ├─ TipTap editor with custom xChecklist extension
  ├─ Drag source: task checklist blocks → MiniCalendar drop target
  └─ used on: Dashboard, Notes pages

MiniCalendar.tsx
  ├─ reads:  taskStore (for due date updates on drop)
  ├─ Drop target for task drags from DailyNote
  └─ used on: Dashboard, Notes pages

DocumentEditor.tsx
  ├─ reads:  documentStore
  ├─ TipTap editor — always editable (no lock/readonly mode)
  └─ uses:   EditorBubbleMenu, SlashCommandMenu, FormatPanel

CalendarView.tsx
  ├─ reads:  timeBlockStore, routineTemplateStore, taskStore
  └─ FullCalendar with custom time block rendering

Sidebar.tsx
  ├─ reads:  documentStore, projectStore, sectionStore
  ├─ nav + document list + project list
  └─ context menu: ProjectContextMenu, DocumentContextMenu

GlobalShortcuts.tsx
  ├─ reads:  shortcutStore, uiStore
  └─ handles: Cmd+K (QuickAdd), Cmd+F (search), etc.

QuickAdd.tsx
  ├─ reads:  taskStore, sectionStore, documentStore
  └─ triggered by Cmd+K
```

---

## 5. Critical Data Flow Rules

### Task CRUD flow
```
UI action → taskStore.createTask/updateTask/deleteTask → optimistic local state update → Supabase write
```
Never write directly to Supabase from a component. Always go through the store.

### Subtask relationship
```
Parent task: { subtaskIds: ["child1", "child2"] }
Child task:  { parentTaskId: "parent-id", sectionId: SAME as parent }
```
- Subtasks always share the parent's `sectionId`
- Moving a subtask to a different section auto-promotes it to standalone
- Deleting a parent does NOT cascade-delete subtasks (they become orphaned standalone tasks)
- Completing a parent marks all subtasks done

### Document ↔ Task link
```
Document: { linkedTaskIds: ["task1", "task2"] }
Task:      { sourceDocumentId: "doc-id", sourceDocumentTitle: "..." }
```
- Tasks created from a document checklist get `sourceDocumentId` set
- Deleting a document deletes all its `linkedTaskIds` tasks
- `cleanOrphanedTaskRefs()` runs on document load to remove stale refs

### Drag and drop
- **Task rows (list view):** dnd-kit SortableContext, flat array `[parent, sub1, sub2, nextParent, ...]`
- **Kanban cards:** dnd-kit, column reorder via `onColumnReorder` prop (only when `groupBy === "list"`)
- **DailyNote → MiniCalendar:** HTML5 drag API via `dragStore`, sets `dueDate` on drop
- **Routine chip → Calendar:** FullCalendar external draggable, creates TimeBlock on drop

---

## 6. Feature Specs — Current Bugs to Fix

Read this section before touching any bug. Each spec defines the problem, root cause hypothesis, and acceptance criteria.

---

### BUG-01: Drag and drop from DailyNote broken

**What breaks:** Dragging a task checklist block from DailyNote onto MiniCalendar does not update the task's due date.

**Architecture involved:** `DailyNote.tsx` (drag source) → `dragStore.ts` (shared drag state) → `MiniCalendar.tsx` (drop target)

**Root cause hypothesis:** `onDragStart` in DailyNote is not setting the correct `dataTransfer` keys, OR the `onDrop` handler in MiniCalendar is not reading the right key, OR the `taskId` is not being passed through the drag payload.

**Fix approach:**
1. In `DailyNote.tsx`, every task checklist block's drag handle must call `dataTransfer.setData("text/task-id", taskId)` and `dataTransfer.setData("text/block-type", "task")` in `onDragStart`
2. In `MiniCalendar.tsx`, `onDrop` must read `e.dataTransfer.getData("text/task-id")` and call `taskStore.updateTask(taskId, { dueDate: dateString })`
3. Also update `dragStore` if it's used as intermediary
4. Test: drag a task block from DailyNote onto a date in MiniCalendar → task's due date updates in all views

**Do not break:** Existing text block drag-to-reorder within DailyNote itself.

---

### BUG-02: Checkbox vertical alignment broken when font size is large

**What breaks:** In TipTap editors (DailyNote, DocumentEditor), checkboxes misalign vertically when font size is increased.

**Architecture involved:** `globals.css` → `.ProseMirror ul[data-type="taskList"] li` and `li > label`

**Root cause:** Checkbox uses fixed `px` size or `align-items: center` on the `li`. CLAUDE.md mandates: `align-items: flex-start` on `li`, `margin-top: 0.2em` on `label`, `width: 1em; height: 1em` on checkbox (NOT fixed px).

**Fix approach:**
1. In `globals.css`, find `.ProseMirror ul[data-type="taskList"] li` — set `align-items: flex-start`
2. Find `li > label` — set `margin-top: 0.2em`
3. Find the checkbox input/button — set `width: 1em; height: 1em; flex-shrink: 0`
4. Gap between checkbox and text: `0.6em` (not fixed px)

**Do not touch:** Bullet point list styles (they work correctly — use them as reference for spacing rhythm).

---

### BUG-03: Line spacing — bullet points too loose, plain text too tight

**What breaks:** In the TipTap document/notes editor, bullet list items have too much vertical gap between them. Plain text paragraphs are too cramped.

**Architecture involved:** `globals.css` → `.ProseMirror` paragraph and list styles

**Fix approach:**
1. Plain text paragraphs: `margin-bottom: 0.75em` (as documented in CLAUDE.md typography section)
2. List items (`li`): reduce `margin-bottom` to `0.3em` (tight, like a real list)
3. Line height for all editor content: `1.15` unitless (NEVER fixed px)
4. Do NOT change bullet point indentation or marker styles

---

### BUG-04: Cannot delete tasks

**What breaks:** Delete action on a task does nothing, or throws an error.

**Architecture involved:** `taskStore.deleteTask(id)` → `TaskContextMenu.tsx` or `TaskDetailModal.tsx`

**Root cause hypothesis:** The delete handler in the context menu or detail modal is either not calling `taskStore.deleteTask`, calling it with wrong args, or a Supabase RLS policy is blocking deletes.

**Fix approach:**
1. Verify `taskStore.deleteTask` is correctly implemented (it is — already handles parent `subtaskIds` cleanup and document `linkedTaskIds` cleanup)
2. Find where delete is triggered: `TaskContextMenu.tsx` and `TaskDetailModal.tsx`
3. Ensure both call `useTaskStore.getState().deleteTask(task.id)` or the hook equivalent
4. Check browser console for Supabase errors — if RLS is blocking, the error will say "policy violation"
5. If it's a Supabase issue: verify the `tasks` table RLS policy allows DELETE for `auth.uid() = user_id`

**Acceptance criteria:** Right-click a task → Delete → task disappears from all views immediately. Subtask deleted → parent's subtaskIds updated. Standalone task deleted → gone from Supabase.

---

### BUG-05: Hyperlinks in Documents not working

**What breaks:** Clicking a hyperlink inside DocumentEditor does nothing, or links cannot be inserted.

**Architecture involved:** `DocumentEditor.tsx` → TipTap `Link` extension → `EditorBubbleMenu.tsx`

**Fix approach:**
1. Ensure TipTap `Link` extension is configured with `openOnClick: true` (or handle `onClick` manually for Tauri — in Tauri, `window.open` may not work; use `shell.open` from `@tauri-apps/api/shell` instead)
2. In `EditorBubbleMenu.tsx`, verify the link insert button correctly calls `editor.chain().focus().setLink({ href })` 
3. For Tauri: import `{ open }` from `@tauri-apps/plugin-shell` and call `open(url)` on link click instead of `window.open`
4. Link styling in `globals.css`: `color: var(--accent); text-decoration: underline;` on `.ProseMirror a`

---

### BUG-06: Cmd+K QuickAdd — document title not updating

**What breaks:** Creating a new document via Cmd+K QuickAdd results in the document having the wrong title (default title instead of the one typed).

**Architecture involved:** `QuickAdd.tsx` → `documentStore.createDocument(title)` → `documentStore.documents`

**Root cause hypothesis:** QuickAdd is calling `createDocument("")` or `createDocument("Untitled")` and then trying to update the title separately but the update fails or is lost.

**Fix approach:**
1. In `QuickAdd.tsx`, find the code path for "New Document" creation
2. Ensure it calls `documentStore.createDocument(titleFromInput)` directly — pass the title at creation time, not as a subsequent update
3. After creation, navigate to `/documents/${doc.id}` so the user lands on the new doc
4. The document title input in `DocumentEditor.tsx` or `DocumentPageClient.tsx` should also be editable as a plain text input at the top (not inside TipTap content)

---

## 7. Feature Specs — New Features to Build

---

### FEAT-01: Projects → rename to Folders, Craft-style

**Current state:** `Project` type exists with `taskIds[]` and `documentIds[]`. `projectStore.ts` exists. Projects show in Sidebar. Mostly unused/underspecified.

**Decision:** Rename "Projects" to **Folders** conceptually. A Folder is a container for Documents (and optionally tasks). Think Craft's folder system, not a full project manager.

**Data model change:**
- Keep `Project` type but treat it as Folder
- A Folder contains `documentIds[]` — documents assigned to this folder
- A Folder may optionally contain `taskIds[]` — but this is secondary
- Rename in UI only: "Projects" → "Folders" in Sidebar, settings, everywhere visible

**Sidebar behavior (Craft-style):**
```
FOLDERS
  ├─ 📁 Work
  │    ├─ 📄 Q2 Planning
  │    └─ 📄 Team Sync Notes
  ├─ 📁 Personal
  └─ + New Folder
DOCUMENTS (ungrouped)
  ├─ 📄 Meeting Notes
  └─ + New Document
```

**Implementation:**
1. Rename all "Project" UI labels to "Folder" (do NOT rename types/store — too risky)
2. In `Sidebar.tsx`: render documents grouped under their folder (`doc.projectId` maps to folder)
3. Allow dragging documents into folders (update `doc.projectId`)
4. Allow creating a new folder from sidebar
5. Clicking a folder expands/collapses it (accordion)
6. Clicking a document inside a folder navigates to it

**Do not build yet:** Task management within folders. That's phase 2.

---

### FEAT-02: Floating sidebars (Craft-style layout)

**Current state:** Sidebar and content panel are side-by-side cards. Sidebar is always visible.

**Goal:** On desktop, make the sidebar float as an overlay panel on top of the content — like Craft, Notion's hidden sidebar, or macOS Finder sidebar toggle.

**Behavior:**
- Default: sidebar hidden, content fills full width
- Toggle: clicking a hamburger/sidebar icon slides the sidebar in from the left, floating over content (not pushing it)
- Sidebar has `position: fixed`, `z-index: 200`, glass background, shadow
- Clicking outside sidebar closes it
- Sidebar toggle button: top-left of content area, always visible

**Implementation in `ClientLayout.tsx`:**
1. Add `isSidebarOpen` state (default `false` on desktop, persisted in localStorage as `stride-sidebar-open`)
2. Sidebar: `position: fixed; left: 0; top: 0; height: 100%; width: 260px; z-index: 200; transform: translateX(isSidebarOpen ? 0 : -100%); transition: transform 0.2s ease`
3. Backdrop: semi-transparent overlay when sidebar is open (click to close)
4. Content `<main>`: always `width: 100%`, no margin adjustment needed since sidebar floats

**Mobile:** Already uses bottom tab bar, no sidebar — no change needed.

---

### FEAT-03: Document editor improvements (Craft-style)

**Goal:** Make DocumentEditor feel seamless — no visible "editor box", just a clean page.

**Changes:**
1. **Remove editor border/card treatment** — DocumentEditor should have no border, no card background. It sits directly on the content panel background.
2. **Title is a plain editable h1** above the TipTap editor — not inside TipTap content. Clicking title focuses it. Blurring saves via `documentStore.updateDocument(id, { title })`.
3. **Typography:** Body text at 15px, line-height 1.15 unitless, paragraph spacing 0.75em.
4. **Slash commands** already exist via `SlashCommandMenu` — ensure they work for: `/heading`, `/bullet`, `/numbered`, `/todo`, `/divider`.
5. **Hyperlinks:** Must work (see BUG-05).
6. **Checkboxes:** Must scale with font size (see BUG-02).

---

### FEAT-04: Craft-style mobile document interaction

**Goal:** On mobile, swiping left on a text block or checkbox in a document opens a block action menu.

**Implementation:**
1. In `DocumentEditor.tsx`, add `onTouchStart`/`onTouchEnd` handlers to detect left-swipe on a block (threshold: >50px horizontal, <30px vertical movement)
2. On swipe left: show a bottom sheet with block actions: Move Up, Move Down, Turn Into (heading/bullet/todo), Duplicate, Delete Block
3. Use the existing mobile bottom sheet pattern from CLAUDE.md (rounded-t-2xl, drag handle, safe area inset)
4. Block actions call the appropriate TipTap commands: `editor.chain().focus()...`

**Touch target:** Each block action row minimum 44px height.

---

## 8. Architecture Decisions & Constraints

### What NOT to rebuild
- Do not replace dnd-kit with another DnD library
- Do not replace TipTap with another editor
- Do not replace Zustand with another state manager
- Do not replace Supabase with another backend
- Do not add API routes (static export constraint — Tauri)

### Fragile areas — always audit before touching
1. **Subtask rendering** — flat array ordering in SortableContext is load-bearing. Changing render order breaks DnD.
2. **Cross-tab consistency** — ALWAYS update Dashboard, Inbox, Next7Days, Tasks simultaneously for any task row change.
3. **TipTap content saving** — `documentStore.updateDocument` guards against empty content. Do not bypass this guard.
4. **Supabase auth** — all store functions call `getUserId()` before writes. Never skip this.
5. **Glass surfaces** — NEVER hardcode hex colors for backgrounds. Always use CSS variables.

### Tauri-specific constraints
- No server-side code, no API routes
- `window.open` for external links may not work — use `@tauri-apps/plugin-shell` `open(url)` instead
- Static export: all dynamic routes need `generateStaticParams` + `export const dynamic = 'force-static'`

### Z-index hierarchy (NEVER deviate)
```
40   — FABs
50   — Bottom tab bar, popovers, modals
200  — Floating sidebar (new)
9999 — Context menus
```

---

## 9. Session Protocol for Cursor

**Start every session with:**
```
Read CLAUDE.md and PRODUCT.md before making any changes.
```

**Before fixing a bug:**
1. Read the relevant BUG-XX spec in PRODUCT.md
2. Identify ALL components in the "Architecture involved" section
3. Trace the data flow end-to-end before writing a single line
4. Make the fix in the minimum number of files possible
5. After fixing, audit: does this change affect any of the 4 task tabs? If yes, update all 4.

**Before adding a feature:**
1. Read the relevant FEAT-XX spec
2. Check: does this touch `types/index.ts`? If yes, confirm the change is minimal and backward-compatible.
3. Check: does this touch taskStore? If yes, verify subtask ordering rules are preserved.
4. Build incrementally — one sub-feature at a time, not the whole feature at once.

**Red flags — stop and ask before proceeding:**
- About to modify `src/types/index.ts` significantly
- About to add a new Zustand store
- About to replace a core library
- Fix requires changing more than 5 files simultaneously
- Unsure which component owns a piece of state

---

## 10. Known Working Patterns (don't break these)

- `RescheduleDatePopover` — viewport-aware date picker, already correct. Use it everywhere.
- `ConnectedTaskContextMenu` — bulk selection aware. Use inside `<TaskSelectionProvider>`.
- Glass surface pattern — documented in CLAUDE.md, already consistent. Don't re-implement.
- `rolloverPastDueTasks()` — runs automatically on `loadTasks()`. Don't call manually.
- `taskChangesToRow()` — the correct way to convert Task changes to Supabase snake_case. Always use this, never write your own mapper.