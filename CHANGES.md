# Stride — Fix Summary

## Files Changed

All fixed files are in the `src/` folder of this zip. Copy each one into the
matching path in your project root, replacing the existing file.

---

## Bug Fixes

### 1. `@today` / `@tomorrow` leaves `@` symbol in title
**File:** `src/components/QuickAdd.tsx`

**Root cause:** The regex `\b@?(today|tomorrow)\b` doesn't work because `\b`
(word boundary) only matches between `\w` and `\W` characters — but `@` is `\W`,
so the boundary before `@today` doesn't fire.

**Fix:** Changed to `@?tomorrow` and `@?today` without `\b`, strip them
unconditionally from the title string. Also improved the QuickAdd UI with:
- Section selector (you can assign a section at capture time)
- Live preview chips showing the parsed date and tags
- Better keyboard hint footer

---

### 2. Subtasks appearing as top-level tasks in "Today's Focus"
**File:** `src/components/TaskListView.tsx`

**Root cause:** When `filterDate` was set, the code filtered by `dueDate` first,
then filtered out `parentTaskId` only in the non-date path. Subtasks with their
own `dueDate` set leaked through as top-level items.

**Fix:** Separated `incompleteTasks` (always excludes `parentTaskId` tasks) from
the date/section filtering logic. All filtering now operates on `incompleteTasks`
as the base, so subtasks can never appear as top-level rows.

Also added: **Completed tasks section** — a collapsible "✓ Completed" row at the
bottom of the task list showing tasks with status `done` or `cancelled`.

---

### 3. Duplicate `<TaskDetailModal>` in Dashboard
**File:** `src/app/page.tsx`

**Root cause:** `TaskDetailModal` was rendered twice — once inside the panel group
with a guard, and once below it also with a guard. Both rendered simultaneously
when a task was selected, stacking two modals.

**Fix:** Removed the duplicate. Now there is exactly one `<TaskDetailModal>` at
the bottom of the component.

---

### 4. Calendar view switcher broken on multi-day views
**File:** `src/components/CalendarView.tsx`

**Root cause:** For 2/3/4-day views, the code called `api.changeView(type)` then
`api.setOption("duration", duration)` as two separate calls. FullCalendar v6
requires the duration to be passed as a second argument to `changeView()` itself,
not as a separate `setOption` call.

**Fix:** Changed to `api.changeView(type, { duration })` in a single call when
a duration is needed. Also fixed the initial mount — `duration` is now passed as
an init prop too so the first render of 2/3/4-day views is correct.

---

### 5. `useSectionStore.getState()` called inside render (non-reactive)
**File:** `src/components/TaskDetailModal.tsx`

**Root cause:** The subsection `<select>` rendered using
`useSectionStore.getState().subsections` directly in JSX. This is a snapshot
call — it doesn't subscribe to the store and won't re-render when subsections
change.

**Fix:** Changed to the reactive hook: `const subsections = useSectionStore(s => s.subsections)`
at the top of the component, and derived `sectionSubsections` with `useMemo`.

---

### 6. Delete missing from Document and TimeBlock UI
**Files:** `src/components/DocumentContextMenu.tsx`, `src/components/TimeBlockContextMenu.tsx`

**Root cause:** `deleteDocument` existed in the store but the `DocumentContextMenu`
had no Delete button wired to it. `TimeBlockContextMenu` had an `onDelete` prop
but no confirmation before firing it.

**Fix:**
- `DocumentContextMenu` now has a proper Delete button with a confirmation dialog
  that warns the user it will also delete linked tasks.
- `TimeBlockContextMenu` now shows the block's title/time range as a header and
  wraps `onDelete` in a `confirm()`.

---

### 7. TaskContextMenu — improved UX
**File:** `src/components/TaskContextMenu.tsx`

The old reschedule submenu was hidden behind a toggle. Added:
- Quick-pill reschedule buttons always visible (Today / Tomorrow / Weekend / Next Mon)
- Priority submenu panel (slide to sub-panel and back)
- Task title shown as header so you know which task you right-clicked

---

## No Changes Needed

These files were already correct and have not been modified:
- `src/store/*` — all stores are solid
- `src/lib/recurrence.ts` — correct
- `src/lib/xChecklistExtension.ts` — correct
- `src/components/DailyNote.tsx` — correct
- `src/components/DocumentEditor.tsx` — the bidirectional sync logic is largely
  working; the `isSyncingRef` guard prevents loops
- `src/db/index.ts` — the lazy proxy pattern is correct
- `src/app/tasks/page.tsx` — correct
- `src/app/calendar/page.tsx` — correct (uses `hideSidebar` correctly)

---

## How to Apply

```bash
# From your project root:
cp path/to/these-fixes/src/app/page.tsx                        src/app/page.tsx
cp path/to/these-fixes/src/components/QuickAdd.tsx             src/components/QuickAdd.tsx
cp path/to/these-fixes/src/components/TaskListView.tsx         src/components/TaskListView.tsx
cp path/to/these-fixes/src/components/TaskDetailModal.tsx      src/components/TaskDetailModal.tsx
cp path/to/these-fixes/src/components/CalendarView.tsx         src/components/CalendarView.tsx
cp path/to/these-fixes/src/components/TaskContextMenu.tsx      src/components/TaskContextMenu.tsx
cp path/to/these-fixes/src/components/DocumentContextMenu.tsx  src/components/DocumentContextMenu.tsx
cp path/to/these-fixes/src/components/TimeBlockContextMenu.tsx src/components/TimeBlockContextMenu.tsx
```

Then run `npm run dev` and test:
1. ⌘K → type "send report @today" → title should be "send report", not "send report @today"
2. Dashboard → Today's Focus → subtasks should not appear as separate rows
3. Click a task → only ONE modal should appear
4. Calendar page → switch to 2D/3D/4D views → should work
5. Right-click a document → Delete should appear and work
6. Right-click a calendar block → Delete should appear with confirmation
