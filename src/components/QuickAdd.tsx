"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTaskStore } from "@/store/taskStore";
import { useSectionStore } from "@/store/sectionStore";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import type { Task } from "@/types/index";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useVisualViewport } from "@/hooks/useVisualViewport";

function localDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr()    { return localDateString(new Date()); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return localDateString(d); }

function parse(input: string): Pick<Task, "title" | "tags" | "dueDate"> {
  const tags: string[] = [];
  for (const m of input.matchAll(/#([a-zA-Z0-9_-]+)/g)) {
    const t = m[1]?.trim();
    if (t && !tags.includes(t)) tags.push(t);
  }

  const lower = input.toLowerCase();
  const dueDate = /@?tomorrow\b/i.test(lower) ? tomorrowStr()
    : /@?today\b/i.test(lower) ? todayStr()
    : undefined;

  const title = input
    .replace(/#[a-zA-Z0-9_-]+/g, "")
    .replace(/@?tomorrow\b/gi, "")
    .replace(/@?today\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { title, tags, dueDate };
}

// ─── Event time helpers ───────────────────────────────────────────────────────

function combineDatetime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

function calcEventDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
}

function fmtDur(mins: number): string {
  if (mins <= 0) return "";
  if (mins >= 60) return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}m` : ""}`;
  return `${mins}min`;
}

// ─── QuickAdd component ───────────────────────────────────────────────────────

export function QuickAdd() {
  const createTask        = useTaskStore((s) => s.createTask);
  const createTimeBlock   = useTimeBlockStore((s) => s.createTimeBlock);
  const sections          = useSectionStore((s) => s.sections);
  const isMobile          = useIsMobile();
  const { height: vpHeight } = useVisualViewport();
  const [windowHeight, setWindowHeight] = useState(0);
  useEffect(() => {
    setWindowHeight(window.innerHeight);
    const update = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const keyboardHeight = Math.max(0, windowHeight - vpHeight);

  const [open, setOpen]               = useState(false);
  const [mode, setMode]               = useState<"task" | "event">("task");
  const [value, setValue]             = useState("");
  const [sectionId, setSectionId]     = useState("");
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  // Event-mode fields
  const [eventTitle, setEventTitle]       = useState("");
  const [eventDate, setEventDate]         = useState(() => todayStr());
  const [eventStart, setEventStart]       = useState("09:00");
  const [eventEnd, setEventEnd]           = useState("10:00");
  const [eventAllDay, setEventAllDay]     = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const preview      = useMemo(() => (value.trim() ? parse(value) : null), [value]);
  const effectiveDate = selectedDate ?? preview?.dueDate;

  const close = () => {
    setOpen(false);
    setValue("");
    setSectionId("");
    setSelectedDate(undefined);
    setMode("task");
    setEventTitle("");
    setEventDate(todayStr());
    setEventStart("09:00");
    setEventEnd("10:00");
    setEventAllDay(false);
  };

  const submit = () => {
    if (mode === "event") {
      const title = eventTitle.trim() || "New Event";
      let startTime: string, endTime: string;
      if (eventAllDay) {
        startTime = new Date(`${eventDate}T00:00:00`).toISOString();
        endTime   = new Date(`${eventDate}T23:59:59`).toISOString();
      } else {
        startTime = combineDatetime(eventDate, eventStart);
        endTime   = combineDatetime(eventDate, eventEnd);
      }
      void createTimeBlock({ type: "event", title, startTime, endTime, allDay: eventAllDay }).then(close);
      return;
    }
    const p = parse(value);
    if (!p.title) return;
    void createTask({
      ...p,
      dueDate: effectiveDate,
      sectionId: sectionId || undefined,
    }).then(close);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "n")) {
        e.preventDefault(); setOpen((v) => !v); return;
      }
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Enter")  { e.preventDefault(); submit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, sectionId, effectiveDate, mode, eventTitle, eventDate, eventStart, eventEnd, eventAllDay]);

  // Also respond to the custom event fired by GlobalShortcuts
  useEffect(() => {
    const onOpen = () => setOpen((v) => !v);
    window.addEventListener("stride:open-quickadd", onOpen);
    return () => window.removeEventListener("stride:open-quickadd", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => { inputRef.current?.focus(); }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const today    = todayStr();
  const tomorrow = tomorrowStr();

  // ── Mode toggle (shared) ──────────────────────────────────────────────────
  const modeToggle = (
    <div style={{ display: "flex", gap: 4, padding: "10px 20px 0" }}>
      {(["task", "event"] as const).map(m => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          style={mode === m
            ? { background: "var(--accent-bg-strong)", color: "var(--accent)", borderRadius: 8, padding: "4px 14px", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", transition: "all 150ms ease" }
            : { background: "var(--bg-hover)", color: "var(--fg-muted)", borderRadius: 8, padding: "4px 14px", fontSize: 12.5, fontWeight: 500, border: "none", cursor: "pointer", transition: "all 150ms ease" }
          }
        >
          {m === "task" ? "Task" : "Event"}
        </button>
      ))}
    </div>
  );

  // ── Event mode fields (shared between mobile + desktop) ──────────────────
  const durMins = calcEventDuration(eventStart, eventEnd);
  const eventFields = (
    <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Title */}
      <input
        ref={inputRef}
        value={eventTitle}
        onChange={e => setEventTitle(e.target.value)}
        placeholder="Event title"
        style={{
          width: "100%", boxSizing: "border-box",
          background: "var(--bg-subtle)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "9px 12px",
          fontSize: "16px", fontWeight: 600, color: "var(--fg)", outline: "none",
        }}
      />

      {/* Time row */}
      {!eventAllDay && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="time" value={eventStart} onChange={e => setEventStart(e.target.value)}
            style={{ flex: 1, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 10px", fontSize: 14, color: "var(--fg)", outline: "none" }}
          />
          <span style={{ color: "var(--fg-faint)", fontSize: 13 }}>→</span>
          <input type="time" value={eventEnd} onChange={e => setEventEnd(e.target.value)}
            style={{ flex: 1, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 10px", fontSize: 14, color: "var(--fg)", outline: "none" }}
          />
          {durMins > 0 && (
            <span style={{ fontSize: 12, color: "var(--fg-faint)", flexShrink: 0, minWidth: 36 }}>{fmtDur(durMins)}</span>
          )}
        </div>
      )}

      {/* Date */}
      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 10px", fontSize: 14, color: "var(--fg)", outline: "none" }}
      />

      {/* All-day toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--fg)" }}>All day</span>
        <button type="button" onClick={() => setEventAllDay(v => !v)}
          style={{
            width: 40, height: 22, borderRadius: 9999, border: "none", cursor: "pointer",
            background: eventAllDay ? "var(--accent)" : "var(--border-strong)", position: "relative", transition: "background 150ms ease",
          }}
        >
          <span style={{
            position: "absolute", top: 2, left: eventAllDay ? 20 : 2,
            width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 150ms ease",
          }} />
        </button>
      </div>

      {/* Submit */}
      <button type="button" onClick={submit}
        className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
        style={{ background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
      >
        Create Event
      </button>
    </div>
  );

  /* ── Mobile: bottom sheet above keyboard ── */
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div className="absolute inset-0 backdrop-fade" style={{ background: "rgba(0,0,0,0.22)" }} onClick={close} />

        {/* Sheet */}
        <div
          className="cmd-palette absolute left-0 right-0 overflow-auto"
          style={{
            bottom: keyboardHeight,
            maxHeight: "80vh",
            background: "var(--bg-card)",
            borderTop: "1px solid var(--border-mid)",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: "var(--shadow-float)",
            transition: "bottom 200ms ease",
          }}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "var(--border-strong)" }} />
          </div>

          {/* Mode toggle */}
          {modeToggle}

          {mode === "event" ? eventFields : (
            <>
              {/* Input row */}
              <div className="flex items-center gap-4 px-5 py-[14px]">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-none" style={{ color: "var(--fg-faint)" }}>
                  <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="New task…"
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: "16px", fontWeight: 450, color: "var(--fg)", caretColor: "var(--accent)" }}
                />
                {value.trim() && (
                  <button type="button" onClick={submit}
                    className="flex-none flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
                    style={{ background: "var(--accent)", color: "white" }}>
                    Add <kbd className="text-[10px] opacity-70">↵</kbd>
                  </button>
                )}
              </div>
              {/* Options */}
              <div className="space-y-3 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <span className="w-[52px] flex-none text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--fg-faint)" }}>Date</span>
                  <div className="flex items-center gap-1.5">
                    {[{ label: "Today", val: today }, { label: "Tomorrow", val: tomorrow }].map(({ label, val }) => {
                      const active = effectiveDate === val;
                      return (
                        <button key={label} type="button" onClick={() => setSelectedDate((v) => (v === val ? undefined : val))}
                          className="rounded-lg px-3 py-1 text-[12.5px] font-medium transition-all duration-150 ease-out"
                          style={active ? { background: "var(--accent-bg-strong)", color: "var(--accent)" } : { background: "var(--bg-hover)", color: "var(--fg-muted)" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {sections.length > 0 && (
                  <div className="flex items-start gap-3">
                    <span className="mt-[3px] w-[52px] flex-none text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--fg-faint)" }}>Section</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sections.map((s) => {
                        const active = sectionId === s.id;
                        return (
                          <button key={s.id} type="button" onClick={() => setSectionId((v) => (v === s.id ? "" : s.id))}
                            className="flex items-center gap-1 rounded-lg px-3 py-1 text-[12.5px] font-medium"
                            style={active ? { background: "var(--bg-active)", color: "var(--accent)" } : { background: "var(--bg-hover)", color: "var(--fg-muted)" }}>
                            {s.icon && <span>{s.icon}</span>}<span>{s.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-fade"
        style={{ background: "rgba(0,0,0,0.22)" }}
        onClick={close}
      />

      {/* Panel */}
      <div
        className="cmd-palette relative mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-mid)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {/* ── Mode toggle ── */}
        {modeToggle}

        {mode === "event" ? eventFields : (
          <>
            {/* ── Input row ── */}
            <div className="flex items-center gap-4 px-5 py-[18px]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-none" style={{ color: "var(--fg-faint)" }}>
                <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="New task…"
                className="flex-1 bg-transparent outline-none"
                style={{ fontSize: "16px", fontWeight: 450, color: "var(--fg)", caretColor: "var(--accent)" }}
              />
              {value.trim() && (
                <button type="button" onClick={submit}
                  className="flex-none flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ease-out"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  Add <kbd className="text-[10px] opacity-70">↵</kbd>
                </button>
              )}
            </div>

            {/* ── Options ── */}
            <div className="space-y-3 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
              {/* Date */}
              <div className="flex items-center gap-3">
                <span className="w-[52px] flex-none text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--fg-faint)" }}>Date</span>
                <div className="flex items-center gap-1.5">
                  {[{ label: "Today", val: today }, { label: "Tomorrow", val: tomorrow }].map(({ label, val }) => {
                    const active = effectiveDate === val;
                    return (
                      <button key={label} type="button" onClick={() => setSelectedDate((v) => (v === val ? undefined : val))}
                        className="rounded-lg px-3 py-1 text-[12.5px] font-medium transition-all duration-150 ease-out"
                        style={active ? { background: "var(--accent-bg-strong)", color: "var(--accent)" } : { background: "var(--bg-hover)", color: "var(--fg-muted)" }}
                      >{label}</button>
                    );
                  })}
                </div>
              </div>

              {/* Section */}
              {sections.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="mt-[3px] w-[52px] flex-none text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--fg-faint)" }}>Section</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sections.map((s) => {
                      const active = sectionId === s.id;
                      return (
                        <button key={s.id} type="button" onClick={() => setSectionId((v) => (v === s.id ? "" : s.id))}
                          className="flex items-center gap-1 rounded-lg px-3 py-1 text-[12.5px] font-medium transition-all duration-150 ease-out"
                          style={active ? { background: "var(--bg-active)", color: "var(--accent)" } : { background: "var(--bg-hover)", color: "var(--fg-muted)" }}
                        >
                          {s.icon && <span>{s.icon}</span>}
                          <span>{s.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live tag preview */}
              {(preview?.tags?.length ?? 0) > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-[52px] flex-none text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--fg-faint)" }}>Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {preview!.tags!.map((t) => (
                      <span key={t} className="rounded-md px-2.5 py-1 text-[12px]"
                        style={{ background: "var(--bg-hover)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
