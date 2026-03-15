"use client";

type Props = { view: "list" | "kanban"; onChange: (v: "list" | "kanban") => void };

export function ViewSwitcher({ view, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
      {(["list", "kanban"] as const).map(v => (
        <button key={v} type="button" onClick={() => onChange(v)} style={{
          padding: "4px 12px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 500, lineHeight: 1.5,
          background: view === v ? "var(--accent)" : "transparent",
          color: view === v ? "white" : "var(--fg-muted)",
          transition: "all 150ms ease",
        }}>
          {v === "list" ? "List" : "Kanban"}
        </button>
      ))}
    </div>
  );
}
