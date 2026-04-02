"use client";

import type { RoutineTemplate } from "@/types/index";

export function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function minutesToHHmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function RoutineChip({
  template,
  draggable = false,
  onClick,
}: {
  template: RoutineTemplate;
  draggable?: boolean;
  onClick?: () => void;
}) {
  const rgb = hexToRgb(template.color || "#52525b");

  return (
    <div
      onClick={onClick}
      data-template-id={template.id}
      data-template-title={template.title}
      data-template-color={template.color}
      data-template-duration={minutesToHHmm(template.durationMinutes ?? 60)}
      style={{
        height: "34px",
        padding: "0 12px",
        borderRadius: "8px",
        background: `rgba(${rgb}, 0.08)`,
        border: `1px solid rgba(${rgb}, 0.20)`,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        cursor: draggable ? "grab" : onClick ? "pointer" : "default",
        userSelect: "none",
        transition: "all 150ms ease",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `rgba(${rgb}, 0.15)`;
        e.currentTarget.style.borderColor = `rgba(${rgb}, 0.35)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `rgba(${rgb}, 0.08)`;
        e.currentTarget.style.borderColor = `rgba(${rgb}, 0.20)`;
      }}
    >
      <span style={{ fontSize: "13px", lineHeight: 1 }}>{template.icon || "⏱️"}</span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: `color-mix(in srgb, ${template.color}, black 20%)` }}>
        {template.title}
      </span>
      <span style={{ fontSize: "11px", color: `color-mix(in srgb, ${template.color}, black 30%)`, opacity: 0.8 }}>
        · {formatDuration(template.durationMinutes ?? 60)}
      </span>
    </div>
  );
}
