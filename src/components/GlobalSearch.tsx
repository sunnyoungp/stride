"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useUIStore }          from "@/store/uiStore";
import { useTaskStore }        from "@/store/taskStore";
import { useSectionStore }     from "@/store/sectionStore";
import { useDocumentStore }    from "@/store/documentStore";
import { useDailyNoteStore }   from "@/store/dailyNoteStore";
import type { DailyNote, StrideDocument, Task, TaskSection } from "@/types/index";

// ── TipTap JSON → plain text ───────────────────────────────────────────────

function extractText(node: Record<string, unknown>): string {
  if (node.type === "text") return (node.text as string) ?? "";
  const content = node.content as Record<string, unknown>[] | undefined;
  if (!content) return "";
  return content.map((child) => extractText(child)).join(" ");
}

function jsonToPlainText(jsonStr: string): string {
  try {
    return extractText(JSON.parse(jsonStr) as Record<string, unknown>);
  } catch {
    return "";
  }
}

// ── Text highlight ─────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{
        background: "var(--accent-bg)",
        color: "var(--accent)",
        borderRadius: "2px",
        padding: "0 2px",
      }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getSnippet(text: string, query: string, maxLen = 80): string {
  const idx = query ? text.toLowerCase().indexOf(query.toLowerCase()) : 0;
  if (idx === -1) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 20);
  const end   = Math.min(text.length, start + maxLen);
  const snippet = text.slice(start, end).trim();
  return start > 0 ? `…${snippet}` : snippet;
}

function formatDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
  }).format(new Date(y!, (m ?? 1) - 1, d ?? 1));
}

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

// ── Result types ───────────────────────────────────────────────────────────

type SearchResult =
  | { kind: "task";     task: Task }
  | { kind: "note";     note: DailyNote;       snippet: string }
  | { kind: "document"; doc: StrideDocument;   snippet: string }
  | { kind: "section";  section: TaskSection };

type Group = {
  label: string;
  items: { result: SearchResult; globalIdx: number }[];
};

// ── Icons ──────────────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" style={{ color: "var(--fg-muted)" }}>
      <rect x="1" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="4.5" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
      <rect x="9.1" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
      <line x1="1" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" style={{ color: "var(--fg-muted)" }}>
      <path d="M3 1.5h6l3 3V13a.5.5 0 01-.5.5h-8.5a.5.5 0 01-.5-.5V2a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9 1.5V4.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="5" y1="7"   x2="10" y2="7"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
      <line x1="5" y1="9.5" x2="9"  y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
    </svg>
  );
}

function SectionIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--fg-muted)" }}>
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

// ── ResultRow ──────────────────────────────────────────────────────────────

