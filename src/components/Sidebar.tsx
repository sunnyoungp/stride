"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useSectionStore } from "@/store/sectionStore";
import { useProjectStore } from "@/store/projectStore";
import { useTaskStore } from "@/store/taskStore";
import { useDragStore } from "@/store/dragStore";
import { useUIStore } from "@/store/uiStore";
import { SectionContextMenu } from "@/components/SectionContextMenu";
import { ProjectContextMenu } from "@/components/ProjectContextMenu";
import type { TaskSection, Project } from "@/types/index";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".9"/>
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".5"/>
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".5"/>
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".9"/>
      </svg>
    ),
  },
  {
    label: "Notes",
    href: "/notes",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="1.5" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="4.5" y1="5"   x2="10.5" y2="5"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
        <line x1="4.5" y1="7.5" x2="9"    y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
        <line x1="4.5" y1="10"  x2="8"    y2="10"  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
      </svg>
    ),
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="7" width="13" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M1 7l2.5-5h8L14 7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <line x1="5" y1="7" x2="5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
        <line x1="5" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
        <line x1="10" y1="10" x2="10" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
      </svg>
    ),
  },
  {
    label: "Next 7 Days",
    href: "/next7",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="4.5" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
        <rect x="9.1" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
        <line x1="1" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="7.5" y1="8.5" x2="7.5" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="7.5" y1="11" x2="9.5" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="2.5" cy="4" r="1" fill="currentColor"/>
        <circle cx="2.5" cy="7.5" r="1" fill="currentColor"/>
        <circle cx="2.5" cy="11" r="1" fill="currentColor"/>
        <rect x="5" y="3.25" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".8"/>
        <rect x="5" y="6.75" width="6" height="1.5" rx=".75" fill="currentColor" opacity=".8"/>
        <rect x="5" y="10.25" width="7" height="1.5" rx=".75" fill="currentColor" opacity=".8"/>
      </svg>
    ),
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="4.5" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
        <rect x="9.1" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
        <line x1="1" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="5" cy="9.5" r="1" fill="currentColor" opacity=".6"/>
        <circle cx="7.5" cy="9.5" r="1" fill="currentColor" opacity=".6"/>
        <circle cx="10" cy="9.5" r="1" fill="currentColor" opacity=".6"/>
      </svg>
    ),
  },
  {
    label: "Documents",
    href: "/documents",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M3 1.5h6l3 3V13a.5.5 0 01-.5.5h-8.5a.5.5 0 01-.5-.5V2a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M9 1.5V4.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
        <line x1="5" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
      </svg>
    ),
  },
];

const QUICK_ICONS = ["💼", "🏠", "🏃", "🎯", "📚", "🎨", "🌱", "⚡", "🔥", "💡", "🎵", "🏋️", "✈️", "🍎", "💰", "🧪"];

function getSectionColor(s: TaskSection): { bg: string; fg: string } {
  const t = s.title.toLowerCase();
  if (t.includes("work"))   return { bg: "var(--section-work)",     fg: "var(--section-work-fg)" };
  if (t.includes("health")) return { bg: "var(--section-health)",   fg: "var(--section-health-fg)" };
  return                           { bg: "var(--section-personal)", fg: "var(--section-personal-fg)" };
}

// ── Icon picker ───────────────────────────────────────────────────────────────

function IconPicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (icon: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      const h = (e: PointerEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      };
      window.addEventListener("pointerdown", h);
      return () => window.removeEventListener("pointerdown", h);
    }, 50);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-10 z-50 rounded-xl p-2"
      style={{
        width: 196,
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div className="flex flex-wrap gap-1 mb-2">
        {QUICK_ICONS.map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => { onChange(em); onClose(); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-all duration-100 hover:bg-[var(--bg-hover)]"
            style={value === em ? { background: "var(--bg-active)" } : {}}
          >
            {em}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { onChange(custom); onClose(); }
            if (e.key === "Escape") onClose();
          }}
          placeholder="Custom…"
          className="flex-1 h-7 rounded-lg px-2 text-sm outline-none"
          style={{
            border: "1px solid var(--border-mid)",
            background: "var(--bg-card)",
            color: "var(--fg)",
          }}
        />
        <button
          type="button"
          onClick={() => { onChange(custom); onClose(); }}
          className="h-7 px-2 rounded-lg text-xs hover:bg-[var(--bg-hover)] transition-colors"
          style={{ color: "var(--fg-muted)" }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ── Deleted sections popover ──────────────────────────────────────────────────

function DeletedSectionsPopover({ onClose }: { onClose: () => void }) {
  const deletedSections = useSectionStore((s) => s.deletedSections);
  const restoreSection  = useSectionStore((s) => s.restoreSection);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const h = (e: PointerEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      };
      window.addEventListener("pointerdown", h);
      return () => window.removeEventListener("pointerdown", h);
    }, 50);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 bottom-8 z-50 rounded-xl p-1"
      style={{
        width: 188,
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-faint)" }}>
        Recently deleted
      </div>
      {deletedSections.length === 0 && (
        <div className="px-2 py-2 text-xs italic" style={{ color: "var(--fg-faint)" }}>Nothing here</div>
      )}
      {deletedSections.map((s) => (
        <div key={s.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-hover)]">
          {s.icon
            ? <span className="text-sm flex-none">{s.icon}</span>
            : <span className="h-2 w-2 rounded-full flex-none" style={{ background: "var(--fg-faint)" }} />
          }
          <span className="flex-1 truncate text-xs" style={{ color: "var(--fg-muted)" }}>{s.title}</span>
          <button
            type="button"
            onClick={() => void restoreSection(s.id)}
            className="text-[11px] px-1.5 py-0.5 rounded-md hover:bg-[var(--accent-bg)] transition-colors"
            style={{ color: "var(--accent)" }}
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const sections        = useSectionStore((s) => s.sections);
  const deletedSections = useSectionStore((s) => s.deletedSections);
  const createSection   = useSectionStore((s) => s.createSection);
  const updateSection   = useSectionStore((s) => s.updateSection);
  const deleteSection   = useSectionStore((s) => s.deleteSection);
  const createSubsection = useSectionStore((s) => s.createSubsection);

  const projects     = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  const updateTask     = useTaskStore((s) => s.updateTask);
  const draggingTaskId = useDragStore((s) => s.draggingTaskId);
  const openSearch     = useUIStore((s) => s.openSearch);

  const [isDark, setIsDark] = useState(false);

  // New section creation
  const [creating, setCreating]   = useState(false);
  const [draft, setDraft]         = useState("");
  const [draftIcon, setDraftIcon] = useState("");
  const [showNewIconPicker, setShowNewIconPicker] = useState(false);

  // Inline rename
  const [renamingId, setRenamingId]   = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Inline icon edit
  const [iconEditId, setIconEditId] = useState<string | null>(null);

  // Drag-to-section
  const [hoverSectionId, setHoverSectionId] = useState<string | null>(null);

  // Subsection creation
  const [addingSubSectionId, setAddingSubSectionId] = useState<string | null>(null);
  const [draftSub, setDraftSub] = useState("");

  // Context menus
  const [sectionMenu, setSectionMenu] = useState<{ section: TaskSection; x: number; y: number } | null>(null);
  const [projectMenu, setProjectMenu] = useState<{ project: Project; x: number; y: number } | null>(null);

  // Recently deleted popover
  const [showDeleted, setShowDeleted] = useState(false);

  const pathname = usePathname();

  // Read nav visibility/order config from localStorage
  const visibleNavItems = useMemo(() => {
    if (typeof window === "undefined") return NAV_ITEMS;
    try {
      const raw = localStorage.getItem("stride-nav-config");
      if (!raw) return NAV_ITEMS;
      const config = JSON.parse(raw) as { id: string; visible: boolean; order: number }[];
      const sorted = [...config].sort((a, b) => a.order - b.order);
      return sorted
        .filter((c) => c.visible)
        .map((c) => NAV_ITEMS.find((n) => n.href === c.id))
        .filter(Boolean) as typeof NAV_ITEMS;
    } catch { return NAV_ITEMS; }
  }, []);

  useEffect(() => {
    void loadProjects();
    setIsDark(document.documentElement.classList.contains("dark"));
  }, [loadProjects]);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("stride-theme", next ? "dark" : "light");
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const commitSection = () => {
    const title = draft.trim();
    if (!title) { setDraft(""); setDraftIcon(""); setCreating(false); return; }
    void createSection(title, undefined, draftIcon || undefined);
    setDraft(""); setDraftIcon(""); setCreating(false); setShowNewIconPicker(false);
  };

  const commitRename = (id: string) => {
    const title = renameDraft.trim();
    if (title) void updateSection(id, { title });
    setRenamingId(null); setRenameDraft("");
  };

  return (
    <div
      className="flex h-full w-[220px] flex-col overflow-y-auto overflow-x-hidden select-none"
      style={{
        background: "var(--bg-sidebar)",
        boxShadow: "2px 0 16px rgba(30,20,10,0.06)",
        zIndex: 10,
        position: "relative",
      }}
    >
      {/* ── Logo ── */}
      <div className="px-4 pt-5 pb-5 flex-none">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 flex-none items-center justify-center rounded-xl"
            style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(232,96,60,0.30)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 13 L8 3 L13 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="5" y1="9.5" x2="11" y2="9.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-[18px] font-bold tracking-tight" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
            Stride
          </span>
        </div>
      </div>

      {/* ── Search button ── */}
      <div className="px-2 pb-2 flex-none">
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg-faint)" }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ flex: 1, textAlign: "left" }}>Search</span>
          <kbd style={{
            fontSize: 10, padding: "1px 5px", borderRadius: 5,
            background: "var(--bg-hover)", border: "1px solid var(--border)",
            color: "var(--fg-faint)", lineHeight: "1.6",
          }}>⌘F</kbd>
        </button>
      </div>

      {/* ── Primary nav ── */}
      <nav className="flex flex-col gap-1 px-2 flex-none">
        {visibleNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-[470] transition-all duration-150 ease-out"
              style={{
                background: active ? "var(--bg-active)" : "transparent",
                color: active ? "var(--accent)" : "var(--fg-muted)",
              }}
            >
              <span className="flex-none" style={{ color: active ? "var(--accent)" : "var(--fg-faint)" }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Sections ── */}
      <div className="mt-5 flex-none px-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--fg-faint)" }}>
            Sections
          </span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-4 w-4 items-center justify-center rounded-full text-xs transition-all duration-150 hover:opacity-80"
            style={{ color: "var(--fg-faint)" }}
            title="New section"
          >
            +
          </button>
        </div>

        {/* Pill grid */}
        <div className="flex flex-wrap gap-1.5">
          {sections.map((s) => {
            const c = getSectionColor(s);
            const isDropTarget = draggingTaskId !== null && hoverSectionId === s.id;
            const isRenaming   = renamingId === s.id;
            const isEditingIcon = iconEditId === s.id;

            if (isRenaming) {
              return (
                <input
                  key={s.id}
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  commitRename(s.id);
                    if (e.key === "Escape") { setRenamingId(null); setRenameDraft(""); }
                  }}
                  onBlur={() => commitRename(s.id)}
                  className="rounded-full px-2.5 py-1 text-[12px] outline-none"
                  style={{
                    background: c.bg,
                    color: c.fg,
                    border: "2px solid var(--accent)",
                    minWidth: 60,
                    maxWidth: 120,
                  }}
                />
              );
            }

            return (
              <div key={s.id} className="relative">
                <Link
                  href={`/tasks?sectionId=${s.id}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSectionMenu({ section: s, x: e.clientX, y: e.clientY });
                  }}
                  onPointerEnter={() => { if (draggingTaskId) setHoverSectionId(s.id); }}
                  onPointerLeave={() => { if (draggingTaskId) setHoverSectionId(null); }}
                  onPointerUp={() => {
                    if (draggingTaskId) {
                      void updateTask(draggingTaskId, { sectionId: s.id });
                      setHoverSectionId(null);
                    }
                  }}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-[480] transition-all duration-150 ease-out hover:opacity-90"
                  style={{
                    background: isDropTarget ? "var(--accent)" : c.bg,
                    color: isDropTarget ? "white" : c.fg,
                    outline: isDropTarget ? "2px solid var(--accent)" : "none",
                    outlineOffset: 2,
                  }}
                >
                  {s.icon
                    ? <span className="text-[10px]">{s.icon}</span>
                    : <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ background: c.fg, opacity: 0.6 }} />
                  }
                  <span>{s.title}</span>
                </Link>

                {/* Icon picker anchored to this pill */}
                {isEditingIcon && (
                  <IconPicker
                    value={s.icon ?? ""}
                    onChange={(icon) => void updateSection(s.id, { icon: icon || undefined })}
                    onClose={() => setIconEditId(null)}
                  />
                )}
              </div>
            );
          })}

          {sections.length === 0 && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-full px-2.5 py-1 text-[12px] transition-all duration-150 hover:opacity-80"
              style={{ background: "var(--bg-hover)", color: "var(--fg-faint)" }}
            >
              + Add section
            </button>
          )}
        </div>

        {/* New section row: icon button + text input */}
        {creating && (
          <div className="mt-2 relative flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowNewIconPicker((v) => !v)}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-sm transition-colors hover:bg-[var(--bg-hover)]"
              style={{ border: "1px solid var(--border-mid)", background: "var(--bg-card)" }}
              title="Pick icon"
            >
              {draftIcon || <span style={{ color: "var(--fg-faint)" }}>✦</span>}
            </button>

            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setDraft(""); setDraftIcon(""); setCreating(false); }
                if (e.key === "Enter")  commitSection();
              }}
              onBlur={() => { if (!draft.trim()) { setDraft(""); setDraftIcon(""); setCreating(false); } }}
              placeholder="Section name…"
              className="flex-1 h-8 rounded-xl px-3 text-xs outline-none"
              style={{ border: "1px solid var(--border-mid)", background: "var(--bg-card)", color: "var(--fg)" }}
            />

            {showNewIconPicker && (
              <IconPicker
                value={draftIcon}
                onChange={(icon) => setDraftIcon(icon)}
                onClose={() => setShowNewIconPicker(false)}
              />
            )}
          </div>
        )}

        {/* Subsection add input */}
        {addingSubSectionId && (
          <input
            autoFocus
            value={draftSub}
            onChange={(e) => setDraftSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setAddingSubSectionId(null); setDraftSub(""); }
              if (e.key === "Enter") {
                const title = draftSub.trim();
                if (title) void createSubsection(title, addingSubSectionId);
                setAddingSubSectionId(null); setDraftSub("");
              }
            }}
            placeholder="Subsection…"
            className="mt-2 h-8 w-full rounded-xl px-3 text-xs outline-none"
            style={{ border: "1px solid var(--border-mid)", background: "var(--bg-card)", color: "var(--fg)" }}
          />
        )}

        {/* Recently deleted */}
        {deletedSections.length > 0 && (
          <div className="mt-2 relative">
            <button
              type="button"
              onClick={() => setShowDeleted((v) => !v)}
              className="text-[11px] transition-colors hover:opacity-80"
              style={{ color: "var(--fg-faint)" }}
            >
              Recently deleted ({deletedSections.length})
            </button>
            {showDeleted && <DeletedSectionsPopover onClose={() => setShowDeleted(false)} />}
          </div>
        )}
      </div>

      {/* ── Projects ── */}
      {projects.length > 0 && (
        <div className="mt-5 flex-none px-4">
          <div className="mb-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--fg-faint)" }}>
              Projects
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${encodeURIComponent(p.title)}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setProjectMenu({ project: p, x: e.clientX, y: e.clientY });
                }}
                className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--fg-muted)" }}
              >
                <span className="h-2 w-2 rounded-full flex-none" style={{ background: p.color ?? "var(--fg-faint)" }} />
                <span className="truncate">{p.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Bottom bar ── */}
      <div className="flex-none px-3 pb-5 pt-3">
        <div className="h-px mb-3" style={{ background: "var(--border)" }} />
        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            className="flex h-8 flex-1 items-center gap-2.5 rounded-xl px-3 text-[13px] transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg-muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.1 1.1M10 10l1.1 1.1M2.9 11.1L4 10M10 4l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Settings
          </Link>
          <button
            type="button"
            onClick={toggleDark}
            title={isDark ? "Light mode" : "Dark mode"}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-xl transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg-muted)" }}
          >
            {isDark ? (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3 3l1.1 1.1M9.9 9.9 11 11M3 12l1.1-1.1M9.9 5.1 11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12.5 9A6 6 0 015 1.5a6 6 0 100 11 6 6 0 007.5-3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Context menus ── */}
      {sectionMenu && (
        <SectionContextMenu
          section={sectionMenu.section}
          position={{ x: sectionMenu.x, y: sectionMenu.y }}
          onClose={() => setSectionMenu(null)}
          onAddSubsection={() => {
            setAddingSubSectionId(sectionMenu.section.id);
          }}
          onRename={() => {
            setRenamingId(sectionMenu.section.id);
            setRenameDraft(sectionMenu.section.title);
          }}
          onEditIcon={() => {
            setIconEditId(sectionMenu.section.id);
          }}
          onDelete={() => {
            // Capture before onClose() runs (MenuItem calls onClose after this returns)
            const id    = sectionMenu.section.id;
            const title = sectionMenu.section.title;
            if (window.confirm(`Delete "${title}"? Tasks in this section will become unsorted.`)) {
              void deleteSection(id);
            }
          }}
        />
      )}
      {projectMenu && (
        <ProjectContextMenu
          project={projectMenu.project}
          position={{ x: projectMenu.x, y: projectMenu.y }}
          onClose={() => setProjectMenu(null)}
        />
      )}
    </div>
  );
}
