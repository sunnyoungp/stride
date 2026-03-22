# Stride — Claude Code Instructions

## Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
- State: Zustand stores in `/store/`
- Components: `/components/`
- Types: `/types/index.ts`

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

### Typography scale
```
10px / text-[10px]   — labels, uppercase tags
11px / text-[11px]   — meta info, timestamps, badges
12px / text-xs       — secondary actions, chips
13px / text-[13px]   — column headers, section titles
14px / text-sm       — body, menu items, list items
16px / text-base     — input text (mobile: always 16px to prevent zoom)
24px / text-2xl      — page titles
30px / text-3xl      — document titles
```

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
