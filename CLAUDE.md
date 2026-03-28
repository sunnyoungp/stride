# Stride — Claude Code Instructions

## Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
- State: Zustand stores in `/store/`
- Components: `/components/`
- Types: `/types/index.ts`

---

## Kanban — applies to ALL three pages

Kanban view exists on **Tasks** (`/app/tasks/page.tsx`), **Inbox** (`/app/inbox/page.tsx`), and **Next 7 Days** (`/app/next7/page.tsx`). All three share the same `KanbanBoard` component.

**Any change to Kanban behavior — cards, interactions, right-click menus, inline inputs, column headers, `onAddTask` — must be applied to all three pages.** Never patch only one page.

---

## Design System — ALWAYS use these, never hardcode values

### CSS Variables (defined in globals.css / SettingsApplier.tsx)
All colors, spacing, and surfaces MUST use these variables. Never use Tailwind color classes like `bg-zinc-900`, `text-zinc-200`, `border-white/10`, or hardcoded hex values like `#18181b` for UI surfaces.

```
/* Surfaces */
--bg                  base page background
--bg-card             card / panel background
--bg-subtle           input backgrounds, secondary surfaces
--bg-hover            hover state background
--bg-active           selected/active state background

/* Text */
--fg                  primary text
--fg-muted            secondary text
--fg-faint            tertiary / placeholder text

/* Borders */
--border              default border
--border-mid          slightly stronger border (for cards, menus)
--border-strong       strong border (drag handles, dividers)

/* Accent */
--accent              primary brand color (orange, user-configurable)
--accent-bg           accent tint background
--accent-bg-strong    stronger accent tint

/* Shadows */
--shadow-lg           standard elevated shadow
--shadow-float        floating element shadow (modals, popovers)
--shadow-panel        floating card shadow (sidebar + content panels)
                      Light: 0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)
                      Dark:  0 4px 24px rgba(0,0,0,0.40), 0 1px 4px rgba(0,0,0,0.20)

/* Layout depth — three-layer floating panel system */
--color-app-root-bg   root canvas behind both panels (darkest/most muted layer)
--sidebar-bg          floating sidebar panel background (mid layer)
--content-bg          floating content panel background (top/lightest layer)

/* Priority */
--priority-high
--priority-medium
--priority-low
```

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
Use ONE consistent pattern across ALL context menus. The correct pattern is `ProjectContextMenu` and `SectionContextMenu` (they use CSS variables). Do NOT follow the old `DocumentContextMenu` pattern (it uses hardcoded `bg-zinc-900`, `text-zinc-200`, `border-white/10` — this is wrong and should be migrated).

Correct context menu shell:
```tsx
<div
  ref={menuRef}
  style={{
    left: clampedPos.x,
    top: clampedPos.y,
    background: "var(--bg-card)",
    border: "1px solid var(--border-mid)",
    boxShadow: "var(--shadow-lg)",
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
- For Kanban columns: move `overflowY: "auto"` to the column container (not the tasks inner div), and set `alignItems: "stretch"` on the outer board so columns fill full height

### Task row checkbox alignment
- The outer row container MUST use `alignItems: "center"` (flexbox) so checkbox and label stay vertically centered
- **Never use `marginTop` offsets** on the checkbox to nudge it into place — those break when font size changes
- Remove any `marginTop` from checkbox buttons; rely on the flex `alignItems: center` of the parent

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

## What NOT to do

- Never use `bg-zinc-*`, `text-zinc-*`, `border-white/*` Tailwind classes for UI surfaces — use CSS variables
- Never hardcode colors like `#18181b`, `#27272a`, `#3f3f46` — use CSS variables  
- Never write a new context menu from scratch — extend the existing pattern
- Never add a new modal backdrop — use the standard one above
- Never use `z-index` values other than those in the hierarchy above
- Never skip `env(safe-area-inset-bottom)` on fixed bottom elements
- Never make a feature that only works via right-click with no mobile fallback
- Never use `font-size` smaller than 16px on mobile inputs

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