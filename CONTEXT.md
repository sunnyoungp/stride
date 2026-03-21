It's empty — good, clean slate. Here's a comprehensive CONTEXT.md based on everything we've worked on today:

```markdown
# Stride — Project Context

> This file is the source of truth for architectural decisions, patterns,
> and gotchas. Read this before making any changes to the codebase.
> Do NOT modify this file unless explicitly asked to.

---

## What Stride Is

A personal productivity app built with Next.js 15 (App Router). Features:
- Daily notes (TipTap rich text editor with checklist support)
- Task manager (sections, subsections, projects, subtasks, recurrence)
- Calendar (FullCalendar with time blocking)
- Routine templates
- Documents (TipTap editor)
- Focus mode (Tunnel / Timer / Vault)
- Settings (appearance, navigation, shortcuts, etc.)

Live URL: https://stride-ashy.vercel.app
Repo: https://github.com/sunnyoungp/stride

---

## Tech Stack

- **Framework**: Next.js 15, App Router, TypeScript
- **UI**: Tailwind CSS v4 + CSS variables for theming
- **Editor**: TipTap v3 (ProseMirror underneath)
- **State**: Zustand v5 (no Redux, no Context for data)
- **Database**: Supabase (PostgreSQL + Auth)
- **Previous DB**: Dexie (IndexedDB) — being migrated to Supabase
- **Calendar**: FullCalendar v6 with @fullcalendar/interaction
- **Drag/Drop**: @dnd-kit (for task lists), custom ProseMirror plugin (for notes)
- **Panels**: react-resizable-panels (dashboard layout)
- **Fonts**: Geist Sans + Geist Mono (next/font)

---

## File Structure

```
src/
  app/                    # Next.js App Router pages
    page.tsx              # Dashboard
    notes/page.tsx        # Notes / daily note
    inbox/page.tsx        # Inbox
    next7/page.tsx        # Next 7 days
    tasks/page.tsx        # Tasks
    calendar/page.tsx     # Calendar
    documents/page.tsx    # Documents
    settings/page.tsx     # Settings (all settings in one file)
    login/page.tsx        # Google OAuth login page
    auth/callback/        # Supabase auth callback
    globals.css           # All CSS variables, global styles, TipTap styles
    layout.tsx            # Root layout — loads ClientLayout
  components/
    ClientLayout.tsx      # Wraps all pages, renders Sidebar + BottomTabBar
    Sidebar.tsx           # Desktop left sidebar nav
    BottomTabBar.tsx      # Mobile bottom nav + FABs (⚡ and +)
    DailyNote.tsx         # TipTap editor for daily notes (very complex)
    CalendarView.tsx      # FullCalendar wrapper
    TaskListView.tsx      # Task list rendering
    TaskDetailModal.tsx   # Task detail/edit panel
    RoutineTemplateStrip.tsx
    RoutineTemplatePanel.tsx
    MiniCalendar.tsx      # Mini month calendar (used in Notes sidebar)
    SettingsApplier.tsx   # Applies localStorage settings as CSS vars on load
    QuickAdd.tsx          # New task quick-add bar (⌘K)
    FocusSetup.tsx        # Focus mode setup modal (⌘J)
  store/                  # Zustand stores — one per data type
    taskStore.ts
    sectionStore.ts
    projectStore.ts
    documentStore.ts
    dailyNoteStore.ts
    routineTemplateStore.ts
    timeBlockStore.ts
    focusStore.ts
    dragStore.ts          # UI only, no persistence
    shortcutStore.ts      # Persists to localStorage only
    uiStore.ts            # UI only, no persistence
  lib/
    dragHandleExtension.ts  # TipTap/ProseMirror drag handle plugin
    xChecklistExtension.ts  # TipTap input rule: "x " → checklist
    recurrence.ts           # Recurrence logic for tasks
    settings.ts             # loadSettings() / saveSettings() for Supabase sync
    supabase/
      client.ts             # createBrowserClient (@supabase/ssr)
      server.ts             # createServerClient (@supabase/ssr)
  hooks/
    useIsMobile.ts          # Returns true when window.innerWidth < 768
    useVisualViewport.ts    # Tracks visualViewport height (keyboard-aware)
    useNavConfig.ts         # Reads stride-nav-config from localStorage
  types/
    index.ts                # ALL types. DO NOT MODIFY THIS FILE EVER.
  db/
    index.ts                # Dexie DB definition (legacy, being replaced)
  middleware.ts             # Supabase session refresh + auth redirect
