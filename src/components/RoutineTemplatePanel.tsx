"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pin, Pencil, X } from "lucide-react";

import { useRoutineTemplateStore } from "@/store/routineTemplateStore";
import { RoutineChip, formatDuration } from "@/components/RoutineChip";
import type { RoutineTemplate } from "@/types/index";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHIP_COLORS = [
  "#e8603c", "#f97316", "#f59e0b", "#22c55e",
  "#3b82f6", "#6c7ce7", "#7c3aed", "#ec4899",
  "#14b8a6", "#ef4444", "#64748b", "#52525b",
];

const DURATION_PRESETS = [
  { label: "30m",    value: 30  },
  { label: "1h",     value: 60  },
  { label: "1h 30m", value: 90  },
  { label: "2h",     value: 120 },
  { label: "3h",     value: 180 },
];

const DAYS = [
  { label: "Mo", value: 1 }, { label: "Tu", value: 2 }, { label: "We", value: 3 },
  { label: "Th", value: 4 }, { label: "Fr", value: 5 }, { label: "Sa", value: 6 },
  { label: "Su", value: 0 },
] as const;

// ─── Duration selector ────────────────────────────────────────────────────────

function DurationSelector({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const isCustom = !DURATION_PRESETS.find((p) => p.value === value);
  const [custH, setCustH] = useState(() => Math.floor(value / 60));
  const [custM, setCustM] = useState(() => value % 60);

  const applyCustom = (h: number, m: number) => onChange(Math.max(1, h * 60 + m));

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {DURATION_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            style={{
              fontSize: 12, padding: "3px 9px", borderRadius: 6, height: 26,
              border: `1px solid ${value === p.value ? "var(--accent)" : "var(--border)"}`,
              background: value === p.value ? "var(--accent-bg)" : "transparent",
              color: value === p.value ? "var(--accent)" : "var(--fg-muted)",
              cursor: "pointer",
            }}
          >{p.label}</button>
        ))}
        <button
          type="button"
          onClick={() => { setCustH(Math.floor(value / 60)); setCustM(value % 60); if (!isCustom) onChange(value === 30 ? 45 : value); }}
          style={{
            fontSize: 11.5, padding: "3px 9px", borderRadius: 6, height: 26,
            border: `1px solid ${isCustom ? "var(--accent)" : "var(--border)"}`,
            background: isCustom ? "var(--accent-bg)" : "transparent",
            color: isCustom ? "var(--accent)" : "var(--fg-muted)",
            cursor: "pointer",
          }}
        >Custom</button>
      </div>

      {isCustom && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
          <input
            type="number" min={0} max={23} value={custH}
            onChange={(e) => { const h = Math.max(0, Number(e.target.value)); setCustH(h); applyCustom(h, custM); }}
            style={{ width: 48, textAlign: "center", padding: "4px 6px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--fg)", fontSize: 16, outline: "none" }}
          />
          <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>h</span>
          <input
            type="number" min={0} max={59} value={custM}
            onChange={(e) => { const m = Math.max(0, Number(e.target.value)); setCustM(m); applyCustom(custH, m); }}
            style={{ width: 48, textAlign: "center", padding: "4px 6px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--fg)", fontSize: 16, outline: "none" }}
          />
          <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>min</span>
        </div>
      )}

      <div style={{ marginTop: 5, fontSize: 11, color: "var(--fg-faint)" }}>
        Duration: <strong style={{ color: "var(--fg-muted)" }}>{formatDuration(value)}</strong>
      </div>
    </div>
  );
}

