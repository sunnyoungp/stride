"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import { useTaskStore } from "@/store/taskStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Task, TimeBlock } from "@/types/index";

// ── Types ──────────────────────────────────────────────────────────────────

export type EventPanelCreateProps = {
  mode: "create";
  startTime: string; // ISO
  endTime: string;   // ISO
  clickPos: { x: number; y: number };
  onCreate: (data: {
    title: string; color: string; allDay: boolean;
    startTime: string; endTime: string;
  }) => void;
  onClose: () => void;
};

export type EventPanelEditProps = {
  mode: "edit";
  timeBlock: TimeBlock;
  clickPos: { x: number; y: number };
  onClose: () => void;
};

export type EventPanelProps = EventPanelCreateProps | EventPanelEditProps;

// ── Constants ──────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#f4714a", "#6c7ce7", "#4ecdc4", "#45b7d1",
  "#96ceb4", "#e8a0bf", "#f59e0b", "#ef4444",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function toTimeStr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function combineDateTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}`).toISOString();
}

function calcDurMins(st: string, et: string): number {
  const [sh, sm] = st.split(":").map(Number);
  const [eh, em] = et.split(":").map(Number);
  return ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
}

function fmtDur(mins: number): string {
  if (mins <= 0) return "";
  return mins >= 60
    ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`
    : `${mins}min`;
}

function fmtDateLabel(dateStr: string): string {
  const [y, mo, da] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(y ?? 2024, (mo ?? 1) - 1, da ?? 1)
  );
}

type AnchorSide = "right" | "left";
type AnchorVert = "down" | "up";

function smartPos(cx: number, cy: number, panelW = 360, panelH = 480): {
  style: React.CSSProperties;
  origin: string;
} {
  const vw = window.innerWidth, vh = window.innerHeight, p = 10;
  const side: AnchorSide = cx + panelW + p * 2 > vw ? "left" : "right";
  const vert: AnchorVert = cy + panelH + p > vh ? "up" : "down";

  const style: React.CSSProperties = {};
  if (side === "right") style.left = Math.min(cx + p, vw - panelW - p);
  else                  style.left = Math.max(p, cx - panelW - p);

  if (vert === "down") style.top  = Math.max(p, Math.min(cy, vh - panelH - p));
  else                 style.bottom = Math.max(p, vh - cy);

  const hOrigin = side === "right" ? "left" : "right";
  const vOrigin = vert === "down"  ? "top"  : "bottom";
  return { style, origin: `${vOrigin} ${hOrigin}` };
}

// ── Tiny SVG icons ─────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 5v3.5l2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.5a4 4 0 0 1 4 4c0 2.5-4 9-4 9s-4-6.5-4-9a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}
function TextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function PaletteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="5.5" cy="7" r="1" fill="currentColor"/>
      <circle cx="8" cy="5.5" r="1" fill="currentColor"/>
      <circle cx="10.5" cy="7" r="1" fill="currentColor"/>
    </svg>
  );
}

// ── Form state ─────────────────────────────────────────────────────────────

type FormState = {
  title: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  date: string;      // YYYY-MM-DD
  allDay: boolean;
  repeat: "none" | "daily" | "weekly" | "monthly";
  location: string;
  description: string;
  color: string;
};

function initForm(props: EventPanelProps): FormState {
  if (props.mode === "create") {
    return {
      title: "",
      startTime: toTimeStr(props.startTime),
      endTime: toTimeStr(props.endTime),
      date: toDateStr(props.startTime),
      allDay: false,
      repeat: "none",
      location: "",
      description: "",
      color: "#f4714a",
    };
  }
  const tb = props.timeBlock;
  return {
    title: tb.title,
    startTime: toTimeStr(tb.startTime),
    endTime: toTimeStr(tb.endTime),
    date: toDateStr(tb.startTime),
    allDay: tb.allDay ?? false,
    repeat: "none",
    location: "",
    description: "",
    color: tb.color ?? "#f4714a",
  };
}

// ── EventPanel ─────────────────────────────────────────────────────────────

