"use client";

import { useEffect, useRef } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { useRoutineTemplateStore } from "@/store/routineTemplateStore";
import { Settings } from "lucide-react";

type Props = { onManageTemplates: () => void };

export function RoutineTemplateStrip({ onManageTemplates }: Props) {
  const templates           = useRoutineTemplateStore((s) => s.templates);
  const isLoading           = useRoutineTemplateStore((s) => s.isLoading);
  const loadTemplates       = useRoutineTemplateStore((s) => s.loadTemplates);
  const applyTemplatesToDay = useRoutineTemplateStore((s) => s.applyTemplatesToDay);
  const containerRef        = useRef<HTMLDivElement>(null);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: "[data-template-id]",
      eventData: (eventEl) => {
        const ds = (eventEl as HTMLElement).dataset;
        return {
          title: ds.templateTitle || "Routine",
          duration: ds.templateDuration || "01:00",
          backgroundColor: ds.templateColor,
          borderColor: "transparent",
          extendedProps: { routineTemplateId: ds.templateId, type: "routine" },
        };
      },
    });
    return () => draggable.destroy();
  }, [templates]);

  const handleApply = (id: string) => {
    const today = new Date().toISOString().split("T")[0];
    void applyTemplatesToDay([id], today);
  };

  const getDuration = (start: string, end: string) => {
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "pm" : "am";
    return `${h % 12 || 12}${m > 0 ? ":" + String(m).padStart(2, "0") : ""}${period}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between flex-none" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>Routines</h3>
        <button onClick={onManageTemplates} className="p-1.5 rounded-lg transition-all duration-150 hover:bg-[var(--bg-hover)]" style={{ color: "var(--fg-faint)" }} title="Manage Templates">
          <Settings size={13} />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: "var(--border-mid)", borderTopColor: "var(--fg-muted)" }} />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-6 text-center text-xs italic" style={{ color: "var(--fg-faint)" }}>No templates yet</div>
        ) : templates.map((t) => (
          <div
            key={t.id}
            data-template-id={t.id}
            data-template-title={t.title}
            data-template-color={t.color}
            data-template-duration={getDuration(t.startTime, t.endTime)}
            onClick={() => handleApply(t.id)}
            className="relative flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-150 hover:bg-[var(--bg-hover)]"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{t.icon || "⏱️"}</span>
              <span className="text-sm font-medium truncate" style={{ color: "var(--fg)" }}>{t.title}</span>
            </div>
            <div className="text-[11px] font-mono pl-7" style={{ color: "var(--fg-faint)" }}>
              {formatTime(t.startTime)} – {formatTime(t.endTime)}
            </div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2/3 rounded-r-full opacity-60" style={{ backgroundColor: t.color }} />
          </div>
        ))}
      </div>
    </div>
  );
}