// ─── Color swatches ───────────────────────────────────────────────────────────

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const customRef = useRef<HTMLInputElement>(null);
  const isPreset  = CHIP_COLORS.includes(value);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
      {CHIP_COLORS.map((c) => (
        <button
          key={c} type="button" onClick={() => onChange(c)}
          style={{
            width: 20, height: 20, borderRadius: "50%", background: c,
            border: "none", cursor: "pointer", padding: 0,
            outline: value === c ? `2px solid var(--fg)` : "2px solid transparent",
            outlineOffset: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {value === c && (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1.5 4.5l2 2 4-4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      ))}
      <button
        type="button" onClick={() => customRef.current?.click()} title="Custom color"
        style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
          border: "none", cursor: "pointer",
          outline: !isPreset ? `2px solid var(--fg)` : "2px solid transparent",
          outlineOffset: 2,
        }}
      />
      <input
        ref={customRef} type="color" value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

// ─── Shared field style ───────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  background: "var(--bg-subtle)", border: "1px solid var(--border)",
  color: "var(--fg)", borderRadius: 8, padding: "6px 10px",
  fontSize: 16, outline: "none", boxSizing: "border-box",
};

// ─── Inline edit form ─────────────────────────────────────────────────────────

function EditForm({
  template,
  onSave,
  onCancel,
}: {
  template: RoutineTemplate;
  onSave: (changes: Partial<RoutineTemplate>) => void;
  onCancel: () => void;
}) {
  const [title,    setTitle]    = useState(template.title);
  const [icon,     setIcon]     = useState(template.icon ?? "");
  const [durMins,  setDurMins]  = useState(template.durationMinutes ?? 60);
  const [defStart, setDefStart] = useState(template.defaultStartTime ?? "09:00");
  const [color,    setColor]    = useState(template.color);
  const [dow,      setDow]      = useState<number[]>(template.daysOfWeek ?? []);

  return (
    <div style={{ padding: "10px 16px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Emoji + Name */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🎯"
          style={{ ...fieldStyle, width: 44, textAlign: "center", fontSize: 18, flexShrink: 0, padding: "6px 4px" }}
        />
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Routine name"
          style={{ ...fieldStyle, flex: 1 }}
        />
      </div>

      {/* Duration */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 6 }}>Duration</div>
        <DurationSelector value={durMins} onChange={setDurMins} />
      </div>

      {/* Start time */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--fg-faint)", flexShrink: 0 }}>Usually starts at</span>
        <input
          type="time" value={defStart} onChange={(e) => setDefStart(e.target.value)}
          style={{ ...fieldStyle, fontSize: 16, padding: "4px 8px" }}
        />
      </div>

      {/* Color */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 6 }}>Color</div>
        <ColorRow value={color} onChange={setColor} />
      </div>

      {/* Days */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 6 }}>Days (optional)</div>
        <div style={{ display: "flex", gap: 4 }}>
          {DAYS.map((d) => {
            const checked = dow.includes(d.value);
            return (
              <button
                key={d.label} type="button"
                onClick={() => setDow((prev) => { const s = new Set(prev); checked ? s.delete(d.value) : s.add(d.value); return Array.from(s); })}
                style={{
                  flex: 1, padding: "4px 0", borderRadius: 6,
                  border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                  background: checked ? "var(--accent-bg)" : "transparent",
                  color: checked ? "var(--accent)" : "var(--fg-muted)",
                  fontSize: 10, fontWeight: 500, cursor: "pointer",
                }}
              >{d.label}</button>
            );
          })}
        </div>
      </div>

      {/* Save / Cancel */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button" onClick={onCancel}
          style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--fg-muted)", fontSize: 12, cursor: "pointer" }}
        >Cancel</button>
        <button
          type="button"
          onClick={() => onSave({ title: title.trim() || template.title, icon: icon.trim() || undefined, durationMinutes: durMins, defaultStartTime: defStart, color, daysOfWeek: dow })}
          disabled={!title.trim()}
          style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: title.trim() ? 1 : 0.4 }}
        >Save</button>
      </div>
    </div>
  );
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableRow({
  templateId,
  isEditing,
  onEditOpen,
  onEditSave,
  onEditCancel,
  onDelete,
}: {
  templateId: string;
  isEditing: boolean;
  onEditOpen: () => void;
  onEditSave: (changes: Partial<RoutineTemplate>) => void;
  onEditCancel: () => void;
  onDelete: () => void;
}) {
  // Read template directly from store — never from props or closure
  const template = useRoutineTemplateStore((s) => s.templates.find((t) => t.id === templateId));
  const updateTemplate = useRoutineTemplateStore((s) => s.updateTemplate);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: templateId });
  const rowRef    = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);

  if (!template) return null;

  const isPinned = template.pinned === true;

  const onRowEnter = () => {
    if (isEditing) return;
    if (rowRef.current)    rowRef.current.style.background = "rgba(0,0,0,0.02)";
    if (handleRef.current) handleRef.current.style.opacity = "0.25";
  };
  const onRowLeave = () => {
    if (rowRef.current)    rowRef.current.style.background = "transparent";
    if (handleRef.current) handleRef.current.style.opacity = "0";
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <div
        ref={rowRef}
        onMouseEnter={onRowEnter}
        onMouseLeave={onRowLeave}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 16px", height: 52,
          borderBottom: "1px solid var(--border)",
          background: "transparent", transition: "background 100ms",
        }}
      >
        <span
          ref={handleRef}
          {...attributes} {...listeners}
          style={{ fontSize: 13, opacity: 0, cursor: "grab", touchAction: "none", flexShrink: 0, lineHeight: 1, transition: "opacity 120ms", color: "var(--fg)" }}
        >⠿</span>

        <RoutineChip template={template} />

        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => void updateTemplate(templateId, { pinned: !isPinned })}
            title={isPinned ? "Unpin from strip" : "Pin to strip"}
            style={{ background: "none", border: "none", padding: 3, cursor: "pointer", color: isPinned ? "var(--accent)" : "rgba(0,0,0,0.25)", display: "flex", alignItems: "center" }}
          >
            <Pin size={14} fill={isPinned ? "currentColor" : "none"} />
          </button>

          <button
            type="button"
            onClick={isEditing ? onEditCancel : onEditOpen}
            title={isEditing ? "Cancel" : "Edit"}
            style={{ background: "none", border: "none", padding: 3, cursor: "pointer", color: isEditing ? "var(--accent)" : "rgba(0,0,0,0.3)", display: "flex", alignItems: "center" }}
          >
            <Pencil size={14} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            style={{ background: "none", border: "none", padding: 3, cursor: "pointer", color: "rgba(0,0,0,0.3)", fontSize: 18, lineHeight: 1, display: "flex", alignItems: "center" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--error)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(0,0,0,0.3)"; }}
          >×</button>
        </div>
      </div>

      {isEditing && (
        <EditForm template={template} onSave={onEditSave} onCancel={onEditCancel} />
      )}
    </div>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const createTemplate = useRoutineTemplateStore((s) => s.createTemplate);

  const [title,    setTitle]    = useState("");
  const [icon,     setIcon]     = useState("");
  const [durMins,  setDurMins]  = useState(60);
  const [defStart, setDefStart] = useState("09:00");
  const [color,    setColor]    = useState("#3b82f6");
  const [dow,      setDow]      = useState<number[]>([]);

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    await createTemplate({ title: t, icon: icon.trim() || undefined, durationMinutes: durMins, defaultStartTime: defStart, color, daysOfWeek: dow, isBuiltIn: false, pinned: true });
    setTitle(""); setIcon(""); setDurMins(60); setDefStart("09:00"); setColor("#3b82f6"); setDow([]);
    onCreated();
  };

  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "16px 20px 4px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 12 }}>
        New Routine
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Emoji + Name */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🎯"
            style={{ ...fieldStyle, width: 44, textAlign: "center", fontSize: 18, flexShrink: 0, padding: "6px 4px" }}
          />
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            placeholder="Routine name"
            style={{ ...fieldStyle, flex: 1 }}
          />
        </div>

        {/* Duration */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 6 }}>Duration</div>
          <DurationSelector value={durMins} onChange={setDurMins} />
        </div>

        {/* Start time */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--fg-faint)", flexShrink: 0 }}>Usually starts at</span>
          <input
            type="time" value={defStart} onChange={(e) => setDefStart(e.target.value)}
            style={{ ...fieldStyle, fontSize: 16, padding: "4px 8px" }}
          />
        </div>

        {/* Color */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 6 }}>Color</div>
          <ColorRow value={color} onChange={setColor} />
        </div>

        {/* Days */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 6 }}>Days (optional)</div>
          <div style={{ display: "flex", gap: 4 }}>
            {DAYS.map((d) => {
              const checked = dow.includes(d.value);
              return (
                <button
                  key={d.label} type="button"
                  onClick={() => setDow((prev) => { const s = new Set(prev); checked ? s.delete(d.value) : s.add(d.value); return Array.from(s); })}
                  style={{
                    flex: 1, padding: "4px 0", borderRadius: 6,
                    border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                    background: checked ? "var(--accent-bg)" : "transparent",
                    color: checked ? "var(--accent)" : "var(--fg-muted)",
                    fontSize: 10, fontWeight: 500, cursor: "pointer",
                  }}
                >{d.label}</button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!title.trim()}
          style={{
            padding: "9px 16px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            opacity: title.trim() ? 1 : 0.4, width: "100%", marginBottom: 8,
          }}
        >+ Add Routine</button>
      </div>
    </div>
  );
}

// ─── Panel (centered modal) ───────────────────────────────────────────────────

type Props = { open: boolean; onClose: () => void; prefill?: Partial<RoutineTemplate> | null };

export function RoutineTemplatePanel({ open, onClose, prefill }: Props) {
  const templates        = useRoutineTemplateStore((s) => s.templates);
  const updateTemplate   = useRoutineTemplateStore((s) => s.updateTemplate);
  const reorderTemplates = useRoutineTemplateStore((s) => s.reorderTemplates);
  const deleteTemplate   = useRoutineTemplateStore((s) => s.deleteTemplate);

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [editingId,  setEditingId]  = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Sync order when panel opens
  useEffect(() => {
    if (!open) return;
    setOrderedIds([...templates].sort((a, b) => a.order - b.order).map((t) => t.id));
    setEditingId(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep list in sync when templates change (new added / deleted)
  useEffect(() => {
    const allIds = templates.map((t) => t.id);
    setOrderedIds((ids) => {
      const surviving = ids.filter((id) => allIds.includes(id));
      const added     = allIds.filter((id) => !surviving.includes(id));
      return [...surviving, ...added];
    });
  }, [templates]);

  useEffect(() => {
    if (open && prefill) setEditingId(null);
  }, [open, prefill]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const ordered = orderedIds
    .map((id) => templates.find((t) => t.id === id))
    .filter((t): t is RoutineTemplate => t != null);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = orderedIds.indexOf(active.id as string);
    const newIdx = orderedIds.indexOf(over.id as string);
    const newIds = arrayMove(orderedIds, oldIdx, newIdx);
    setOrderedIds(newIds);
    // Use atomic transaction — avoids concurrent set() races from Promise.all(updateTemplate...)
    await reorderTemplates(newIds);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.30)", border: "none", cursor: "default" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          width: "min(560px, 90vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-card)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 8px 32px rgba(0,0,0,0.10)",
          animation: "gs-scale 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>Routines</span>
          <button
            type="button"
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "var(--fg-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Template list */}
          {templates.length === 0 ? (
            <div style={{ padding: "24px 20px", textAlign: "center", fontSize: 13, color: "var(--fg-faint)", fontStyle: "italic" }}>
              No routines yet — create one below
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                {ordered.map((t) => (
                  <SortableRow
                    key={t.id}
                    templateId={t.id}
                    isEditing={editingId === t.id}
                    onEditOpen={() => setEditingId(t.id)}
                    onEditCancel={() => setEditingId(null)}
                    onEditSave={async (changes) => { await updateTemplate(t.id, changes); setEditingId(null); }}
                    onDelete={() => void deleteTemplate(t.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* Create form */}
          <CreateForm key={open ? "open" : "closed"} onCreated={() => {}} />
        </div>
      </div>
    </div>
  );
}
