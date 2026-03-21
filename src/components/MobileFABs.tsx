"use client";

import { useFocusStore } from "@/store/focusStore";

export function MobileFABs() {
  const isSetupModalOpen = useFocusStore((s) => s.isSetupModalOpen);
  const setSetupModalOpen = useFocusStore((s) => s.setSetupModalOpen);

  const openNewTask = () => {
    window.dispatchEvent(new Event("stride:open-quickadd"));
  };

  const openFocusModal = () => {
    setSetupModalOpen(!isSetupModalOpen);
  };

  return (
    <div
      className="md:hidden fixed right-4 z-40 flex flex-col items-center gap-3"
      style={{
        bottom: "calc(56px + env(safe-area-inset-bottom) + 16px)",
      }}
    >
      {/* Focus Mode FAB (top) */}
      <button
        type="button"
        onClick={openFocusModal}
        aria-label="Focus Mode"
        className="flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          background: "var(--accent)",
          color: "white",
          boxShadow: "0 4px 16px rgba(232,96,60,0.45)",
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
        className="flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          background: "var(--accent)",
          color: "white",
          boxShadow: "0 4px 16px rgba(232,96,60,0.45)",
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
