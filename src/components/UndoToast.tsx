"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function UndoToast({ message, onUndo, onDismiss, durationMs = 5000 }: Props) {
  const [visible, setVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200); // wait for fade-out
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  const handleUndo = () => {
    onUndo();
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0" : "12px"})`,
        opacity: visible ? 1 : 0,
        transition: "all 0.2s ease",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderRadius: 12,
        background: "var(--bg-card)",
        backdropFilter: "var(--glass-blur-card)",
        WebkitBackdropFilter: "var(--glass-blur-card)",
        border: "1px solid var(--glass-border)",
        borderTop: "1px solid var(--glass-border-top)",
        boxShadow: "var(--shadow-float)",
        pointerEvents: "auto",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--fg)", whiteSpace: "nowrap" }}>
        {message}
      </span>
      <button
        type="button"
        onClick={handleUndo}
        className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-95"
        style={{
          background: "var(--accent-bg-strong)",
          color: "var(--accent)",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Undo
      </button>
    </div>,
    document.body
  );
}
