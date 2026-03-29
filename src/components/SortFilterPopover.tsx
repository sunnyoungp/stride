"use client";

import { useEffect, useRef, useState } from "react";

export type GroupBy = "list" | "date" | "tag" | "priority";
export type SortBy = "date" | "title" | "tag" | "priority" | "manual";

export const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "list", label: "List" },
  { key: "date", label: "Date" },
  { key: "tag", label: "Tag" },
  { key: "priority", label: "Priority" },
];

export const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "title", label: "Title" },
  { key: "tag", label: "Tag" },
  { key: "priority", label: "Priority" },
  { key: "manual", label: "Manual" },
];

type Props = {
  groupBy: GroupBy;
  sortBy: SortBy;
  onGroupByChange: (g: GroupBy) => void;
  onSortByChange: (s: SortBy) => void;
  anchor: { x: number; y: number };
  onClose: () => void;
};

function GroupByIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color: "var(--fg-muted)" }}>
      <rect x="1" y="3" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="10" width="10" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

function SortByIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color: "var(--fg-muted)" }}>
      <path d="M2 4h10M2 8h7M2 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13 6v7m0 0-2-2m2 2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function SortFilterPopover({
  groupBy, sortBy, onGroupByChange, onSortByChange, anchor, onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [expandGroup, setExpandGroup] = useState(false);
  const [expandSort, setExpandSort] = useState(false);

  const pos = (() => {
    const pw = 256, p = 8;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    let left = anchor.x;
    let top = anchor.y + 6;
    if (left + pw > vw - p) left = vw - pw - p;
    if (left < p) left = p;
    // Estimated height — flip up if near bottom
    const estH = 130 + (expandGroup ? 168 : 0) + (expandSort ? 168 : 0);
    if (top + estH > vh - p) top = anchor.y - estH - 6;
    return { left, top };
  })();

  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => window.addEventListener("pointerdown", h), 80);
    return () => { clearTimeout(timer); window.removeEventListener("pointerdown", h); };
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const isDefault = (sortBy === "date" || sortBy === "manual") && groupBy === "list";
  const groupLabel = GROUP_OPTIONS.find(o => o.key === groupBy)?.label ?? "List";
  const sortLabel = SORT_OPTIONS.find(o => o.key === sortBy)?.label ?? "Date";

  const rowBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px", width: "100%",
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 14, color: "var(--fg)", fontFamily: "inherit",
    textAlign: "left",
    transition: "background 100ms",
  };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: 256,
        zIndex: 9999,
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        borderRadius: 12,
        boxShadow: "var(--shadow-float)",
        overflow: "hidden",
      }}
    >
      {/* Group by */}
      <button
        type="button"
        style={{ ...rowBase, background: expandGroup ? "var(--bg-hover)" : "transparent" }}
        onClick={() => { setExpandGroup(e => !e); setExpandSort(false); }}
        onMouseEnter={e => { if (!expandGroup) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={e => { if (!expandGroup) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <GroupByIcon />
          <span style={{ fontWeight: 500 }}>Group by</span>
        </span>
        <span style={{ fontSize: 13, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 3 }}>
          {groupLabel}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expandGroup ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>
            <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </span>
      </button>

      {expandGroup && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {GROUP_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              style={{
                ...rowBase,
                paddingLeft: 40,
                color: groupBy === opt.key ? "var(--accent)" : "var(--fg)",
                fontWeight: groupBy === opt.key ? 500 : 400,
              }}
              onClick={() => { onGroupByChange(opt.key); setExpandGroup(false); }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {opt.label}
              {groupBy === opt.key && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3 3 6-6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: "var(--border)" }} />

      {/* Sort by */}
      <button
        type="button"
        style={{ ...rowBase, background: expandSort ? "var(--bg-hover)" : "transparent" }}
        onClick={() => { setExpandSort(e => !e); setExpandGroup(false); }}
        onMouseEnter={e => { if (!expandSort) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={e => { if (!expandSort) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <SortByIcon />
          <span style={{ fontWeight: 500 }}>Sort by</span>
        </span>
        <span style={{ fontSize: 13, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 3 }}>
          {sortLabel}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expandSort ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>
            <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </span>
      </button>

      {expandSort && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              style={{
                ...rowBase,
                paddingLeft: 40,
                color: sortBy === opt.key ? "var(--accent)" : "var(--fg)",
                fontWeight: sortBy === opt.key ? 500 : 400,
              }}
              onClick={() => { onSortByChange(opt.key); setExpandSort(false); }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {opt.label}
              {sortBy === opt.key && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3 3 6-6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: "var(--border)" }} />

      {/* Restore */}
      <button
        type="button"
        disabled={isDefault}
        style={{
          ...rowBase,
          justifyContent: "center",
          fontSize: 13,
          color: isDefault ? "var(--fg-faint)" : "var(--fg-muted)",
          cursor: isDefault ? "default" : "pointer",
        }}
        onClick={() => { if (!isDefault) { onSortByChange("date"); onGroupByChange("list"); onClose(); } }}
        onMouseEnter={e => { if (!isDefault) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        Restore default date order
      </button>
    </div>
  );
}
