"use client";

import { useFocusStore } from "@/store/focusStore";
import { Pause, Play, Maximize2 } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";

const EDGE_MARGIN = 12;
const SPRING = "left 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)";
const STORAGE_KEY = "stride-focus-pill-anchor";

type Pos = { x: number; y: number };

function getAnchors(pw: number, ph: number): Pos[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = EDGE_MARGIN;
  return [
    { x: m,                   y: m },                    // top-left
    { x: (vw - pw) / 2,       y: m },                    // top-center
    { x: vw - pw - m,         y: m },                    // top-right
    { x: m,                   y: (vh - ph) / 2 },        // middle-left
    { x: vw - pw - m,         y: (vh - ph) / 2 },        // middle-right
    { x: m,                   y: vh - ph - m },          // bottom-left
    { x: (vw - pw) / 2,       y: vh - ph - m },          // bottom-center
    { x: vw - pw - m,         y: vh - ph - m },          // bottom-right
  ];
}

function nearest(pos: Pos, anchors: Pos[]): Pos {
  return anchors.reduce((best, a) =>
    Math.hypot(pos.x - a.x, pos.y - a.y) < Math.hypot(pos.x - best.x, pos.y - best.y) ? a : best
  );
}

function loadSaved(): Pos | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { return null; }
}

function persist(p: Pos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

export function FocusPill() {
  const { focusState, toggleMinimized, togglePause } = useFocusStore();
  const { playlist, currentIndex, timeRemaining, mode, isPaused } = focusState;
  const currentTask = playlist[currentIndex];

  const pillRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<Pos>({ x: 0, y: 0 });
  const posRef = useRef<Pos | null>(null);

  const [pos, setPos] = useState<Pos | null>(null);
  const [springing, setSpringing] = useState(false);

  // Keep posRef in sync
  useEffect(() => { posRef.current = pos; }, [pos]);

  // Initialize position after first render (need pill dimensions)
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const { width, height } = pill.getBoundingClientRect();
    const saved = loadSaved();
    if (saved) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const clamped: Pos = {
        x: Math.max(EDGE_MARGIN, Math.min(saved.x, vw - width - EDGE_MARGIN)),
        y: Math.max(EDGE_MARGIN, Math.min(saved.y, vh - height - EDGE_MARGIN)),
      };
      setPos(clamped);
    } else {
      // Default: top-center
      setPos({ x: (window.innerWidth - width) / 2, y: EDGE_MARGIN });
    }
  }, []);

  const snapNearest = useCallback((current: Pos) => {
    const pill = pillRef.current;
    if (!pill) return;
    const { width, height } = pill.getBoundingClientRect();
    const snapped = nearest(current, getAnchors(width, height));
    setSpringing(true);
    setPos(snapped);
    persist(snapped);
    setTimeout(() => setSpringing(false), 500);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const pill = pillRef.current;
    if (!pill || !posRef.current) return;
    e.preventDefault();
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
    pill.setPointerCapture(e.pointerId);
    setSpringing(false);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const pill = pillRef.current;
    if (!pill) return;
    const { width, height } = pill.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      x: Math.max(EDGE_MARGIN, Math.min(e.clientX - dragOffset.current.x, vw - width - EDGE_MARGIN)),
      y: Math.max(EDGE_MARGIN, Math.min(e.clientY - dragOffset.current.y, vh - height - EDGE_MARGIN)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (posRef.current) snapNearest(posRef.current);
  }, [snapNearest]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const posStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, transition: springing ? SPRING : "none" }
    : { top: 16, left: "50%", transform: "translateX(-50%)" };

  return (
    <div
      ref={pillRef}
      className="fixed z-[9999] flex items-center gap-2 px-4 py-2 rounded-full select-none"
      style={{
        ...posStyle,
        background: "var(--bg-card)",
        backdropFilter: "var(--glass-blur-card)",
        WebkitBackdropFilter: "var(--glass-blur-card)",
        border: "1px solid var(--glass-border)",
        borderTop: "1px solid var(--glass-border-top)",
        boxShadow: "var(--shadow-float)",
        maxWidth: "calc(100vw - 32px)",
        cursor: "grab",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Accent dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: "var(--accent)" }}
      />

      {/* Task title */}
      <span
        className="text-sm font-medium truncate"
        style={{ color: "var(--fg)", maxWidth: "200px" }}
      >
        {currentTask?.title ?? "Focus session"}
      </span>

      {/* Timer countdown — Pomodoro mode */}
      {mode === "pomodoro" && (
        <span
          className="text-sm font-medium flex-shrink-0"
          style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}
        >
          {formatTime(timeRemaining)}
        </span>
      )}

      {/* Pause / Resume — Pomodoro and Timer modes */}
      {(mode === "pomodoro" || mode === "timer") && (
        <button
          onClick={togglePause}
          className="flex-shrink-0 p-1 rounded-full transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg-muted)", lineHeight: 0 }}
          title={isPaused ? "Resume" : "Pause"}
        >
          {isPaused
            ? <Play className="w-3.5 h-3.5 fill-current" />
            : <Pause className="w-3.5 h-3.5 fill-current" />}
        </button>
      )}

      {/* Expand back to full */}
      <button
        onClick={toggleMinimized}
        className="flex-shrink-0 p-1 rounded-full transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--fg-muted)", lineHeight: 0 }}
        title="Expand focus session"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
