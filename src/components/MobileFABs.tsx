"use client";

import { useEffect, useState } from "react";
import { useFocusStore } from "@/store/focusStore";
import { useVisualViewport } from "@/hooks/useVisualViewport";

export function MobileFABs() {
  const isSetupModalOpen = useFocusStore((s) => s.isSetupModalOpen);
  const setSetupModalOpen = useFocusStore((s) => s.setSetupModalOpen);
  const { height: vpHeight } = useVisualViewport();
  const [windowHeight, setWindowHeight] = useState(0);

  useEffect(() => {
    setWindowHeight(window.innerHeight);
    const update = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const keyboardHeight = Math.max(0, windowHeight - vpHeight);
  const isKeyboardUp = keyboardHeight > 20;

  const TAB_BAR_H = 72; // keep in sync with --tab-bar-h in globals.css
  const bottomOffset = isKeyboardUp
    ? keyboardHeight + 16
    : TAB_BAR_H + 8; // Slightly tighter to bottom bar

  const openNewTask = () => {
    window.dispatchEvent(new Event("stride:open-quickadd"));
  };

  const openFocusModal = () => {
    setSetupModalOpen(!isSetupModalOpen);
  };

  return (
    <div
      className={`md:hidden fixed right-4 z-40 flex flex-col items-center gap-3 transition-all duration-300 ${
        isKeyboardUp ? "opacity-0 pointer-events-none scale-90 translate-y-4" : "opacity-100 scale-100 translate-y-0"
      }`}
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))`,
      }}
    >
      {/* Focus Mode FAB (top) */}
      <button
        type="button"
        onClick={openFocusModal}
        aria-label="Focus Mode"
        className="flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95 shadow-xl"
        style={{
          background: "var(--accent)",
          color: "white",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        {/* Lightning bolt */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M11 2L4 11h6l-1 7 7-9h-6l1-7z"/>
        </svg>
      </button>

      {/* New Task FAB (bottom, closest to tab bar) */}
      <button
        type="button"
        onClick={openNewTask}
        aria-label="New Task"
        className="flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95 shadow-xl"
        style={{
          background: "var(--accent)",
          color: "white",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        {/* Plus icon */}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <line x1="11" y1="3" x2="11" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
