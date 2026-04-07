"use client";

function localDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextWeekday(targetDay: number) {
  const now = new Date();
  let diff = (targetDay - now.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  now.setDate(now.getDate() + diff);
  return localDateString(now);
}

/** Shared date picker content — pill buttons + date input + No Date. Used in context menus and popovers. */
export function DatePickerContent({
  onSelect,
  currentDate,
}: {
  onSelect: (date: string | undefined) => void;
  currentDate?: string;
}) {
  const today    = localDateString(new Date());
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return localDateString(d); })();

  const quickDates = [
    { label: "Today",    date: today },
    { label: "Tomorrow", date: tomorrow },
    { label: "Weekend",  date: nextWeekday(6) },
    { label: "Next Mon", date: nextWeekday(1) },
  ];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {quickDates.map(({ label, date }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(date)}
            style={{
              fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 8,
              cursor: "pointer", border: "1px solid transparent",
              ...(currentDate === date
                ? { background: "var(--accent-bg-strong)", color: "var(--accent)" }
                : { background: "var(--bg-hover)", color: "var(--fg-muted)" }),
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="date"
        defaultValue={currentDate ?? ""}
        onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
        style={{
          width: "100%", padding: "6px 10px", borderRadius: 8, fontSize: 12,
          border: "1px solid var(--border)", background: "var(--bg-subtle)",
          color: "var(--fg)", outline: "none", boxSizing: "border-box",
        }}
      />
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        style={{
          display: "block", width: "100%", marginTop: 4, padding: "5px 10px",
          borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", background: "none",
          border: "none", cursor: "pointer", textAlign: "left",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        No date
      </button>
    </div>
  );
}
