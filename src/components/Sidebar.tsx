"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { useSectionStore } from "@/store/sectionStore";
import { useProjectStore } from "@/store/projectStore";
import { useTaskStore } from "@/store/taskStore";
import { useDragStore } from "@/store/dragStore";
import { useUIStore } from "@/store/uiStore";
import { SectionContextMenu } from "@/components/SectionContextMenu";
import { appConfirm } from "@/lib/confirm";
import { ProjectContextMenu } from "@/components/ProjectContextMenu";
import { useDocumentStore } from "@/store/documentStore";
import type { TaskSection, Project } from "@/types/index";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES } from "@/lib/themes";

const PINNED_DOCS_KEY = "stride-pinned-docs";
function getPinnedDocIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(PINNED_DOCS_KEY) ?? "[]") as string[]); }
  catch { return new Set(); }
}

const HIDDEN_SECTIONS_KEY = "stride-hidden-sections";

function getHiddenSectionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_SECTIONS_KEY) ?? "[]") as string[]); }
  catch { return new Set(); }
}

function setHiddenSectionIds(ids: Set<string>) {
  localStorage.setItem(HIDDEN_SECTIONS_KEY, JSON.stringify([...ids]));
}

// ── ManageSectionsModal ────────────────────────────────────────────────────────

function ManageSectionsModal({
  sections,
  onClose,
  onSave,
}: {
  sections: TaskSection[];
  onClose: () => void;
  onSave: (orderedIds: string[], hiddenIds: Set<string>) => void;
}) {
  const [order, setOrder] = useState(() => sections.map((s) => s.id));
  const [hidden, setHidden] = useState<Set<string>>(getHiddenSectionIds);
  const dragIdx = useRef<number | null>(null);

  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  const move = (from: number, to: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl mx-4 overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-float)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Manage Sections</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xs hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--fg-faint)" }}>✕</button>
        </div>

        <p className="px-5 pb-3 text-xs" style={{ color: "var(--fg-faint)" }}>
          Drag to reorder · Toggle eye to hide
        </p>

        {/* Section list */}
        <div className="px-3 pb-3 flex flex-col gap-1">
          {order.map((id, idx) => {
            const s = sectionMap.get(id);
            if (!s) return null;
            const isHidden = hidden.has(id);
            return (
              <div
                key={id}
                draggable
                onDragStart={() => { dragIdx.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => {
                  if (dragIdx.current !== null && dragIdx.current !== idx) {
                    move(dragIdx.current, idx);
                  }
                  dragIdx.current = null;
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                style={{ cursor: "grab", background: "var(--bg-subtle)", opacity: isHidden ? 0.5 : 1 }}
              >
                {/* Grip */}
                <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" style={{ color: "var(--fg-faint)", flexShrink: 0 }}>
                  <circle cx="3" cy="3" r="1.3"/><circle cx="9" cy="3" r="1.3"/>
                  <circle cx="3" cy="8" r="1.3"/><circle cx="9" cy="8" r="1.3"/>
                  <circle cx="3" cy="13" r="1.3"/><circle cx="9" cy="13" r="1.3"/>
                </svg>

                {/* Icon + title */}
                <span className="flex-1 flex items-center gap-2 text-sm" style={{ color: "var(--fg)" }}>
                  {s.icon && <span className="text-base">{s.icon}</span>}
                  {s.title}
                </span>

                {/* Visibility toggle */}
                <button
                  type="button"
                  onClick={() => setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                  className="rounded-lg p-1 transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: isHidden ? "var(--fg-faint)" : "var(--fg-muted)" }}
                  title={isHidden ? "Show" : "Hide"}
                >
                  {isHidden
                    ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M5.3 5.4A2.5 2.5 0 009.5 9M2 4.5C3.3 3 5 2 7 2c2 0 3.7 1 5 2.5M12 9.5C10.7 11 9 12 7 12c-2 0-3.7-1-5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>
                  }
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg)" }}
          >Cancel</button>
          <button type="button" onClick={() => { onSave(order, hidden); onClose(); }}
            className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
            style={{ background: "var(--accent)", color: "white" }}
          >Save</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

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
  position,
}: {
  value: string;
  onChange: (icon: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: Math.min(position.x, window.innerWidth - 212),
        top: position.y + 4,
        zIndex: 9999,
        width: 196,
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        boxShadow: "var(--shadow-lg)",
        borderRadius: 12,
        padding: 8,
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
          className="flex-1 h-7 rounded-xl px-2 outline-none"
          style={{
            border: "1px solid var(--border-mid)",
            background: "var(--bg-card)",
            color: "var(--fg)",
            fontSize: "16px",
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
    </div>,
    document.body,
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
      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase" style={{ color: "var(--fg-faint)" }}>
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

  const documents     = useDocumentStore((s) => s.documents);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);

  const [pinnedDocIds, setPinnedDocIds] = useState<Set<string>>(new Set());

  const updateTask     = useTaskStore((s) => s.updateTask);
  const draggingTaskId = useDragStore((s) => s.draggingTaskId);
  const openSearch     = useUIStore((s) => s.openSearch);

  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const { currentTheme, setTheme } = useTheme();
  const isDark = THEMES.find(t => t.id === currentTheme)?.type === "dark";

  // New section creation
  const [creating, setCreating]   = useState(false);
  const [draft, setDraft]         = useState("");
  const [draftIcon, setDraftIcon] = useState("");
  const [showNewIconPicker, setShowNewIconPicker] = useState(false);
  const [newIconPickerPos, setNewIconPickerPos] = useState({ x: 0, y: 0 });

  // Inline rename
  const [renamingId, setRenamingId]   = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Inline icon edit (with anchor position for portal)
  const [iconEditState, setIconEditState] = useState<{ id: string; x: number; y: number } | null>(null);

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

  // Manage sections modal
  const [showManage, setShowManage] = useState(false);
  const [hiddenSectionIds, setHiddenSectionIdsState] = useState<Set<string>>(new Set());

  const pathname = usePathname();

  // Detect collapsed state (md breakpoint: 768px–1023px)
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    const update = () => setIsCollapsed(window.innerWidth >= 768 && window.innerWidth < 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Read nav visibility/order config from localStorage, react to storage events
  const parseNavConfig = (): typeof NAV_ITEMS => {
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
  };

  const [visibleNavItems, setVisibleNavItems] = useState<typeof NAV_ITEMS>(NAV_ITEMS);

  useEffect(() => {
    // Read persisted state on mount (client-only, avoids SSR mismatch)
    setVisibleNavItems(parseNavConfig());
    setPinnedDocIds(getPinnedDocIds());
    setHiddenSectionIdsState(getHiddenSectionIds());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "stride-nav-config") setVisibleNavItems(parseNavConfig());
      if (e.key === PINNED_DOCS_KEY) setPinnedDocIds(getPinnedDocIds());
      if (e.key === HIDDEN_SECTIONS_KEY) setHiddenSectionIdsState(getHiddenSectionIds());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadDocuments();
  }, [loadProjects, loadDocuments]);

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

  // ── Collapsed (icon-only) render for md breakpoint ───────────────────────
  if (isCollapsed) {
    return (
      <div
        className="flex h-full w-14 flex-col items-center overflow-y-auto overflow-x-hidden select-none py-4 gap-1"
        style={{
          background: "var(--sidebar-bg)",
          zIndex: 10,
          position: "relative",
        }}
      >
        {/* Logo icon */}
        <div
          className="mb-3 flex h-8 w-8 flex-none items-center justify-center rounded-xl"
          style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(232,96,60,0.30)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 13 L8 3 L13 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="5" y1="9.5" x2="11" y2="9.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Search icon */}
        <button
          type="button"
          onClick={openSearch}
          title="Search (⌘F)"
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg-faint)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Nav icons */}
        {visibleNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 ease-out"
              style={{
                background: active ? "var(--bg-active)" : "transparent",
                color: active ? "var(--accent)" : "var(--fg-faint)",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.06)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              {item.icon}
            </Link>
          );
        })}

        <div className="flex-1" />

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg-muted)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 12H2.5A1.5 1.5 0 011 10.5v-7A1.5 1.5 0 012.5 2H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M9.5 10L13 7l-3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="13" y1="7" x2="5" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(isDark ? "neutral-light" : "neutral-dark")}
          title={isDark ? "Switch to light" : "Switch to dark"}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg-muted)" }}
        >
          {isDark ? (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3 3l1.1 1.1M9.9 9.9 11 11M3 12l1.1-1.1M9.9 5.1 11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-[220px] flex-col overflow-y-auto overflow-x-hidden select-none"
      style={{
        background: "var(--sidebar-bg)",
        zIndex: 10,
        position: "relative",
      }}
    >
      {/* ── Search button ── */}
      <div className="px-2 pt-5 pb-2 flex-none">
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full h-8 items-center gap-2.5 rounded-md px-3 text-[13px] transition-all duration-150 ease-out"
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          style={{ color: "var(--fg-faint)" }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ flex: 1, textAlign: "left" }}>Search</span>
          <kbd className="hidden md:inline-flex" style={{
            fontSize: 10, padding: "1px 5px", borderRadius: 4,
            background: "var(--bg-hover)", border: "1px solid var(--border)",
            color: "var(--fg-faint)", lineHeight: "1.6",
          }}>⌘F</kbd>
        </button>
      </div>

      {/* ── Primary nav ── */}
      <nav className="flex flex-col gap-0.5 px-1 flex-none">
        {visibleNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-3 text-[13px] transition-all duration-150 ease-out"
              style={{
                fontWeight: active ? 500 : 400,
                background: active ? "var(--bg-active)" : "transparent",
                color: active ? "var(--accent)" : "var(--fg-muted)",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.06)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? "var(--bg-active)" : "transparent"; }}
            >
              <span className="flex-none" style={{ fontSize: 16, color: active ? "var(--accent)" : "var(--fg-faint)" }}>
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
          <span className="text-[11px]" style={{ color: "var(--fg-faint)", fontWeight: 400 }}>
            Sections
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowManage(true)}
              className="flex h-4 w-4 items-center justify-center rounded transition-all duration-150 hover:opacity-80"
              style={{ color: "var(--fg-faint)" }}
              title="Manage sections"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.1 1.1M10 10l1.1 1.1M2.9 11.1L4 10M10 4l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
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
        </div>

        {/* Pill grid */}
        <div className="flex flex-wrap gap-1.5">
          {sections.filter((s) => !hiddenSectionIds.has(s.id)).map((s) => {
            const c = getSectionColor(s);
            const isDropTarget = draggingTaskId !== null && hoverSectionId === s.id;
            const isRenaming   = renamingId === s.id;
            const isEditingIcon = iconEditState?.id === s.id;

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
                  className="rounded-full px-2.5 py-1 outline-none"
                  style={{
                    background: c.bg,
                    color: c.fg,
                    border: "2px solid var(--accent)",
                    minWidth: 60,
                    maxWidth: 120,
                    fontSize: "16px",
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

                {/* Icon picker portal */}
                {isEditingIcon && iconEditState && (
                  <IconPicker
                    value={s.icon ?? ""}
                    onChange={(icon) => void updateSection(s.id, { icon: icon || undefined })}
                    onClose={() => setIconEditState(null)}
                    position={{ x: iconEditState.x, y: iconEditState.y }}
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
          <div className="mt-2 flex w-full min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setNewIconPickerPos({ x: r.left, y: r.bottom });
                setShowNewIconPicker((v) => !v);
              }}
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
              className="min-w-0 flex-1 h-8 rounded-xl px-3 outline-none"
              style={{ border: "1px solid var(--border-mid)", background: "var(--bg-card)", color: "var(--fg)", fontSize: "16px" }}
            />

            {showNewIconPicker && (
              <IconPicker
                value={draftIcon}
                onChange={(icon) => setDraftIcon(icon)}
                onClose={() => setShowNewIconPicker(false)}
                position={newIconPickerPos}
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
            className="mt-2 h-8 w-full rounded-xl px-3 outline-none"
            style={{ border: "1px solid var(--border-mid)", background: "var(--bg-card)", color: "var(--fg)", fontSize: "16px" }}
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

      {/* ── Projects ──
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
      )} */}

      {/* ── Pinned documents ── */}
      {pinnedDocIds.size > 0 && (() => {
        const pinned = documents.filter((d) => pinnedDocIds.has(d.id));
        if (pinned.length === 0) return null;
        return (
          <div className="mt-5 flex-none px-4">
            <div className="mb-2.5">
              <span className="text-[11px]" style={{ color: "var(--fg-faint)", fontWeight: 400 }}>
                Pinned
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {pinned.map((d) => (
                <Link
                  key={d.id}
                  href={`/documents?id=${d.id}`}
                  className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--fg-muted)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: "var(--fg-faint)" }}>
                    <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <line x1="3" y1="4" x2="9" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".7"/>
                    <line x1="3" y1="6" x2="7.5" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".7"/>
                    <line x1="3" y1="8" x2="6.5" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".7"/>
                  </svg>
                  <span className="truncate">{d.title || "Untitled"}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

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
            onClick={() => setTheme(isDark ? "neutral-light" : "neutral-dark")}
            title={isDark ? "Switch to light" : "Switch to dark"}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-xl transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg-muted)" }}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path 
                  d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-xl transition-all duration-150 ease-out hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg-muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 12H2.5A1.5 1.5 0 011 10.5v-7A1.5 1.5 0 012.5 2H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M9.5 10L13 7l-3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="13" y1="7" x2="5" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
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
            setIconEditState({ id: sectionMenu.section.id, x: sectionMenu.x, y: sectionMenu.y });
          }}
          onDelete={() => {
            // Capture before onClose() runs (MenuItem calls onClose after this returns)
            const id    = sectionMenu.section.id;
            const title = sectionMenu.section.title;
            void appConfirm(`Delete "${title}"? Tasks in this section will become unsorted.`).then((ok) => {
              if (ok) void deleteSection(id);
            });
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

      {showManage && (
        <ManageSectionsModal
          sections={[...sections].sort((a, b) => a.order - b.order)}
          onClose={() => setShowManage(false)}
          onSave={(orderedIds, hiddenIds) => {
            orderedIds.forEach((id, idx) => {
              const s = sections.find((sec) => sec.id === id);
              if (s && s.order !== idx) void updateSection(id, { order: idx });
            });
            setHiddenSectionIds(hiddenIds);
            setHiddenSectionIdsState(new Set(hiddenIds));
          }}
        />
      )}
    </div>
  );
}
