"use client";

import { useFocusStore } from "@/store/focusStore";
import { Pause, Play, Maximize2 } from "lucide-react";

export function FocusPill() {
  const { focusState, toggleMinimized, togglePause } = useFocusStore();
  const { playlist, currentIndex, timeRemaining, mode, isPaused } = focusState;
  const currentTask = playlist[currentIndex];

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2 rounded-full select-none"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-mid)",
        boxShadow: "var(--shadow-float)",
        backdropFilter: "blur(20px)",
        maxWidth: "calc(100vw - 32px)",
      }}
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

      {/* Timer countdown */}
      {mode === 'timer' && (
        <span
          className="text-sm font-mono flex-shrink-0"
          style={{ color: "var(--accent)" }}
        >
          {formatTime(timeRemaining)}
        </span>
      )}

      {/* Pause / Resume — timer mode only */}
      {mode === 'timer' && (
        <button
          onClick={togglePause}
          className="flex-shrink-0 p-1 rounded-full transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--fg-muted)", lineHeight: 0 }}
          title={isPaused ? "Resume" : "Pause"}
        >
          {isPaused
            ? <Play className="w-3.5 h-3.5 fill-current" />
            : <Pause className="w-3.5 h-3.5 fill-current" />
          }
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
