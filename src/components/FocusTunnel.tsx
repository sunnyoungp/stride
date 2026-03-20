"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useFocusStore } from "@/store/focusStore";
import { useTaskStore } from "@/store/taskStore";
import { X, Check, ChevronRight, ChevronLeft, Pause, Play, Eye, EyeOff, RotateCcw } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { Task } from "@/types/index";

// Matte Gallery Palette Logic — intentional visual variety, kept as-is
const getMatteStyle = (index: number) => {
  if (index % 2 === 0) {
    return {
      bg: "bg-white",
      text: "text-zinc-900",
      fill: "#E05252",
    };
  }
  const cycleIndex = (Math.floor(index / 2)) % 3;
  switch (cycleIndex) {
    case 0: return { bg: "bg-[#E8F5E9]", text: "text-green-900", fill: "#1b4332" };
    case 1: return { bg: "bg-[#F3E5F5]", text: "text-purple-900", fill: "#4a148c" };
    case 2: return { bg: "bg-[#FFEBEE]", text: "text-rose-900", fill: "#880e4f" };
    default: return { bg: "bg-white", text: "text-zinc-900", fill: "#E05252" };
  }
};

export function FocusTunnel() {
  const { focusState, endFocusSession, toggleZenMode, nextTask, prevTask, setTimeRemaining, togglePause } = useFocusStore();
  const updateTask = useTaskStore(state => state.updateTask);

  const { playlist, currentIndex, timeRemaining, mode, isPaused, duration } = focusState;
  const currentTask = playlist[currentIndex];

  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [isSpotlightOn, setIsSpotlightOn] = useState(false);

  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [lastDoneTask, setLastDoneTask] = useState<{ task: Task, index: number } | null>(null);
  const [hasDoneAnything, setHasDoneAnything] = useState(false);

  const activeCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeCardRef.current && !isSpotlightOn) {
      activeCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, isSpotlightOn]);

  useEffect(() => {
    const t = setInterval(() => setSessionElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (mode === "timer" && !isPaused && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mode, isPaused, timeRemaining, setTimeRemaining]);

  const handleComplete = async (taskId: string, index: number) => {
    setCheckingIds(prev => new Set(prev).add(taskId));

    setTimeout(async () => {
      const task = playlist[index];
      if (!task) return;

      setLastDoneTask({ task, index });
      setHasDoneAnything(true);

      await updateTask(taskId, { status: "done" });
      setCompletedIds(prev => new Set(prev).add(taskId));

      setCheckingIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });

      if (index === currentIndex) {
        nextTask();
      }
    }, 1500);
  };

  const handleUndo = async () => {
    if (!lastDoneTask) return;
    const { task } = lastDoneTask;
    await updateTask(task.id, { status: "todo" });
    setCompletedIds(prev => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    setLastDoneTask(null);
  };

  const handleLeave = () => {
    endFocusSession();
    toggleZenMode();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleLeave();
      if (e.key === " ") togglePause();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [togglePause]);

  const sessionTotalTime = duration || 1500;
  const timerProgress = (timeRemaining / sessionTotalTime) * 100;
  const isVaultLocked = mode === "vault" && sessionElapsed < 300;

  if (!currentTask) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100vh", width: "100vw",
        background: "var(--bg)",
      }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center" }}>
          <h1 style={{
            fontSize: "13px", fontWeight: 700, color: "var(--fg-faint)",
            textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "32px",
          }}>All Tasks Clear</h1>
          <button
            onClick={handleLeave}
            style={{
              padding: "12px 48px", background: "var(--accent)", color: "#fff",
              borderRadius: "9999px", border: "none", fontWeight: 600,
              fontSize: "13px", cursor: "pointer",
            }}
          >Return</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col h-screen w-screen transition-colors duration-1000"
      style={{ background: "var(--bg)" }}
    >
      {/* ESC label */}
      <div className="absolute top-10 right-10 z-[100] pointer-events-none">
        <span style={{
          fontSize: "10px", fontWeight: 700, color: "var(--fg-faint)",
          textTransform: "uppercase", letterSpacing: "0.2em", opacity: 0.5,
        }}>Esc to exit</span>
      </div>

      {/* Hero timer — large centered ring */}
      {mode === 'timer' && (
        <div style={{
          position: "absolute",
          top: "40px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 70,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
        }}>
          <div style={{ position: "relative", width: "120px", height: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="3" />
              <motion.circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3.5"
                strokeDasharray="339.3"
                animate={{ strokeDashoffset: 339.3 * (1 - timerProgress / 100) }}
                transition={{ duration: 0.5, ease: "linear" }}
                strokeLinecap="round"
              />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", zIndex: 1 }}>
              <span style={{
                fontSize: "28px",
                fontWeight: 300,
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "-1px",
                color: "var(--fg)",
                lineHeight: 1,
              }}>
                {formatTime(timeRemaining)}
              </span>
              <span style={{ fontSize: "10px", color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {isPaused ? "Paused" : "Focus"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-700
          ${isSpotlightOn ? 'items-center justify-center overflow-hidden' : 'items-center overflow-y-auto'}`}
        style={{
          paddingTop: isSpotlightOn ? 0 : mode === 'timer' ? '28vh' : '20vh',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as React.CSSProperties}
      >
        <style dangerouslySetInnerHTML={{ __html: `.flex-1::-webkit-scrollbar { display: none; }` }} />

        <div className={`w-full ${isSpotlightOn ? 'max-w-4xl' : 'max-w-2xl'} px-6 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]`}>
          <LayoutGroup>
            <AnimatePresence mode="popLayout" initial={false}>
              {playlist
                .filter(task => !completedIds.has(task.id))
                .map((task, visibleIdx) => {
                  const originalIdx = playlist.findIndex(t => t.id === task.id);
                  const isActive = originalIdx === currentIndex;
                  const isChecking = checkingIds.has(task.id);
                  const isVisible = !isSpotlightOn || isActive;
                  if (!isVisible) return null;

                  const style = getMatteStyle(visibleIdx);

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      ref={isActive ? activeCardRef : null}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{
                        opacity: isActive ? 1 : 0.4,
                        scale: isActive ? 1 : 0.98,
                        y: 0
                      }}
                      exit={{
                        opacity: 0,
                        x: -60,
                        scale: 0.9,
                        transition: { duration: 0.5, ease: "anticipate" }
                      }}
                      transition={{ type: "spring", stiffness: 350, damping: 38 }}
                      className={`relative w-full ${style.bg} rounded-[32px] p-10 md:p-12 mb-4 last:mb-0 transition-all duration-700 shadow-none`}
                      style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                    >
                      <div className="flex items-center gap-10">
                        <button
                          onClick={() => handleComplete(task.id, originalIdx)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-500"
                          style={{
                            borderColor: isChecking ? style.fill : 'rgba(0,0,0,0.1)',
                            backgroundColor: isChecking ? style.fill : 'transparent'
                          }}
                        >
                          <Check className={`w-3.5 h-3.5 text-white transition-opacity ${isChecking ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                        </button>

                        <div className="flex-1 min-w-0">
                          <h2 className={`font-medium tracking-tight transition-all duration-500 ${isSpotlightOn ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'} ${
                            isChecking
                              ? 'text-zinc-400 line-through opacity-50'
                              : style.text
                          }`}>
                            {task.title}
                          </h2>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </div>

      {/* Control pill */}
      <div className="absolute bottom-12 left-0 right-0 z-[120] pointer-events-none flex items-center justify-center gap-4 px-6">
        <div
          className="flex items-center gap-1 pointer-events-auto rounded-full px-2 py-2"
          style={{
            background: "rgba(var(--bg-card-rgb, 255,255,255), 0.85)",
            backdropFilter: "blur(24px)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          }}
        >
          <AnimatePresence>
            {hasDoneAnything && (
              <motion.button
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1, marginRight: 8 }}
                onClick={handleUndo}
                className="p-3 rounded-full transition-all focus:outline-none"
                style={{ color: "var(--fg)" }}
                title="Undo completion"
              >
                <RotateCcw className="w-5 h-5" strokeWidth={1.5} />
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={prevTask}
            disabled={currentIndex === 0}
            className="p-3 disabled:opacity-5 transition-colors focus:outline-none"
            style={{ color: "var(--fg-faint)" }}
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={1.2} />
          </button>

          <button
            onClick={() => setIsSpotlightOn(!isSpotlightOn)}
            className="p-3 transition-all rounded-full"
            style={{
              color: isSpotlightOn ? "var(--accent)" : "var(--fg-faint)",
              background: isSpotlightOn ? "var(--accent-bg)" : "transparent",
            }}
          >
            {isSpotlightOn ? <Eye className="w-6 h-6" strokeWidth={1.2} /> : <EyeOff className="w-6 h-6" strokeWidth={1.2} />}
          </button>

          {mode === 'timer' && (
            <button
              onClick={togglePause}
              className="p-3 focus:outline-none"
              style={{ color: "var(--accent)" }}
            >
              {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
            </button>
          )}

          <button
            onClick={nextTask}
            disabled={currentIndex === playlist.length - 1}
            className="p-3 disabled:opacity-5 transition-colors focus:outline-none"
            style={{ color: "var(--fg-faint)" }}
          >
            <ChevronRight className="w-6 h-6" strokeWidth={1.2} />
          </button>
        </div>

        <button
          onClick={handleLeave}
          className="pointer-events-auto backdrop-blur-3xl rounded-full transition-all"
          style={{
            padding: "16px 40px",
            background: "rgba(var(--bg-card-rgb, 255,255,255), 0.7)",
            border: "1px solid var(--border)",
            fontSize: "10px", fontWeight: 900,
            textTransform: "uppercase", letterSpacing: "0.3em",
            color: "var(--fg-faint)",
            opacity: isVaultLocked ? 0.2 : 1,
            cursor: isVaultLocked ? "not-allowed" : "pointer",
          }}
          onMouseEnter={e => { if (!isVaultLocked) e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--fg-faint)"; }}
        >
          {isVaultLocked ? "Locked" : "Leave"}
        </button>
      </div>
    </div>
  );
}