function ResultRow({
  result, query, isActive, globalIdx, sectionMap, onClick, onHover,
}: {
  result:     SearchResult;
  query:      string;
  isActive:   boolean;
  globalIdx:  number;
  sectionMap: Record<string, TaskSection>;
  onClick:    () => void;
  onHover:    () => void;
}) {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 20px",
    cursor: "pointer",
    background: isActive ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
    borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
    transition: "background 0.08s ease",
    userSelect: "none",
  };

  const iconBox: React.CSSProperties = {
    width: 28, height: 28,
    borderRadius: 8,
    background: "var(--bg-hover)",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  };

  if (result.kind === "task") {
    const { task } = result;
    const section  = task.sectionId ? sectionMap[task.sectionId] : undefined;
    const done     = task.status === "done";
    return (
      <div style={base} data-idx={globalIdx} onClick={onClick} onMouseEnter={onHover}>
        {/* Circular checkbox */}
        <div style={{
          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
          border: `1.5px solid ${done ? "var(--accent)" : "var(--border-mid)"}`,
          background: done ? "var(--accent)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {done && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <polyline points="1,4 3,6 7,2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        {/* Title */}
        <span style={{ flex: 1, fontSize: 14, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {highlightMatch(task.title, query)}
          {task.sourceDocumentId && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.5 }}>📄</span>}
        </span>

        {/* Chips */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {section && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-hover)", color: "var(--fg-muted)" }}>
              {section.icon ? `${section.icon} ` : ""}{section.title}
            </span>
          )}
          {task.dueDate && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-hover)", color: "var(--fg-muted)" }}>
              {task.dueDate}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (result.kind === "note") {
    const { note, snippet } = result;
    return (
      <div style={base} data-idx={globalIdx} onClick={onClick} onMouseEnter={onHover}>
        <div style={iconBox}><CalendarIcon /></div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{formatDateLabel(note.date)}</div>
          {snippet && (
            <div style={{ fontSize: 12, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {highlightMatch(snippet, query)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (result.kind === "document") {
    const { doc } = result;
    return (
      <div style={base} data-idx={globalIdx} onClick={onClick} onMouseEnter={onHover}>
        <div style={iconBox}><DocIcon /></div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>
            {highlightMatch(doc.title, query)}
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--fg-faint)", flexShrink: 0 }}>
          {formatUpdatedAt(doc.updatedAt)}
        </span>
      </div>
    );
  }

  if (result.kind === "section") {
    const { section } = result;
    return (
      <div style={base} data-idx={globalIdx} onClick={onClick} onMouseEnter={onHover}>
        <div style={{ ...iconBox, fontSize: 13 }}>
          {section.icon ? section.icon : <SectionIcon />}
        </div>
        <span style={{ flex: 1, fontSize: 14, color: "var(--fg)" }}>
          {highlightMatch(section.title, query)}
        </span>
        <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>Section</span>
      </div>
    );
  }

  return null;
}

// ── GlobalSearch ───────────────────────────────────────────────────────────

export function GlobalSearch() {
  const isOpen      = useUIStore((s) => s.isSearchOpen);
  const closeSearch = useUIStore((s) => s.closeSearch);
  const router      = useRouter();

  const tasks      = useTaskStore((s) => s.tasks);
  const sections   = useSectionStore((s) => s.sections);
  const documents  = useDocumentStore((s) => s.documents);
  const dailyNotes = useDailyNoteStore((s) => s.dailyNotes);

  const loadDailyNotes = useDailyNoteStore((s) => s.loadDailyNotes);
  const loadDocuments  = useDocumentStore((s) => s.loadDocuments);

  const [query,     setQuery]  = useState("");
  const [activeIdx, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // On open: reset, focus, refresh data
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActive(0);
    void loadDailyNotes();
    void loadDocuments();
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen, loadDailyNotes, loadDocuments]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, closeSearch]);

  const q = query.toLowerCase().trim();

  const sectionMap = useMemo(
    () => Object.fromEntries(sections.map((s) => [s.id, s])),
    [sections],
  );

  // Search results (query mode)
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!q) return [];
    const out: SearchResult[] = [];

    tasks
      .filter((t) => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((task) => out.push({ kind: "task", task }));

    dailyNotes
      .filter((n) => jsonToPlainText(n.content).toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((note) => {
        const text = jsonToPlainText(note.content);
        out.push({ kind: "note", note, snippet: getSnippet(text, q) });
      });

    documents
      .filter((d) => d.title.toLowerCase().includes(q) || jsonToPlainText(d.content).toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((doc) => out.push({ kind: "document", doc, snippet: "" }));

    sections
      .filter((s) => s.title.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((section) => out.push({ kind: "section", section }));

    return out;
  }, [q, tasks, dailyNotes, documents, sections]);

  // Recent results (empty state)
  const recentResults = useMemo<SearchResult[]>(() => {
    const recentTasks = [...tasks]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 3)
      .map((task): SearchResult => ({ kind: "task", task }));

    const recentNotes = [...dailyNotes]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 2)
      .map((note): SearchResult => ({
        kind: "note", note,
        snippet: getSnippet(jsonToPlainText(note.content), ""),
      }));

    const recentDocs = [...documents]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 2)
      .map((doc): SearchResult => ({ kind: "document", doc, snippet: "" }));

    return [...recentTasks, ...recentNotes, ...recentDocs];
  }, [tasks, dailyNotes, documents]);

  const displayResults = q ? searchResults : recentResults;
  const clampedIdx     = Math.min(activeIdx, Math.max(0, displayResults.length - 1));

  // Build groups for section headers
  const groups = useMemo<Group[]>(() => {
    if (q) {
      const byKind = (kind: SearchResult["kind"]) =>
        displayResults
          .map((r, i) => ({ result: r, globalIdx: i }))
          .filter(({ result }) => result.kind === kind);
      return [
        { label: "Tasks",       items: byKind("task") },
        { label: "Daily Notes", items: byKind("note") },
        { label: "Documents",   items: byKind("document") },
        { label: "Sections",    items: byKind("section") },
      ].filter((g) => g.items.length > 0);
    }
    const items = displayResults.map((r, i) => ({ result: r, globalIdx: i }));
    return items.length ? [{ label: "Recent", items }] : [];
  }, [q, displayResults]);

  const activate = useCallback((result: SearchResult) => {
    closeSearch();
    switch (result.kind) {
      case "task":
        router.push("/tasks");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("stride:open-task", { detail: { taskId: result.task.id } }));
        }, 80);
        break;
      case "note":
        router.push(`/notes?date=${result.note.date}`);
        break;
      case "document":
        router.push(`/documents?id=${result.doc.id}`);
        break;
      case "section":
        router.push(`/tasks?sectionId=${result.section.id}`);
        break;
    }
  }, [closeSearch, router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, displayResults.length - 1));
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const r = displayResults[clampedIdx];
      if (r) { e.preventDefault(); activate(r); }
    }
  };

  // Scroll active row into view
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${clampedIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [clampedIdx]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "14vh",
        background: "rgba(0,0,0,0.30)",
        backdropFilter: "blur(2px)",
        animation: "gs-fade 0.1s ease",
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeSearch(); }}
    >
      <div
        style={{
          width: 600,
          maxHeight: "70vh",
          background: "var(--bg-card)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.22), 0 0 0 1px var(--border-mid)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "gs-scale 0.1s ease",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Input bar ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--fg-muted)" }}>
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, notes, documents..."
            style={{
              flex: 1, fontSize: 16, border: "none", outline: "none",
              background: "transparent", color: "var(--fg)",
            }}
          />
          <kbd style={{
            fontSize: 11, padding: "2px 6px", borderRadius: 6, flexShrink: 0,
            background: "var(--bg-hover)", border: "1px solid var(--border-mid)",
            color: "var(--fg-faint)",
          }}>
            Esc
          </kbd>
        </div>

        {/* ── Results ── */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", paddingBottom: 6 }}>
          {q && searchResults.length === 0 ? (
            <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: 14 }}>
              😶 No results for &ldquo;{query}&rdquo;
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
              Start typing to search…
            </div>
          ) : (
            groups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />}
                <div style={{
                  padding: "10px 20px 4px",
                  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: "var(--fg-faint)",
                }}>
                  {group.label}
                </div>
                {group.items.map(({ result, globalIdx }) => (
                  <ResultRow
                    key={globalIdx}
                    result={result}
                    query={query}
                    isActive={clampedIdx === globalIdx}
                    globalIdx={globalIdx}
                    sectionMap={sectionMap}
                    onClick={() => activate(result)}
                    onHover={() => setActive(globalIdx)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
