# Stride — Claude Code Instructions

## Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
- State: Zustand stores in `/store/`
- Components: `/components/`
- Types: `/types/index.ts`

---

## ⚠️ CROSS-TAB CONSISTENCY — CRITICAL RULE

**Any UI change to task rows, subtasks, headers, or list layout MUST be applied consistently across ALL FOUR tabs simultaneously:**
- **Dashboard** (`/app/page.tsx`) — uses `TaskListView`
- **Inbox** (`/app/inbox/page.tsx`) — uses `TaskGroup` / `TaskRowsWithSubtasks`
- **Next 7 Days** (`/app/next7/page.tsx`) — uses `DroppableDateGroup`
- **Tasks** (`/app/tasks/page.tsx`) — uses `TaskListView`

Never fix spacing, borders, checkbox styles, or subtask rendering in only one tab. Always audit and update all four.

### ⚠️ CANONICAL REFERENCE — Next 7 Days list view

**The Next 7 Days list view is the canonical reference for task row design.** All four tabs (Dashboard, Inbox, Tasks, Next 7 Days) must render task rows identically:
- Same checkbox size: **17×17px**, `borderRadius: 4`, `1.5px` border
- Same row padding: **`11px 16px`** for parent rows, **`5px 16px`** for compact/subtask rows
- Same subtask indentation: wrap `<TaskRow compact />` in `<div style={{ paddingLeft: 20 }}>` (effective left offset = 36px including TaskRow's own 16px padding)
- Same divider pattern: `borderTop: "1px solid var(--border)"` between parent task groups
- Same date chip style (from `dueDateChip()` in TaskList.tsx)
- Last subtask in each parent group gets **extra 6px bottom padding** (paddingBottom on the wrapper div)
- **No per-tab style override to task rows is permitted** unless explicitly documented here with a reason

**Why this rule exists:** The task row appearance kept diverging across tabs because each tab renders rows through different components (`renderRow` in TaskListView vs `TaskRow` in TaskList vs `DroppableDateGroup`). Every fix must be audited against all four tabs simultaneously.

---

## Kanban — applies to ALL three pages

Kanban view exists on **Tasks** (`/app/tasks/page.tsx`), **Inbox** (`/app/inbox/page.tsx`), and **Next 7 Days** (`/app/next7/page.tsx`). All three share the same `KanbanBoard` component.

**Any change to Kanban behavior — cards, interactions, right-click menus, inline inputs, column headers, `onAddTask` — must be applied to all three pages.** Never patch only one page.

### Kanban column drag-to-reorder

Pass `onColumnReorder?: (newColumnIds: string[]) => void` to `KanbanBoard`. When provided, column headers become drag handles (`enableColumnDrag` prop on `KanbanColumnView`). Columns use `useSortable({ id: "col-${column.id}" })` combined with `useDroppable({ id: column.id })` on the same element via a combined `setRef` callback. The outer `DndContext` wraps columns in `<SortableContext items={columnSortableIds} strategy={horizontalListSortingStrategy}>`. In `handleDragEnd`, detect column drags by checking `activeId.startsWith("col-")`.

- Only pass `onColumnReorder` when `groupBy === "list"` (section-based columns). Date/priority/tag groupings derive column identity from data, so reordering makes no sense.
- Column reorder persists via `updateSection({ order })` for each affected section.

### Kanban inline subtask rows

Inline subtask rows inside `KanbanCardVisual` must have `onPointerDown={(e) => e.stopPropagation()}` to prevent the parent card's drag listeners from firing when interacting with a subtask.

---

## Design System — ALWAYS use these, never hardcode values

### ⚠️ GLASSMORPHISM — THREE-LAYER DEPTH SYSTEM

Stride uses a **three-layer glassmorphism** design. Every surface is derived from `--tint-h` and `--tint-s`. **No surface may use a hardcoded background color.**

```
Layer 0  →  --bg-app       App canvas (behind everything). Solid, darkest/most muted.
Layer 1  →  --bg-panel     Panels (sidebar + content). Semi-transparent glass, same color for both.
Layer 2  →  --bg-card      Cards, task groups, Kanban columns. Slightly lighter glass.
```

All panel/card backgrounds are derived via CSS `color-mix()` from `--tint-h` and `--tint-s`. When the user changes the tint, all glass surfaces update automatically.

#### Glass pattern per layer

**Layer 1 — panels** (ClientLayout.tsx sidebar + main):
```css
background: var(--bg-panel);
backdrop-filter: var(--glass-blur-panel);   /* blur(24px) saturate(160%) */
-webkit-backdrop-filter: var(--glass-blur-panel);
border: 1px solid var(--glass-border);
border-top: 1px solid var(--glass-border-top);
box-shadow: var(--glass-shadow-panel);
border-radius: 14px;
```

**Layer 2 — cards / task groups / Kanban columns / floating surfaces**:
```css
background: var(--bg-card);
backdrop-filter: var(--glass-blur-card);    /* blur(14px) saturate(140%) */
-webkit-backdrop-filter: var(--glass-blur-card);
border: 1px solid var(--glass-border);
border-top: 1px solid var(--glass-border-top);
box-shadow: var(--glass-shadow-card);        /* or --shadow-float for modals */
border-radius: 11px;   /* 12px for context menus, 14–16px for modals/sheets */
```

Use `backdropFilter` + `WebkitBackdropFilter` in React inline styles. Use the `.glass-card` CSS class for elements that need glass treatment where adding inline styles is impractical.

#### Tint system

Themes declare `--tint-h` (hue, 0–360) and `--tint-s` (saturation, e.g. `16%`). The rest auto-derives:
- `--bg-app`: `hsl(var(--tint-h), var(--tint-s), 72%)` in light / `hsl(var(--tint-h), 12%, 8%)` in dark
- `--bg-panel`: `color-mix(in srgb, hsl(var(--tint-h), var(--tint-s), 82%) 52%, transparent)` in light
- `--bg-card`: `color-mix(in srgb, hsl(var(--tint-h), var(--tint-s), 88%) 50%, transparent)` in light

Users can override tint via Settings > Appearance > Glass tint. Persisted as `stride-tint-h` and `stride-tint-s` in localStorage. SettingsApplier applies these after the theme.

Per-theme tint hints (h, s):
- Warm: 30, 16% | Cool: 218, 10% | Midnight: 222, 18% | Ocean: 184, 22%
- Forest: 138, 18% | Aurora: 255, 14% | Sunset: 28, 22% | Neutral: 220, 6%
- Neutral-light: 30, 16% | Lavender: 260, 14% | Matcha: 138, 12% | Sky: 210, 14%

### CSS Variables (defined in globals.css / SettingsApplier.tsx)
All colors, spacing, and surfaces MUST use these variables. Never use Tailwind color classes like `bg-zinc-900`, `text-zinc-200`, `border-white/10`, or hardcoded hex values like `#18181b` for UI surfaces.

```
/* Three-layer depth (glass) */
--bg-app              App canvas — behind panels
--bg-panel            Panel glass (sidebar + content) — color-mix derived
--bg-card             Card glass (groups, kanban, modals) — color-mix derived

/* Solid surfaces (editors, inputs) */
--bg                  Solid page/editor background — hsl-derived, theme-specific
--bg-subtle           Solid secondary surface (inputs, code blocks)
--bg-hover            Hover state background
--bg-active           Selected/active state background

/* Glass tokens */
--glass-blur-panel    blur(24px) saturate(160%)
--glass-blur-card     blur(14px) saturate(140%)
--glass-border        Frosted border (sides/bottom)
--glass-border-top    Bright top edge border (specular highlight)
--glass-shadow-panel  Panel drop shadow + inset top glow
--glass-shadow-card   Card drop shadow + inset top glow

/* Text */
--fg                  primary text — rgba(0,0,0,0.84) light / rgba(255,255,255,0.90) dark
--fg-muted            secondary text — passes 3:1 AA large against --bg-card
--fg-faint            tertiary text — lower contrast, decorative only
--fg-placeholder      placeholder / disabled text

/* Borders */
--border              default border
--border-mid          slightly stronger border
--border-strong       strong border (drag handles, dividers)

/* Accent */
--accent              primary brand color (coral default, user-configurable)
--accent-bg           accent tint background
--accent-bg-strong    stronger accent tint

/* Shadows */
--shadow-sm/md/lg     standard depth shadows
--shadow-float        modal / heavy float shadow

/* Legacy aliases (point to new tokens, do not use directly in new code) */
--color-app-root-bg   → var(--bg-app)
--sidebar-bg          → var(--bg-panel)
--content-bg          → var(--bg-panel)
--shadow-panel        → var(--glass-shadow-panel)

/* Priority */
--priority-high
--priority-medium
--priority-low
```

### Contrast requirements
- `--fg` against `--bg-card`: must pass WCAG AA (≥4.5:1)
- `--fg-muted` against `--bg-card`: must pass AA large (≥3:1)
- `--fg-faint` / `--fg-placeholder`: lower contrast allowed — decorative use only
- Check all themed variants before shipping new text colors

### Border Radius — use these consistently
```
4px   — tiny badges, dots
6px   — small chips, tags
8px   — small buttons, menu items (rounded-lg in Tailwind)
10px  — inputs, pills (rounded-xl in Tailwind)  
12px  — cards, context menus (rounded-xl)
14px  — kanban columns
16px  — modals, bottom sheets (rounded-2xl in Tailwind)
9999px — fully round pills, avatars
```

### Typography scale & rules
- **Line Height:** ALL line heights must be unitless multipliers (`1.15` for document body, `1.3` for UI). NEVER use fixed px/rem (e.g., no `leading-7`).
- **Letter Spacing:** Headings use `-0.01em` tracking. Body uses `0` (normal). NEVER use loose or tight tracking classes (`tracking-wide`, `tracking-[0.08em]`).
- **Paragraph Spacing:** Documents use `0.75em` margin-bottom for paragraphs.
- **Font Family:** Globally uses `--font-app` (derived from `stride-font-preference` in Settings: system, inter, serif, mono).
- **Hierarchy:** 
  - 28px — Page/document title
  - 18px — Section heading
  - 15px — Editor base body & UI item titles
  - 13px — Secondary labels
  - 12px — Caption/hint text
  - 10px / text-[10px] — smallest uppercase tags

---

## Component Rules — ALWAYS use existing components

### Context Menus
Use ONE consistent pattern across ALL context menus. All context menus now use the glass treatment.

Correct context menu shell (glass):
```tsx
<div
  ref={menuRef}
  style={{
    left: clampedPos.x,
    top: clampedPos.y,
    background: "var(--bg-card)",
    backdropFilter: "var(--glass-blur-card)",
    WebkitBackdropFilter: "var(--glass-blur-card)",
    border: "1px solid var(--glass-border)",
    borderTop: "1px solid var(--glass-border-top)",
    boxShadow: "var(--shadow-float)",
    zIndex: 9999,
  }}
  className="fixed w-[200px] select-none rounded-xl p-1"
>
```

Menu items inside context menus:
```tsx
<button
  type="button"
  className="w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
  style={{ color: "var(--fg)" }}
>
  Label
</button>
```

Danger menu items:
```tsx
style={{ color: "#ef4444" }}
className="... hover:bg-red-500/10"
```

Dividers:
```tsx
<div className="my-1 h-px" style={{ background: "var(--border)" }} />
```

### Buttons — use these variants, never invent new ones

**Primary (filled accent):**
```tsx
<button
  className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
  style={{ background: "var(--accent)", color: "white" }}
>
```

**Secondary (ghost):**
```tsx
<button
  className="rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
  style={{ color: "var(--fg)" }}
>
```

**Chip/pill (toggle):**
```tsx
// Active state:
style={{ background: "var(--accent-bg-strong)", color: "var(--accent)" }}
// Inactive state:
style={{ background: "var(--bg-hover)", color: "var(--fg-muted)" }}
className="rounded-lg px-3 py-1 text-[12.5px] font-medium transition-all duration-150"
```

**Destructive:**
```tsx
className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:bg-red-500/10"
style={{ color: "#ef4444" }}
```

**FAB (floating action button):**
```tsx
className="flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95"
style={{ background: "var(--accent)", color: "white", boxShadow: "0 4px 16px rgba(232,96,60,0.45)" }}
```

### Modals & Sheets
All modals use the same backdrop:
```tsx
<div
  className="fixed inset-0 z-50"
  style={{ background: "rgba(0,0,0,0.3)" }}
  onClick={onClose}
/>
```

Desktop modal panel:
```tsx
<div
  className="relative mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl"
  style={{
    background: "var(--bg-card)",
    border: "1px solid var(--border-mid)",
    boxShadow: "var(--shadow-float)",
  }}
>
```

Mobile bottom sheet:
```tsx
<div
  className="fixed left-0 right-0 rounded-t-2xl"
  style={{
    bottom: 0,
    paddingBottom: "env(safe-area-inset-bottom)",
    background: "var(--bg-card)",
    borderTop: "1px solid var(--border-mid)",
    boxShadow: "var(--shadow-float)",
    zIndex: 50,
  }}
>
  {/* Drag handle — always include */}
  <div className="flex justify-center py-2.5">
    <div className="w-9 h-1 rounded-full" style={{ background: "var(--border-strong)" }} />
  </div>
```

### Cards
```tsx
<div
  className="rounded-xl p-4 transition-all duration-150"
  style={{
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
  }}
>
```

### Inputs
```tsx
<input
  className="w-full rounded-xl px-3 py-2 text-sm outline-none transition-all duration-150"
  style={{
    background: "var(--bg-subtle)",
    border: "1px solid var(--border)",
    color: "var(--fg)",
  }}
/>
```
Mobile inputs MUST use `fontSize: "16px"` to prevent iOS zoom.

### Section labels / uppercase headings
```tsx
<span
  style={{
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--fg-faint)",
  }}
>
  LABEL
</span>
```

### Dividers
```tsx
<div className="h-px" style={{ background: "var(--border)" }} />
```

### Sticky section/group headers
Headers in task list groups and Kanban columns are sticky. Rules:
- `position: "sticky", top: 0, zIndex: 10`
- Background must be **solid** `var(--bg-card)` — no transparency, no tint, so content doesn't bleed through
- **No `borderBottom`** — TickTick style: no border, no shadow when stuck. Just vertical padding
- The card/column that wraps the header must use `overflow: "clip"` (not `overflow: "hidden"`) so sticky isn't blocked. `overflow: clip` preserves visual border-radius clipping without creating a scroll container
- For Kanban columns: use `overflow: "clip"` on the column div (no `overflowY: "auto"`). The outer board wrapper uses `alignItems: "flex-start"` so columns hug their content height. Do NOT use `height: 100%` or `alignItems: "stretch"` on Kanban columns

### Kanban "Add Task" footer button
- The "+ Add Task" footer inside each Kanban column must use `position: "sticky", bottom: 0, background: "var(--bg-card)", zIndex: 5` so it remains visible when the column is tall
- This sticky pattern works when a scrollable ancestor (the page) scrolls past the column

### Task row checkbox alignment (UI list rows)
- The outer row container MUST use `alignItems: "center"` (flexbox) so checkbox and label stay vertically centered
- **Never use `marginTop` offsets** on the checkbox to nudge it into place — those break when font size changes
- Remove any `marginTop` from checkbox buttons; rely on the flex `alignItems: center` of the parent

### Checkbox alignment in the TipTap document/notes editor
- Use `align-items: flex-start` on the `li` element (NOT `center`) — centering misaligns with multi-line text
- Add `margin-top: 0.2em` to the `label` element to optically align the checkbox with the first line's cap height (em-based so it scales with font size)
- This ensures correct alignment for both single-line and multi-line task items
- Checkbox `width`/`height` must be `1em` (NOT fixed px) — this ensures the checkbox scales proportionally when the user changes editor font size
- Gap between checkbox and text content must be `0.6em` (NOT fixed px) so it scales with font size
- See `globals.css` `.ProseMirror ul[data-type="taskList"] li` and `li > label`

### Subtask rows in list view
- **No divider lines between a parent task and its subtasks.** `borderTop` separators must only appear between top-level parent task groups (i.e., above the first row of a new parent group), never above individual subtask rows
- Subtask rows use the `compact` prop on `TaskRow` (`padding: "5px 16px"` instead of `"11px 16px"`) to match the compact spacing in `TaskListView`
- Subtask indentation: wrap the `<TaskRow compact />` in a `<div style={{ paddingLeft: 20 }}>` container

### Subtask drag-and-drop in `TaskListView`

Subtasks are rendered as **flat, independent sortable items** alongside their parent in the same `SortableContext`. Do NOT render subtasks inline inside `renderRow` when DnD is active — use `renderRow(task, skipSubtasks=true)` for parent rows and a separate `SortableSubtaskRow` component for each subtask.

- `SortableSubtaskRow` wraps a subtask with `useSortable({ id: subtask.id })` and spreads `{...attributes} {...listeners}` — no `onPointerDown stopPropagation` needed since it's a sibling, not a child, of the parent's `SortableTaskRow`
- The flat items array for `SortableContext`: `[parent, subtask1, subtask2, nextParent, ...]` — built with `isLast` flag for each item
- Border rule in flat list: show `borderBottom` on an item only if the **next item is a parent task** (or there's no next item)
- `handleDragEnd` detects subtask drags via `draggedTask.parentTaskId`, then handles: reorder within parent (update `parent.subtaskIds` via `arrayMove`), reparent (remove from old parent's `subtaskIds`, insert into new parent's `subtaskIds`, update `parentTaskId`), or promote to standalone (clear `parentTaskId`, assign `sectionId`)
- Subtask ordering is stored in `parent.subtaskIds[]`, not in the subtask's own `order` field. Use `updateTask(parentId, { subtaskIds: [...] })` — never `reorderTasks` — for subtask reordering.

---

## Layout — Floating Panel System

The app uses a **two-panel floating card layout** on desktop (md+). Both panels hover above a root canvas background.

### Structure
```
Root canvas  (var(--color-app-root-bg))  — darkest, behind everything
  ├─ Sidebar card  (var(--sidebar-bg))   — 12px margin, border-radius 12px, --shadow-panel
  └─ Content card  (var(--content-bg))   — 12px margin, border-radius 12px, --shadow-panel
```

### ClientLayout panel rules
- Outer wrapper: `md:p-3 md:gap-3`, `background: var(--color-app-root-bg)`
- Both `<aside>` and `<main>`: `borderRadius: 12`, `boxShadow: "var(--shadow-panel)"`, `overflow: hidden`
- On mobile (< 768px): full-bleed, no card effect, no padding/radius
- Do NOT add `h-screen` to the aside — it fills the parent flex container naturally via `align-items: stretch`
- Do NOT add `borderRight` to the sidebar — the gap between panels acts as the separator

### Nav item active state
- Active pill: `borderRadius: 6px`, 4px horizontal inset from sidebar edges
- Font: 13px, weight 400 inactive / 500 active
- Icons: 16px, `var(--fg-faint)` inactive, `var(--accent)` active
- Row height: 28–32px (use `h-8`)

### Sidebar section labels
- 11px, fontWeight 400, `var(--fg-faint)` — quiet dividers only, no uppercase

### CSS variables — defined per theme × mode in `themes.ts` + `globals.css`
- `--color-app-root-bg`: canvas behind panels (most muted)
- `--sidebar-bg`: sidebar panel background
- `--content-bg`: content panel background
- `--shadow-panel`: floating card elevation shadow

---

## Mobile Rules — ALWAYS follow these

1. **Safe area insets** — all fixed bottom elements must include `paddingBottom: "env(safe-area-inset-bottom)"`. Bottom tab bar height: `calc(56px + env(safe-area-inset-bottom))`.

2. **Bottom clearance** — `<main>` has `pb-20 md:pb-8` to clear the tab bar. Never reduce this.

3. **Font size 16px minimum on inputs** — prevents iOS auto-zoom. Always set `fontSize: "16px"` on `<input>` and `<textarea>` on mobile.

4. **Touch targets** — minimum 44×44px for tappable elements on mobile.

5. **No right-click on mobile** — any feature using `onContextMenu` must have a mobile-equivalent (swipe left action tray or long-press). Do not leave right-click-only interactions without a mobile fallback.

6. **No hover-only states on mobile** — all interactive feedback must work on touch, not just mouse hover.

7. **Z-index hierarchy:**
   ```
   40  — FABs
   50  — Bottom tab bar, popovers
   50  — Modals, overlays  
   9999 — Context menus (must always be on top)
   ```

---

## File & Folder Conventions

- All shared UI primitives → `/components/ui/` (Button, Card, Input, Modal, ContextMenu, etc.)
- Page-level components → `/components/`
- Never create a new button or input by writing raw HTML — import from `/components/ui/`
- Never duplicate logic that already exists in a store

---

## Known Inconsistencies to Fix (do not reproduce these patterns)

| File | Problem |
|------|---------|
| `DocumentContextMenu.tsx` | Uses `bg-zinc-900`, `text-zinc-200`, `border-white/10` — migrate to CSS variables |
| `FocusTunnel.tsx` | Uses inline `style={{ background: "var(--bg)" }}` for full-screen — OK, intentional |
| Various | Mixed `rounded-lg` / `rounded-xl` / `rounded-2xl` on same component types — standardize per the radius scale above |

---

## Viewport-aware date popovers

Never use `<input type="date">` with `showPicker()` for date selection — the browser's native picker appears at an unpredictable location, often off-screen. Instead use `RescheduleDatePopover` from `TaskList.tsx`:

- Anchor is `{ x, y, width, height }` from `getBoundingClientRect()` of the trigger element
- Prefers rendering **above** the anchor; flips **below** if insufficient vertical space
- Horizontally centered on anchor, clamped to viewport edges
- Renders via `createPortal(…, document.body)` so it's never clipped by `overflow: hidden` parents
- Add `data-selection-bar` attribute to the popover root to prevent the selection-clear `pointerdown` listener from firing

## ConnectedTaskContextMenu — bulk selection awareness

When a context menu needs to act on multi-selected tasks, it must read `selectedIds` from the nearest `SelectionContext`. Use `ConnectedTaskContextMenu` (exported from `TaskList.tsx`) instead of `TaskContextMenu` directly inside list views. `ConnectedTaskContextMenu` reads `selectedIds` from context and forwards them to `TaskContextMenu` only when `size > 1`.

**Critical:** The context menu component must be rendered **inside** `<TaskSelectionProvider>` to have access to the selection context. Rendering it outside (e.g., as a sibling to the provider) means `selectedIds` will always be `undefined`, breaking bulk date-change and bulk-complete.

## Manual sort (`SortBy: "manual"`)

When `sortBy === "manual"`, tasks are ordered by their `order` field (lowest first) with no automatic re-sorting by date/title/etc. Users can freely drag-to-reorder tasks and the order persists via `reorderTasks`. The "Restore default" button in `SortFilterPopover` resets to `sortBy: "date"`. `isDefault` check includes `sortBy === "manual"` since manual is also a valid baseline (not an "active filter").

---

## Glass Surface Conventions

### All surfaces are glass — no flat whites or blacks
- `--bg-card` and `--bg-panel` are **always** semi-transparent `color-mix()` values derived from `--tint-h`/`--tint-s`. They MUST NOT be hardcoded hex values.
- `--bg` (solid editor/input background) uses `hsl()` derived from tint — also no hardcoded hex.
- All backgrounds use CSS variables — never hardcoded hex values.

### Dark theme glass targets
Dark themes should feel rich and deep, not black. The canvas is dark slate, panels are glass over it:
- `--bg-app`: ~L8% (darkest layer — `hsl(tint-h, 12%, 8%)`)
- `--bg-panel`: glass at ~L17%, 55% opacity via `color-mix()`
- `--bg-card`: glass at ~L22%, 55% opacity via `color-mix()`
- `--bg` (solid): ~L14% — used for editors, code blocks, inputs

### Light theme glass targets
- `--bg-app`: ~L72% (tinted canvas, noticeably darker than panels)
- `--bg-panel`: glass at ~L82%, 52% opacity via `color-mix()`
- `--bg-card`: glass at ~L88%, 50% opacity via `color-mix()`
- `--bg` (solid): ~L97% — used for editors, inputs

### Themes define only tint + semantic values
Themes in `themes.ts` declare:
- `--tint-h` and `--tint-s` (drive all glass surfaces automatically)
- `--bg` and `--bg-subtle` (solid surfaces for editors/inputs)
- All `--fg-*`, `--accent-*`, `--border-*`, `--priority-*`, `--section-*`, `--shadow-*` tokens

Themes do NOT set `--bg-card`, `--bg-panel`, `--bg-app`, `--sidebar-bg`, `--content-bg`, or `--color-app-root-bg` — those are derived from tint in globals.css.

---

## What NOT to do

- Never use `bg-zinc-*`, `text-zinc-*`, `border-white/*` Tailwind classes for UI surfaces — use CSS variables
- Never hardcode colors like `#18181b`, `#27272a`, `#3f3f46` — use CSS variables
- **Never set `--bg-card`, `--bg-panel`, or `--bg-app` to a solid hex value** — these are glass surfaces derived from tint via `color-mix()`
- **Never add `--bg-card` or glass surface tokens to individual themes in themes.ts** — they derive from `--tint-h`/`--tint-s` globally
- **Never use `border: "1px solid var(--border-mid)"` on floating surfaces** — use `var(--glass-border)` + `var(--glass-border-top)` instead
- Never write a new context menu from scratch — extend the existing pattern
- Never add a new modal backdrop — use the standard one above
- Never use `z-index` values other than those in the hierarchy above
- Never skip `env(safe-area-inset-bottom)` on fixed bottom elements
- Never make a feature that only works via right-click with no mobile fallback
- Never use `font-size` smaller than 16px on mobile inputs
- **Never add a Read-only / lock toggle to document or note editors** — editors are always editable. The `isLocked` / `setIsLocked` pattern was removed; do not re-introduce it
- **Never use `align-items: center` on TipTap task list `li` elements** — use `flex-start` + `margin-top: 0.2em` on the label instead (see globals.css). `center` misaligns checkboxes on multi-line items
- **Never use fixed px for checkbox `width`/`height` in TipTap editors** — use `1em` so the checkbox scales with font size
- **Never add `borderTop` dividers between a parent task and its subtasks** — only between top-level parent groups

## Before Every Commit

- Run `npm run build` locally before pushing to verify the build passes
- Never push code that hasn't been built locally first
- Common build failures to watch for:
  - Conflicting route + page at the same path (Next.js forbids both `route.ts` and `page.tsx` in the same directory)
  - Missing or wrong imports after refactoring
  - TypeScript type errors (build fails on type errors even if dev server runs)
  - The "middleware" file convention is deprecated — use "proxy" instead

## Editor & Text Formatting

- **Inline Toolbar (`EditorBubbleMenu`)**: For quick inline styling (Bold, Italic, Link, Color). Uses TipTap `BubbleMenu`. Positioned securely above text selections.
- **Format Panel (`FormatPanel`)**: For block-level changes (Headers, Lists) and font scaling.
  - Overlays the document from the right.
  - Open state is stored persistently in `localStorage` under `stride-format-panel-open`.
  - Document-specific font selection is stored in `stride-doc-font-[id]`.

---

## Deployment Hygiene

- App router handler files must be named `route.ts`
- Page files must be named `page.tsx`
- These cannot coexist at the same directory path
- This is a static export (`output: 'export'`) — `route.ts` API route handlers will not work and must never be added

---

## Tauri Desktop App

This app is wrapped in Tauri for desktop distribution.

**Key constraints:**
- `output: 'export'` is set in next.config.ts — no server-side features
- No API routes, no Server Components, no Server Actions
- All Supabase calls must use the browser client (`@/lib/supabase/client`)
- All new dynamic routes (e.g. `/something/[id]`) need both:
  - `export const dynamic = 'force-static'`
  - `export async function generateStaticParams() { return [{ id: 'placeholder' }] }`

**Commands:**
- `npm run tauri dev` — run as desktop app
- `npm run tauri build` — build distributable .app / .dmg
- `npm run dev` — still works normally for browser development  

**Building & updating the app:**
- `npm run tauri build` — creates the installable .app file
- Output: `src-tauri/target/release/bundle/macos/Stride.app`
- After building, drag to /Applications to install/update
- Bundle identifier: com.sunyoung.stride

**Dev vs production:**
- `npm run tauri dev` — live dev mode (terminal must stay open, for making changes)
- `npm run tauri build` — creates real standalone .app (no terminal needed)