```

---

## Types — CRITICAL

**`src/types/index.ts` must never be modified by any AI or script.**
It is the source of truth for all data shapes. If a type needs to change,
ask the developer first.

Key types:
- `Task` — has status, priority, tags, sectionId, dueDate, recurrence,
  parentTaskId, subtaskIds, sourceDocumentId, projectId, order
- `TaskSection` — id, title, color, icon, order
- `TaskSubsection` — id, title, sectionId, color, order
- `DailyNote` — id, date, content (TipTap JSON string), linkedTaskIds
- `StrideDocument` — id, title, content (TipTap JSON string), linkedTaskIds
- `Project` — id, title, status, taskIds, documentIds, color
- `RoutineTemplate` — id, title, durationMinutes, defaultStartTime,
  color, daysOfWeek, isBuiltIn, pinned, order
- `TimeBlock` — id, title, startTime, endTime, type, taskId,
  routineTemplateId, color
- `RecurrenceRule` — frequency, interval, daysOfWeek, endDate

---

## Database — Supabase

All data is stored in Supabase. Tables mirror the types above with
snake_case column names. Every table has:
- `user_id` (uuid, references auth.users) — Row Level Security enforces
  that users can only read/write their own rows
- RLS is enabled on ALL tables — never disable it

### Column name mapping (TypeScript → Supabase)
```
sectionId         → section_id
subsectionId      → subsection_id
projectId         → project_id
dueDate           → due_date
scheduledStart    → scheduled_start
scheduledEnd      → scheduled_end
rolledOver        → rolled_over
rolledOverFrom    → rolled_over_from
parentTaskId      → parent_task_id
subtaskIds        → subtask_ids
sourceDocumentId  → source_document_id
sourceDocumentTitle → source_document_title
linkedTaskIds     → linked_task_ids
durationMinutes   → duration_minutes
defaultStartTime  → default_start_time
daysOfWeek        → days_of_week
isBuiltIn         → is_built_in
startTime         → start_time
endTime           → end_time
taskId            → task_id
routineTemplateId → routine_template_id
deletedAt         → deleted_at
createdAt         → created_at
updatedAt         → updated_at
order             → "order" (quoted — reserved SQL word)
```

### user_settings table
One row per user. Stores all localStorage settings as a single JSONB
object so settings sync across devices. Keys match the localStorage
key names exactly (e.g. "stride-accent", "stride-nav-config").

### Auth
- Google OAuth only
- Supabase handles session management via @supabase/ssr
- middleware.ts refreshes sessions on every request
- Unauthenticated users are redirected to /login
- The login page must NOT show the sidebar

---

## Settings System

Settings are saved to both localStorage (instant) and Supabase
(background sync for cross-device persistence).

**Never use `lsSet(key, value)` for new settings — always use
`saveSettings(key, value)` from `src/lib/settings.ts`.**

`loadSettings()` is called once on login in ClientLayout.tsx and
writes all Supabase-stored settings into localStorage before any
page renders.

### localStorage keys
```
stride-theme              light | dark | system
stride-accent             hex color string
stride-font              geist | inter | system | georgia
stride-font-size          13px | 14px | 16px
stride-sidebar-width      e.g. "220px"
stride-compact            true | false
stride-nav-config         JSON array of NavItem[]
stride-note-linked-mode   true | false
stride-note-font-size     13px | 14px | 16px
stride-note-show-heading  true | false
stride-note-auto-create   true | false
stride-week-start         sunday | monday
stride-tasks-view         list | kanban
stride-show-completed     true | false
stride-auto-rollover      true | false
stride-default-priority   none | low | medium | high
stride-calendar-view      1d | week | month | agenda
stride-calendar-week-start sunday | monday
stride-slot-duration      00:15:00 | 00:30:00 | 01:00:00
stride-calendar-start     e.g. "06:00"
stride-calendar-end       e.g. "23:00"
stride-show-weekends      true | false
stride-time-format        12hr | 24hr
stride-app-name           string
stride-shortcuts          JSON object of custom bindings
```

### CSS variables set by SettingsApplier.tsx on load
```
--accent
--font-size-base
--note-font-size
--sidebar-width
--font-body
```

`--font-size-base` must be applied to `body` in globals.css so all
text scales with it. Task title elements use className="task-title-text"
which has `font-size: var(--font-size-base, 14px) !important`.

---

## Navigation Config

The sidebar and bottom tab bar both read from `stride-nav-config` in
localStorage via `src/hooks/useNavConfig.ts`.

When the settings page saves nav config, it dispatches:
```js
window.dispatchEvent(new StorageEvent("storage", { 
  key: "stride-nav-config" 
}))
```
This makes the sidebar update instantly in the same tab (storage events
normally only fire across tabs).

---

## Responsive Layout

**Breakpoint: 768px**
- Above: desktop layout with left sidebar
- Below: mobile layout with bottom tab bar

**Never use CSS-only breakpoints for layout changes** — use the
`useIsMobile()` hook from `src/hooks/useIsMobile.ts` so layout
switches are controlled in React, not CSS.

**`useVisualViewport()`** from `src/hooks/useVisualViewport.ts` tracks
the visible viewport height. When the iOS/Android keyboard opens,
`visualViewport.height` shrinks. Use this to position fixed panels
above the keyboard:
```ts
const { height: vpHeight } = useVisualViewport();
const windowHeight = window.innerHeight;
const keyboardHeight = Math.max(0, windowHeight - vpHeight);
// Then: bottom: 56 + keyboardHeight + 16
```

### Per-page mobile layout decisions
- **Dashboard**: single column — note on top, tab switcher, then
  Tasks or Calendar tab below
- **Notes**: full width note always, mini calendar becomes a top
  overlay (drops down) when toggled, closes after date selection
- **Calendar**: full width calendar, left sidebar (routines +
  unscheduled tasks) hidden by default, accessible via ☰ button
  that opens a bottom sheet
- **Settings**: horizontal scrollable category strip at top instead
  of left sidebar, full width content

### Fixed bottom offset for all mobile content
Content that scrolls must have:
```
padding-bottom: calc(56px + env(safe-area-inset-bottom) + 16px)
```
Use `className="mobile-scroll-content"` (defined in globals.css).

### FAB positioning (⚡ focus + new task)
Both FABs are in BottomTabBar.tsx, fixed position, right: 16px.
They sit above the tab bar and shift up when the keyboard opens:
```
bottom: 56 + keyboardHeight + 16   // new task (+)
bottom: 56 + keyboardHeight + 80   // focus (⚡)
```

### Bottom sheets pattern
Used for: calendar sidebar, task detail on mobile, more menu.
Standard styles:
```
position: fixed, bottom: 0, left: 0, right: 0
border-radius: 16px 16px 0 0
background: var(--bg-card)
border-top: 1px solid var(--border)
box-shadow: var(--shadow-lg)
padding-bottom: env(safe-area-inset-bottom)
z-index: 50
```
Always paired with a backdrop (z-index: 49, rgba(0,0,0,0.3)) that
closes the sheet on tap.

---

## TipTap Editor (DailyNote)

The daily note editor is the most complex component in the app.
`src/components/DailyNote.tsx` — read fully before touching.

### Extensions used
- StarterKit
- TaskList
- TaskItemWithId (custom: TaskItem extended with taskId attr)
- XChecklistExtension (input rule: "x " → checklist)
- DragHandleExtension (custom ProseMirror plugin)
- Placeholder

### Linked mode vs Independent mode
- Linked mode: checklist items auto-create/sync tasks in taskStore
- Independent mode: checklist items are local note content only
- Controlled by localStorage key `stride-note-linked-mode`
- Toggle button visible in the note header

### Multi-select
- Shift+click selects a range of blocks
- Drag-to-lasso selects blocks by dragging over empty space
- Selected blocks highlighted with `--accent-bg-strong` outline
- DnSelectionBar appears (portal) when 2+ blocks selected
- Actions: Complete all (tasks only), Reschedule (tasks only),
  Create tasks (plain blocks), Delete (all types)
- Escape clears selection

### Drag handle (src/lib/dragHandleExtension.ts)
**Critical architectural decisions — do not change these:**

1. The handle element is appended to `document.body` (NOT to
   `view.dom.parentElement`). This is intentional — parent elements
   have `overflow: hidden` which clips absolutely positioned children.
   The handle uses `position: fixed` and viewport coordinates.

2. Because the handle is outside `view.dom`, ProseMirror does not
   automatically receive its drag events. To make dragging work, the
   dragstart handler must:
   - Set `view.state.selection` to a NodeSelection at currentTopPos
   - Set `(view as any).dragging = { slice, move: true }`
   - Dispatch a synthetic DragEvent on the actual block's DOM node
     so ProseMirror's internal drag state machine activates

3. Handle position is calculated using `nodeRect.left - 28` (NOT
   `editorRect.left - 28`). The handle must track the individual
   block, not the editor container.

4. `currentTopPos` is resolved by walking up from `$pos.depth` to
   find the first ancestor whose parent is the doc (depth === 0).
   Use a try/catch loop — `$pos.before(d)` can throw at boundaries.

5. The handle sets `dataset.blockType`, `dataset.taskTitle`, and
   optionally `dataset.taskId` on both itself AND the dragged DOM
   node. FullCalendar's droppable system reads from element.dataset,
   not from dataTransfer.

### Drop targets
- **Today's Focus panel** (dashboard): `handleTaskPanelDrop` in
  `src/app/page.tsx`. If taskId exists → reschedule. If no taskId →
  create new task with dueDate: selectedDate.
- **Mini calendar** (CalendarView): uses FullCalendar's `droppable`
  prop and `drop` callback. Reads taskId/title from draggedEl.dataset.
  If taskId → updateTask dueDate. No taskId → createTask.

---

## Keyboard Shortcuts

Defined in `src/store/shortcutStore.ts`.
Custom bindings saved to localStorage under `stride-shortcuts`.

Default bindings:
```
⌘K  → open Quick Add (new task popover)
⌘J  → open Focus Mode setup modal
⌘F  → open Search
⌘1  → Dashboard
⌘2  → Notes
⌘3  → Inbox
⌘4  → Next 7 Days
⌘5  → Tasks
⌘6  → Calendar
⌘7  → Documents
⌘,  → Settings
```

On mobile, ⌘K and ⌘J are triggered by the FAB buttons (⚡ and +)
in BottomTabBar.tsx. They call the same open functions as the keyboard
handlers — do not duplicate the modal logic.

---

## Stores — Patterns

All stores follow the same pattern:
1. Define the store type
2. Create async functions that call Supabase
3. Map snake_case Supabase columns back to camelCase before setting state
4. Always handle Supabase errors with console.error + graceful fallback
5. Return initial state + all functions

**dragStore, focusStore, shortcutStore, uiStore** are UI-only —
no Supabase calls, no persistence (except shortcutStore which uses
localStorage directly).

### After Supabase migration
- All `db.*` (Dexie) calls have been replaced with Supabase calls
- The Dexie db file may still exist as a safety net but is not used
- settings/page.tsx export/import functions still reference Dexie —
  these need updating when Supabase migration is finalized

---

## CSS Variables Reference

All defined in `src/app/globals.css`.

```css
/* Backgrounds */
--bg, --bg-subtle, --bg-card, --bg-sidebar
--bg-hover, --bg-active

