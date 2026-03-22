"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { Settings } from "lucide-react";

import { useRoutineTemplateStore } from "@/store/routineTemplateStore";
import { RoutineChip } from "@/components/RoutineChip";

type Props = { onManageTemplates: () => void };

export function RoutineTemplateStrip({ onManageTemplates }: Props) {
  const templates           = useRoutineTemplateStore((s) => s.templates);
  const applyTemplatesToDay = useRoutineTemplateStore((s) => s.applyTemplatesToDay);
  const containerRef        = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const pinned = useMemo(
    () => templates.filter((t) => t.pinned === true).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [templates],
  );
  const unpinned = useMemo(
    () => templates.filter((t) => t.pinned !== true),
    [templates],
  );

  // FullCalendar drag-onto-calendar — chip renders all data-template-* attrs
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: "[data-template-id]",
      eventData: (eventEl) => {
        const ds = (eventEl as HTMLElement).dataset;
        return {
          title:           ds.templateTitle ?? "Routine",
          duration:        ds.templateDuration ?? "01:00",
          backgroundColor: ds.templateColor,
          borderColor:     "transparent",
          extendedProps:   { routineTemplateId: ds.templateId, type: "routine" },
        };
      },
    });
    return () => draggable.destroy();
  }, [templates]);

  const handleApply = (id: string) => {
    const today = new Date().toISOString().split("T")[0]!;
    void applyTemplatesToDay([id], today);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ padding: "8px 12px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-faint)" }}>
          Routines
        </span>
        <button
          type="button"
          onClick={onManageTemplates}
          title="Manage templates"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 4, borderRadius: 6, border: "none", background: "transparent", color: "var(--fg-faint)", cursor: "pointer", transition: "color 100ms" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-faint)")}
        >
          <Settings size={12} />
        </button>
      </div>

      {/* Chip area */}
      <div ref={containerRef} style={{ padding: "0 12px 10px" }}>
        {templates.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--fg-faint)", fontStyle: "italic", padding: "4px 0" }}>
            No templates yet
          </div>
        ) : (
          <>
            {/* Pinned chips + expand toggle in same flex wrap */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {pinned.map((t) => (
                <RoutineChip
                  key={t.id}
                  template={t}
                  draggable
                  onClick={() => handleApply(t.id)}
                />
              ))}

              {unpinned.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 9999,
                    background: "var(--bg-hover)",
                    border: "none",
                    color: "var(--fg-muted)",
                    cursor: "pointer",
                    flexShrink: 0,
                    lineHeight: "22px",
                  }}
                >
                  {expanded ? "▴ less" : "▾ more"}
                </button>
              )}
            </div>

            {/* Unpinned section (expanded) */}
            {expanded && unpinned.length > 0 && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "8px 0 6px" }} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {unpinned.map((t) => (
                    <RoutineChip
                      key={t.id}
                      template={t}
                      draggable
                      onClick={() => handleApply(t.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
