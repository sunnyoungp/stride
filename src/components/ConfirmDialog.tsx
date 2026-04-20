"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { registerConfirmHandler } from "@/lib/confirm";

type ConfirmState = {
  message: string;
  resolve: (value: boolean) => void;
};

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    return registerConfirmHandler((message, resolve) => {
      setState({ message, resolve });
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { state.resolve(false); setState(null); }
      if (e.key === "Enter") { state.resolve(true); setState(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state]);

  if (!state || !mounted) return null;

  const handleConfirm = () => { state.resolve(true); setState(null); };
  const handleCancel = () => { state.resolve(false); setState(null); };

  const isDanger = /delete|remove/i.test(state.message);
  const confirmLabel = /^delete/i.test(state.message.trim()) ? "Delete" : "Confirm";

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={state.message}
        className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl p-6"
        style={{
          background: "var(--bg-card)",
          backdropFilter: "var(--glass-blur-card)",
          WebkitBackdropFilter: "var(--glass-blur-card)",
          border: "1px solid var(--border-mid)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--fg)" }}>
          {state.message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl px-4 py-2 text-sm transition-all duration-150 hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--fg)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 hover:opacity-90"
            style={{
              background: isDanger ? "var(--error)" : "var(--accent)",
              color: "white",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
