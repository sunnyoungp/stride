"use client";

import { useEffect, useMemo, useState } from "react";
import { useRoutineTemplateStore } from "@/store/routineTemplateStore";
import type { RoutineTemplate } from "@/types/index";

type Props = { open: boolean; onClose: () => void; prefill?: Partial<RoutineTemplate> | null };

const days = [
  { label: "Mon", value: 1 }, { label: "Tue", value: 2 }, { label: "Wed", value: 3 },
  { label: "Thu", value: 4 }, { label: "Fri", value: 5 }, { label: "Sat", value: 6 }, { label: "Sun", value: 0 },
] as const;

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatRange(start: string, end: string) { return `${start}–${end}`; }

export function RoutineTemplatePanel({ open, onClose, prefill }: Props) {
  const templates           = useRoutineTemplateStore((s) => s.templates);
  const loadTemplates       = useRoutineTemplateStore((s) => s.loadTemplates);
  const createTemplate      = useRoutineTemplateStore((s) => s.createTemplate);
  const deleteTemplate      = useRoutineTemplateStore((s) => s.deleteTemplate);
  const applyTemplatesToDay = useRoutineTemplateStore((s) => s.applyTemplatesToDay);

  const [selected, setSelected]   = useState<Record<string, boolean>>({});
  const [pickingDate, setPickingDate] = useState(false);
  const [applyDate, setApplyDate] = useState(todayDateString());
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle]         = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime]     = useState("10:00");
  const [color, setColor]         = useState("#f4714a");
  const [icon, setIcon]           = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected]);

  useEffect(() => { if (open) void loadTemplates(); }, [loadTemplates, open]);

  useEffect(() => {
    if (!open || !prefill) return;
    setShowCreate(true);
    setTitle(prefill.title ?? "");
    if (prefill.startTime) setStartTime(prefill.startTime);
    if (prefill.endTime) setEndTime(prefill.endTime);
    if (prefill.color) setColor(prefill.color);
    setIcon(prefill.icon ?? "");
    setDaysOfWeek(prefill.daysOfWeek ?? []);
  }, [open, prefill]);

  useEffect(() => {
    if (!open) { setPickingDate(false); setApplyDate(todayDateString()); setShowCreate(false); setTitle(""); setStartTime("09:00"); setEndTime("10:00"); setColor("#f4714a"); setIcon(""); setDaysOfWeek([]); }
  }, [open]);

  if (!open) return null;

  const submitCreate = async () => {
    const t = title.trim();
    if (!t) return;
    await createTemplate({ title: t, startTime, endTime, color, icon: icon.trim() || undefined, daysOfWeek, isBuiltIn: false });
    setShowCreate(false); setTitle(""); setStartTime("09:00"); setEndTime("10:00"); setColor("#f4714a"); setIcon(""); setDaysOfWeek([]);
  };

  const fieldCls = "w-full rounded-xl px-3 py-2 text-sm outline-none transition-all duration-150";
  const fieldStyle = { background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--fg)" };
  const labelStyle = { color: "var(--fg-faint)" };

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label="Close" className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)" }} onClick={onClose} />

      <div className="absolute inset-y-0 right-0 w-full max-w-[420px] flex flex-col" style={{ background: "var(--bg-card)", borderLeft: "1px solid var(--border-mid)", boxShadow: "var(--shadow-float)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-none" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Routine Templates</div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]" style={{ color: "var(--fg-muted)" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Template list */}
          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl px-3 py-3" style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                <input type="checkbox" checked={Boolean(selected[t.id])} onChange={() => setSelected((p) => ({ ...p, [t.id]: !p[t.id] }))} className="h-4 w-4 accent-[var(--accent)]" />
                <div className="flex h-8 w-8 items-center justify-center rounded-xl text-lg" style={{ background: "var(--bg-hover)" }}>{t.icon ?? "⏱️"}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" style={{ color: "var(--fg)" }}>{t.title}</div>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>{formatRange(t.startTime, t.endTime)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: t.color, border: "1px solid var(--border)" }} />
                  {!t.isBuiltIn && (
                    <button type="button" onClick={() => void deleteTemplate(t.id)} className="rounded-lg px-1.5 py-1 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]" style={{ color: "var(--fg-faint)" }}>🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Apply actions */}
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" onClick={() => void applyTemplatesToDay(selectedIds, todayDateString()).then(onClose)}
              disabled={selectedIds.length === 0}
              className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#fff" }}
            >Apply to Today</button>

            {!pickingDate ? (
              <button type="button" onClick={() => setPickingDate(true)} disabled={selectedIds.length === 0}
                className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 hover:bg-[var(--bg-hover)] disabled:opacity-40"
                style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
              >Apply to Date</button>
            ) : (
              <div className="flex items-center gap-2">
                <input type="date" value={applyDate} onChange={(e) => setApplyDate(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle} />
                <button type="button" onClick={() => void applyTemplatesToDay(selectedIds, applyDate).then(onClose)}
                  disabled={selectedIds.length === 0 || !applyDate}
                  className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >Apply</button>
              </div>
            )}
          </div>

          {/* Create template */}
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            {!showCreate ? (
              <button type="button" onClick={() => setShowCreate(true)}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 hover:bg-[var(--bg-hover)]"
                style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
              >+ Create Template</button>
            ) : (
              <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={fieldCls} style={fieldStyle} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest mb-1" style={labelStyle}>Start</div>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={fieldCls} style={fieldStyle} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest mb-1" style={labelStyle}>End</div>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={fieldCls} style={fieldStyle} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest mb-1" style={labelStyle}>Color</div>
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 h-10 w-full rounded-xl border cursor-pointer" style={{ borderColor: "var(--border)" }} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest mb-1" style={labelStyle}>Icon</div>
                    <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Emoji" className={fieldCls} style={fieldStyle} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest mb-2" style={labelStyle}>Days</div>
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((d) => {
                      const checked = daysOfWeek.includes(d.value);
                      return (
                        <label key={d.label} className="flex flex-col items-center gap-1 text-[10px] cursor-pointer" style={{ color: checked ? "var(--accent)" : "var(--fg-muted)" }}>
                          <input type="checkbox" checked={checked} className="accent-[var(--accent)]"
                            onChange={(e) => setDaysOfWeek((prev) => { const s = new Set(prev); e.target.checked ? s.add(d.value) : s.delete(d.value); return Array.from(s); })}
                          />
                          {d.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]" style={{ color: "var(--fg-muted)" }}>Cancel</button>
                  <button type="button" onClick={() => void submitCreate()} className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150" style={{ background: "var(--accent)", color: "#fff" }}>Create</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
