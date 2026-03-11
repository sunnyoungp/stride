"use client";

import { useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { useRoutineTemplateStore } from "@/store/routineTemplateStore";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import { Settings } from "lucide-react";
import { RoutineTemplate } from "@/types";

type Props = {
  onManageTemplates: () => void;
};

export function RoutineTemplateStrip({ onManageTemplates }: Props) {
  const templates = useRoutineTemplateStore((s) => s.templates);
  const loadTemplates = useRoutineTemplateStore((s) => s.loadTemplates);
  const applyTemplatesToDay = useRoutineTemplateStore((s) => s.applyTemplatesToDay);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

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
          borderColor: ds.templateColor,
          extendedProps: { 
            routineTemplateId: ds.templateId,
            type: "routine"
          },
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
    if (diff < 0) diff += 24 * 60; // Handle overnight
    
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "pm" : "am";
    const hours = h % 12 || 12;
    return `${hours}${m > 0 ? ":" + String(m).padStart(2, "0") : ""}${period}`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Routines</h3>
        <button 
          onClick={onManageTemplates}
          className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Manage Templates"
        >
          <Settings size={14} />
        </button>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar"
      >
        {templates.map((t) => (
          <div
            key={t.id}
            data-template-id={t.id}
            data-template-title={t.title}
            data-template-color={t.color}
            data-template-duration={getDuration(t.startTime, t.endTime)}
            onClick={() => handleApply(t.id)}
            className="group cursor-grab active:cursor-grabbing relative flex flex-col gap-1 p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{t.icon || "⏱️"}</span>
              <span className="text-sm font-medium text-zinc-200 truncate">{t.title}</span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              {formatTime(t.startTime)} – {formatTime(t.endTime)}
            </div>
            
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2/3 rounded-r-full opacity-60"
              style={{ backgroundColor: t.color }}
            />
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-zinc-600 italic">No templates found</p>
          </div>
        )}
      </div>
    </div>
  );
}
