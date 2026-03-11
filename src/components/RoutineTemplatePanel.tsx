"use client";

import { useEffect, useMemo, useState } from "react";

import { useRoutineTemplateStore } from "@/store/routineTemplateStore";
import type { RoutineTemplate } from "@/types/index";

type Props = {
  open: boolean;
  onClose: () => void;
  prefill?: Partial<RoutineTemplate> | null;
};

const days = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
] as const;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatRange(start: string, end: string): string {
  return `${start}–${end}`;
}

export function RoutineTemplatePanel({ open, onClose, prefill }: Props) {
  const templates = useRoutineTemplateStore((s) => s.templates);
  const loadTemplates = useRoutineTemplateStore((s) => s.loadTemplates);
  const createTemplate = useRoutineTemplateStore((s) => s.createTemplate);
  const deleteTemplate = useRoutineTemplateStore((s) => s.deleteTemplate);
  const applyTemplatesToDay = useRoutineTemplateStore((s) => s.applyTemplatesToDay);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  );

  const [pickingDate, setPickingDate] = useState(false);
  const [applyDate, setApplyDate] = useState(todayDateString());

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [color, setColor] = useState("#52525b");
  const [icon, setIcon] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    void loadTemplates();
  }, [loadTemplates, open]);

  useEffect(() => {
    if (!open) return;
    if (!prefill) return;
    setShowCreate(true);
    setTitle(prefill.title ?? "");
    if (prefill.startTime) setStartTime(prefill.startTime);
    if (prefill.endTime) setEndTime(prefill.endTime);
    if (prefill.color) setColor(prefill.color);
    setIcon(prefill.icon ?? "");
    setDaysOfWeek(prefill.daysOfWeek ?? []);
  }, [open, prefill]);

  useEffect(() => {
    if (!open) {
      setPickingDate(false);
      setApplyDate(todayDateString());
      setShowCreate(false);
      setTitle("");
      setStartTime("09:00");
      setEndTime("10:00");
      setColor("#52525b");
      setIcon("");
      setDaysOfWeek([]);
    }
  }, [open]);

  if (!open) return null;

  const toggleTemplate = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const applyToday = async () => {
    await applyTemplatesToDay(selectedIds, todayDateString());
    onClose();
  };

  const applyToDate = async () => {
    await applyTemplatesToDay(selectedIds, applyDate);
    onClose();
  };

  const submitCreate = async () => {
    const t = title.trim();
    if (!t) return;
    await createTemplate({
      title: t,
      startTime,
      endTime,
      color,
      icon: icon.trim() || undefined,
      daysOfWeek,
      isBuiltIn: false,
    });
    setShowCreate(false);
    setTitle("");
    setStartTime("09:00");
    setEndTime("10:00");
    setColor("#52525b");
    setIcon("");
    setDaysOfWeek([]);
  };

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close routine panel"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full max-w-[420px] border-l border-white/10 bg-zinc-950 text-zinc-50 shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="text-sm font-semibold text-zinc-100">Routine Templates</div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-2">
              {templates.map((t) => {
                const checked = Boolean(selected[t.id]);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900/30 px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTemplate(t.id)}
                      className="h-4 w-4"
                    />
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-lg">
                      {t.icon ?? "⏱️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-100">
                        {t.title}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-400">
                        {formatRange(t.startTime, t.endTime)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full border border-white/10"
                        style={{ backgroundColor: t.color }}
                        aria-label="Color"
                      />
                      {!t.isBuiltIn ? (
                        <button
                          type="button"
                          aria-label="Delete template"
                          onClick={() => void deleteTemplate(t.id)}
                          className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        >
                          🗑️
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void applyToday()}
                disabled={selectedIds.length === 0}
                className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-white/15 disabled:opacity-50"
              >
                Apply to Today
              </button>

              {!pickingDate ? (
                <button
                  type="button"
                  onClick={() => setPickingDate(true)}
                  disabled={selectedIds.length === 0}
                  className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                >
                  Apply to Date
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={applyDate}
                    onChange={(e) => setApplyDate(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void applyToDate()}
                    disabled={selectedIds.length === 0 || !applyDate}
                    className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-white/15 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              {!showCreate ? (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10"
                >
                  + Create Template
                </button>
              ) : (
                <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-3">
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Title"
                      className="w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-zinc-500">Start</div>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">End</div>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-zinc-500">Color</div>
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="mt-1 h-10 w-full rounded-md border border-white/10 bg-zinc-950"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Icon</div>
                        <input
                          value={icon}
                          onChange={(e) => setIcon(e.target.value)}
                          placeholder="Emoji"
                          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Days of week</div>
                      <div className="mt-2 grid grid-cols-7 gap-2">
                        {days.map((d) => {
                          const checked = daysOfWeek.includes(d.value);
                          return (
                            <label
                              key={d.label}
                              className="flex flex-col items-center gap-1 text-xs text-zinc-300"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setDaysOfWeek((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(d.value);
                                    else next.delete(d.value);
                                    return Array.from(next);
                                  });
                                }}
                              />
                              <span>{d.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCreate(false)}
                        className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitCreate()}
                        className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-white/15"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