export function EventPanel(props: EventPanelProps) {
  const { onClose } = props;
  const updateTimeBlock = useTimeBlockStore((s) => s.updateTimeBlock);
  const deleteTimeBlock = useTimeBlockStore((s) => s.deleteTimeBlock);
  const tasks = useTaskStore((s) => s.tasks);
  const isMobile = useIsMobile();

  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => initForm(props));
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Animate in
  useEffect(() => {
    setMounted(true);
    const id = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => titleRef.current?.focus(), 80);
    return () => { cancelAnimationFrame(id); clearTimeout(timer); };
  }, []);

  // Outside click dismiss
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    // Delay to avoid immediately closing from the calendar click that opened this
    const timer = setTimeout(() => window.addEventListener("pointerdown", h), 100);
    return () => { clearTimeout(timer); window.removeEventListener("pointerdown", h); };
  }, [onClose]);

  // Escape dismiss
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const linkedTask: Task | undefined = useMemo(() =>
    props.mode === "edit" && props.timeBlock.taskId
      ? tasks.find((t) => t.id === props.timeBlock.taskId)
      : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.mode === "edit" && (props as EventPanelEditProps).timeBlock?.taskId, tasks]
  );

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const saveToBlock = (patch: Partial<TimeBlock>) => {
    if (props.mode === "edit") void updateTimeBlock(props.timeBlock.id, patch);
  };

  const dur = form.allDay ? 0 : calcDurMins(form.startTime, form.endTime);

  const handleCreate = () => {
    if (props.mode !== "create") return;
    props.onCreate({
      title: form.title.trim() || "New Event",
      color: form.color,
      allDay: form.allDay,
      startTime: combineDateTime(form.date, form.startTime),
      endTime: combineDateTime(form.date, form.endTime),
    });
    onClose();
  };

  const handleDelete = () => {
    if (props.mode !== "edit") return;
    void deleteTimeBlock(props.timeBlock.id);
    onClose();
  };

  // Shared content for both modal and inline panel
  const body = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Title */}
      <div style={{ padding: "10px 16px 8px" }}>
        <input
          ref={titleRef}
          value={form.title}
          placeholder="Title"
          onChange={e => {
            set("title", e.target.value);
            saveToBlock({ title: e.target.value });
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && props.mode === "create") handleCreate();
            if (e.key === "Escape") onClose();
          }}
          style={{
            width: "100%", background: "transparent", border: "none", outline: "none",
            fontSize: isMobile ? 18 : 17, fontWeight: 600,
            color: "var(--fg)", fontFamily: "inherit", padding: 0,
          }}
        />
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "0 12px" }} />

      {/* Time + Date section */}
      <div style={{ padding: "10px 16px 8px" }}>
        {/* Time row */}
        {!form.allDay && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ color: "var(--fg-muted)", flexShrink: 0, display: "flex", alignItems: "center" }}>
              <ClockIcon />
            </span>
            <input
              type="time"
              value={form.startTime}
              onChange={e => {
                set("startTime", e.target.value);
                saveToBlock({ startTime: combineDateTime(form.date, e.target.value) });
              }}
              style={{
                background: "none", border: "none", outline: "none",
                fontSize: 14, color: "var(--fg)", fontFamily: "inherit", cursor: "pointer",
              }}
            />
            <span style={{ color: "var(--fg-muted)", fontSize: 13 }}>→</span>
            <input
              type="time"
              value={form.endTime}
              onChange={e => {
                set("endTime", e.target.value);
                saveToBlock({ endTime: combineDateTime(form.date, e.target.value) });
              }}
              style={{
                background: "none", border: "none", outline: "none",
                fontSize: 14, color: "var(--fg)", fontFamily: "inherit", cursor: "pointer",
              }}
            />
            {dur > 0 && (
              <span style={{ fontSize: 12, color: "var(--fg-muted)", flexShrink: 0, marginLeft: 2 }}>
                {fmtDur(dur)}
              </span>
            )}
          </div>
        )}

        {/* Date row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: form.allDay ? 0 : 22 }}>
          {form.allDay && (
            <span style={{ color: "var(--fg-muted)", flexShrink: 0, display: "flex", alignItems: "center" }}>
              <ClockIcon />
            </span>
          )}
          <input
            type="date"
            value={form.date}
            onChange={e => {
              set("date", e.target.value);
              if (e.target.value) {
                saveToBlock({
                  startTime: combineDateTime(e.target.value, form.startTime),
                  endTime: combineDateTime(e.target.value, form.endTime),
                });
              }
            }}
            style={{
              background: "none", border: "none", outline: "none",
              fontSize: 14, color: "var(--fg)", fontFamily: "inherit", cursor: "pointer",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{fmtDateLabel(form.date)}</span>
        </div>

        {/* All-day · Repeat */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 22, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {
              const next = !form.allDay;
              set("allDay", next);
              saveToBlock({ allDay: next });
            }}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 12, fontWeight: 500,
              color: form.allDay ? "var(--accent)" : "var(--fg-faint)",
            }}
          >All-day</button>
          <span style={{ color: "var(--border-strong)", fontSize: 12 }}>·</span>
          <select
            value={form.repeat}
            onChange={e => set("repeat", e.target.value as FormState["repeat"])}
            style={{
              background: "none", border: "none", outline: "none",
              fontSize: 12, fontFamily: "inherit", cursor: "pointer",
              color: form.repeat !== "none" ? "var(--accent)" : "var(--fg-faint)",
            }}
          >
            <option value="none">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "0 12px" }} />

      {/* Location */}
      <div style={{ padding: "8px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--fg-muted)", flexShrink: 0, display: "flex", alignItems: "center" }}>
            <PinIcon />
          </span>
          <input
            value={form.location}
            placeholder="Location"
            onChange={e => set("location", e.target.value)}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 13, color: "var(--fg)", fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: "0 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ color: "var(--fg-muted)", flexShrink: 0, display: "flex", alignItems: "center", paddingTop: 3 }}>
            <TextIcon />
          </span>
          <textarea
            value={form.description}
            placeholder="Description"
            onChange={e => set("description", e.target.value)}
            rows={2}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 13, color: "var(--fg)", fontFamily: "inherit",
              resize: "none", lineHeight: 1.5,
            }}
          />
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "0 12px" }} />

      {/* Color picker */}
      <div style={{ padding: "8px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--fg-muted)", flexShrink: 0, display: "flex", alignItems: "center" }}>
            <PaletteIcon />
          </span>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  set("color", c);
                  saveToBlock({ color: c });
                }}
                style={{
                  width: 18, height: 18, borderRadius: "50%", background: c,
                  border: `2.5px solid ${form.color === c ? "var(--fg)" : "transparent"}`,
                  outline: form.color === c ? "2px solid var(--bg-card)" : "none",
                  outlineOffset: "-2px",
                  cursor: "pointer", padding: 0, flexShrink: 0,
                  transition: "border 100ms ease",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {linkedTask && (
        <>
          <div style={{ borderTop: "1px solid var(--border)", margin: "0 12px" }} />
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--fg-muted)" }}>
            Linked task: <span style={{ color: "var(--fg)" }}>{linkedTask.title}</span>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", margin: "0 12px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 14px" }}>
        {props.mode === "edit" ? (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:bg-[var(--error-bg)]"
            style={{ color: "var(--error)" }}
          >Delete</button>
        ) : (
          <div />
        )}
        {props.mode === "create" ? (
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
            style={{ background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
          >Create</button>
        ) : (
          <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>Auto-saved</span>
        )}
      </div>
    </div>
  );

  if (!mounted) return null;

  // ── Mobile: bottom sheet ───────────────────────────────────────────────────
  if (isMobile) {
    return createPortal(
      <>
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 100, opacity: visible ? 1 : 0, transition: "opacity 280ms ease" }}
          onClick={onClose}
        />
        <div
          ref={panelRef}
          style={{
            position: "fixed", left: 0, right: 0, bottom: 0,
            paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
            background: "var(--bg-card)",
            borderTop: "1px solid var(--border-mid)",
            borderRadius: "16px 16px 0 0",
            boxShadow: "var(--shadow-float)",
            zIndex: 101,
            maxHeight: "90vh",
            overflowY: "auto",
            transform: visible ? "translateY(0)" : "translateY(100%)",
            transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "var(--border-strong)" }} />
          </div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 16px 0" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>
              {props.mode === "create" ? "New Event" : "Edit Event"}
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", fontSize: 18, lineHeight: 1 }}
            >✕</button>
          </div>
          {body}
        </div>
      </>,
      document.body
    );
  }

  // ── Desktop: smart-positioned inline panel ─────────────────────────────────
  const { style: posStyle, origin } = smartPos(props.clickPos.x, props.clickPos.y);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      style={{
        position: "fixed",
        ...posStyle,
        width: 360,
        maxHeight: "90vh",
        overflowY: "auto",
        zIndex: 9999,
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        borderRadius: 12,
        boxShadow: "var(--shadow-float)",
        transformOrigin: origin,
        transform: visible ? "scale(1)" : "scale(0.94)",
        opacity: visible ? 1 : 0,
        transition: "transform 160ms cubic-bezier(0.16, 1, 0.3, 1), opacity 120ms ease",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px 0",
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          color: "var(--fg-faint)",
        }}>
          {props.mode === "create" ? "New Event" : "Event"}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--fg-faint)", fontSize: 16, lineHeight: 1,
            padding: "2px 4px", borderRadius: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >✕</button>
      </div>
      {body}
    </div>,
    document.body
  );
}