/* Text */
--fg, --fg-muted, --fg-faint, --fg-placeholder

/* Accent (default coral #e8603c) */
--accent, --accent-hover, --accent-fg, --accent-bg, --accent-bg-strong

/* Borders */
--border, --border-mid, --border-strong

/* Shadows */
--shadow-sm, --shadow-md, --shadow-lg, --shadow-float
--shadow-card, --shadow-card-hover, --shadow-drawer

/* Priorities */
--priority-low, --priority-medium, --priority-high

/* Section colors */
--section-work, --section-personal, --section-health
--section-work-fg, --section-personal-fg, --section-health-fg
```

Dark mode is toggled by adding `.dark` class to `<html>`.
System preference is handled in the root layout inline script.

---

## Common Mistakes to Avoid

1. **Never modify src/types/index.ts**

2. **Never use `lsSet()` for saving settings** — use `saveSettings()`
   from src/lib/settings.ts which also syncs to Supabase

3. **Never position the drag handle relative to the editor container**
   — it must use fixed positioning with viewport coords from
   `nodeDom.getBoundingClientRect()`

4. **Never append the drag handle to view.dom.parentElement** — it
   gets clipped. Always append to document.body.

5. **Never use `editorRect.left` for handle position** — use
   `nodeRect.left - 28` so it tracks the individual block

6. **Never use CSS-only breakpoints for layout structure changes**
   — use the useIsMobile() hook

7. **Never use localStorage directly for saving settings** — use
   saveSettings() which writes to both localStorage and Supabase

8. **Never duplicate modal/panel open logic for mobile FABs** — the
   FABs must call the same open functions as keyboard shortcuts

9. **Never hardcode font sizes on task titles** — use
   className="task-title-text" which respects --font-size-base

10. **Never set bottom: 0 on fixed mobile panels** — always account
    for the tab bar (56px), safe area inset, and keyboard height

11. **`"order"` is a reserved SQL word** — always quote it in
    Supabase queries: `.order('"order"', ...)`

12. **Read every file fully before editing it** — many components
    have non-obvious interdependencies (e.g. DailyNote.tsx is 1000+
    lines with multiple interacting systems)

13. **After editing a store, verify the snake_case → camelCase
    mapping is correct** — missing a field causes silent data loss

14. **The storage event only fires across tabs** — when saving to
    localStorage in settings and needing the same-tab sidebar to
    update, always dispatch a synthetic StorageEvent manually

---

## Environment Variables

Required in both `.env.local` and Vercel project settings:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

The anon key is safe to expose publicly — RLS protects all data.

---

## Deployment

- Vercel, auto-deploys from `main` branch
- Build command: `npm run build`
- Always run `npm run build` locally before pushing to catch
  TypeScript errors before they fail the Vercel deployment
```