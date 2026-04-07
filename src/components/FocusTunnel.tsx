"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useFocusStore } from "@/store/focusStore";
import { useTaskStore } from "@/store/taskStore";
import {
  Check, ChevronRight, ChevronLeft, Pause, Play, Eye, EyeOff,
  RotateCcw, Plus, Minimize2, Settings2, X, ArrowRightLeft
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { Task } from "@/types/index";

// Theme-aware card styles — glass panel surfaces that match the app's panel depth
const getCardStyle = (index: number) => {
  const styles = [
    { bg: "var(--bg-panel)", textColor: "var(--fg)", fill: "var(--accent)", border: "1px solid var(--glass-border)" },
    { bg: "var(--bg-card)", textColor: "var(--fg)", fill: "var(--accent)", border: "1px solid var(--glass-border)" },
    { bg: "var(--accent-bg)", textColor: "var(--fg)", fill: "var(--accent)", border: "1px solid var(--border)" },
  ];
  return styles[index % styles.length];
};

export function FocusTunnel() {
  const {
    focusState, clearSession, nextTask, prevTask,
    setTimeRemaining, togglePause, addTasksToPlaylist, removeTaskFromPlaylist, toggleMinimized, setSetupModalOpen, setAutoFlow
  } = useFocusStore();
  const updateTask = useTaskStore(state => state.updateTask);
  const createTask = useTaskStore(state => state.createTask);
  const allTasks = useTaskStore(state => state.tasks);

  const { playlist, currentIndex, timeRemaining, mode, isPaused, duration, autoFlow } = focusState;
  const currentTask = playlist[currentIndex];

  // ── Timer phase state ────────────────────────────────────────────────────────
  const [timerPhase, setTimerPhase] = useState<'work' | 'break' | 'break-prompt'>('work');
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [workDuration, setWorkDuration] = useState(duration || 1500);
  const [breakDuration, setBreakDuration] = useState(300);
  const [showTimerSettings, setShowTimerSettings] = useState(false);

  // ── Playlist panel state ─────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'today' | 'playlist'>('today'); // mobile only
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // ── Existing state ───────────────────────────────────────────────────────────
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [isSpotlightOn, setIsSpotlightOn] = useState(false);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [lastDoneTask, setLastDoneTask] = useState<{ task: Task; index: number } | null>(null);
  const [hasDoneAnything, setHasDoneAnything] = useState(false);

  const activeCardRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [pillOffset, setPillOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingPill, setIsDraggingPill] = useState(false);

  // Today's date string
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Playlist IDs for fast lookup
  const playlistIds = useMemo(() => new Set(playlist.map(t => t.id)), [playlist]);

  // All today's tasks (not completed/cancelled) for the TODAY column
  const todayTasks = useMemo(() => {
    return allTasks.filter(t => {
      if (t.status === 'done' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      const ds = t.dueDate.includes('T') ? t.dueDate.slice(0, 10) : t.dueDate;
      return ds === today;
    });
  }, [allTasks, today]);

  // Ring progress (0–1)
  const ringProgress =
    timerPhase === 'break' ? timeRemaining / breakDuration :
    timerPhase === 'break-prompt' ? 0 :
    timeRemaining / workDuration;

  // Session elapsed ticker
  useEffect(() => {
    if (mode === 'timer' && isPaused) return;
    const t = setInterval(() => setSessionElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [mode, isPaused]);

  // Reset local state cleanly on mode change
  useEffect(() => {
    setSessionElapsed(0);
    setTimerPhase('work');
    setRoundsCompleted(0);
  }, [mode]);

  // Pomodoro countdown with phase transitions
  useEffect(() => {
    if (mode !== "pomodoro") return;
    if (isPaused) return;
    if (timerPhase === 'break-prompt') return;

    if (timeRemaining <= 0) {
      if (timerPhase === 'work') {
        if (autoFlow) {
          setTimerPhase('break');
          setTimeRemaining(breakDuration);
        } else {
          setTimerPhase('break-prompt');
        }
      } else if (timerPhase === 'break') {
        setRoundsCompleted(r => r + 1);
        setTimerPhase('work');
        setTimeRemaining(workDuration);
      }
      return;
    }

    const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isPaused, timerPhase, timeRemaining, workDuration, breakDuration, autoFlow, setTimeRemaining]);

  // Scroll active card into view
  useEffect(() => {
    if (activeCardRef.current && !isSpotlightOn) {
      activeCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, isSpotlightOn]);

  // Focus quick-add input when panel opens
  useEffect(() => {
    if (panelOpen) {
      setTimeout(() => quickAddRef.current?.focus(), 100);
    }
  }, [panelOpen]);

  // Break actions
  const startBreak = () => { setTimerPhase('break'); setTimeRemaining(breakDuration); };
  const skipBreak = () => { setRoundsCompleted(r => r + 1); setTimerPhase('work'); setTimeRemaining(workDuration); };

  // Quick-add a new task into TODAY + optionally playlist
  const handleQuickAdd = async () => {
    if (!quickAddTitle.trim()) return;
    const task = await createTask({ title: quickAddTitle.trim(), dueDate: today, status: 'todo' });
    addTasksToPlaylist([task]);
    setQuickAddTitle('');
    quickAddRef.current?.focus();
  };

  // Toggle a task in/out of the session playlist (used in TODAY column)
  const handleTodayTaskClick = (task: Task) => {
    if (playlistIds.has(task.id)) {
      removeTaskFromPlaylist(task.id);
    } else {
      addTasksToPlaylist([task]);
    }
  };

  const handleComplete = async (taskId: string, index: number) => {
    setCheckingIds(prev => new Set(prev).add(taskId));
    setTimeout(async () => {
      const task = playlist[index];
      if (!task) return;
      setLastDoneTask({ task, index });
      setHasDoneAnything(true);
      await updateTask(taskId, { status: "done" });
      setCompletedIds(prev => new Set(prev).add(taskId));
      setCheckingIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
      if (index === currentIndex) nextTask();
    }, 1500);
  };

  const handleUndo = async () => {
    if (!lastDoneTask) return;
    const { task } = lastDoneTask;
    await updateTask(task.id, { status: "todo" });
    setCompletedIds(prev => { const next = new Set(prev); next.delete(task.id); return next; });
    setLastDoneTask(null);
  };

  const handleLeave = () => clearSession();

  const handlePillPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag from the pill container itself, not from buttons inside it
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: pillOffset.x, originY: pillOffset.y };
    setIsDraggingPill(true);
  };

  const handlePillPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPillOffset({ x: dragState.current.originX + dx, y: dragState.current.originY + dy });
  };

  const handlePillPointerUp = () => {
    dragState.current = null;
    setIsDraggingPill(false);
  };

  const formatStopwatch = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (panelOpen) { setPanelOpen(false); return; }
        if (showTimerSettings) { setShowTimerSettings(false); return; }
        // Escape minimizes the session — only "Finish" button ends it
        toggleMinimized();
        return;
      }
      if (e.key === " " && !panelOpen) togglePause();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePause, panelOpen, showTimerSettings, toggleMinimized]);

  const isVaultLocked = mode === "vault" && sessionElapsed < 300;

  if (!currentTask) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", width: "100vw", background: "var(--bg-app)" }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", marginBottom: "32px" }}>All Tasks Clear</h1>
          <button onClick={handleLeave} style={{ padding: "12px 48px", background: "var(--accent)", color: "#fff", borderRadius: "9999px", border: "none", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Return</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[100dvh] w-screen transition-colors duration-1000 overflow-hidden" style={{ background: "var(--bg-app)" }}>
      {/* ESC label */}
      <div className="absolute top-8 right-8 z-[100] pointer-events-none hidden md:block">
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase" }}>Esc to minimize</span>
      </div>

      {/* ── Pomodoro display ────────────────────────────────────────────────────── */}
      {mode === 'pomodoro' && (
        <>
          {/* Header Backdrop Gradient */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: "400px",
            background: "linear-gradient(to bottom, var(--bg-app) 60%, transparent 100%)",
            zIndex: 90,
            pointerEvents: "none"
          }} />

          <div style={{ position: "absolute", top: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "0 16px" }}>

            <div style={{
              borderRadius: "40px",
              padding: "20px 24px",
              width: "100%",
              maxWidth: "340px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transition: "background 500ms ease",
              position: "relative"
            }}>

              {showTimerSettings && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: "42px",
                    right: "0px",
                    background: "var(--bg-panel)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid var(--border-mid)",
                    borderRadius: "16px",
                    padding: "16px 18px",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                    zIndex: 300,
                    minWidth: "220px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", color: "var(--fg)", fontWeight: 500 }}>Work</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => setWorkDuration(d => Math.max(300, d - 300))} style={{ width: "26px", height: "26px", borderRadius: "6px", background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--fg)", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ fontSize: "13px", color: "var(--fg)", fontWeight: 600, minWidth: "52px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{workDuration / 60}m</span>
                      <button onClick={() => setWorkDuration(d => Math.min(5400, d + 300))} style={{ width: "26px", height: "26px", borderRadius: "6px", background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--fg)", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", color: "var(--fg)", fontWeight: 500 }}>Break</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => setBreakDuration(d => Math.max(60, d - 60))} style={{ width: "26px", height: "26px", borderRadius: "6px", background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--fg)", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ fontSize: "13px", color: "var(--fg)", fontWeight: 600, minWidth: "52px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{breakDuration / 60}m</span>
                      <button onClick={() => setBreakDuration(d => Math.min(1800, d + 60))} style={{ width: "26px", height: "26px", borderRadius: "6px", background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--fg)", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                  </div>
                </div>
              )}
              {/* Top Controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: "340px", marginBottom: "16px", position: "relative" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {timerPhase === 'break' ? 'Break Time' : `Round ${roundsCompleted + 1}`}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Auto-flow</span>
                    <button
                      onClick={() => setAutoFlow(!autoFlow)}
                      style={{
                        position: "relative", width: "32px", height: "18px", borderRadius: "9999px", border: "none",
                        background: autoFlow ? "var(--accent)" : "var(--border-strong)", cursor: "pointer", transition: "background 200ms", display: "flex", alignItems: "center",
                      }}
                      title={autoFlow ? "Auto-flow ON" : "Auto-flow OFF"}
                    >
                      <span style={{ position: "absolute", left: autoFlow ? "16px" : "2px", width: "14px", height: "14px", borderRadius: "50%", background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transition: "left 200ms", display: "block" }} />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowTimerSettings(s => !s)}
                    style={{ color: showTimerSettings ? "var(--accent)" : "var(--fg-faint)", padding: "2px", background: "none", border: "none", cursor: "pointer", lineHeight: 0 }}
                    title="Timer settings"
                  >
                    <Settings2 style={{ width: "16px", height: "16px" }} />
                  </button>
                </div>
              </div>

              {/* Time / Ring Display */}
              {timerPhase === 'break-prompt' ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", margin: "40px 0" }}>
                  <span style={{ fontSize: "15px", color: "var(--fg)", fontWeight: 600 }}>Round Complete!</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={startBreak} style={{ padding: "10px 24px", background: "var(--accent)", color: "#fff", borderRadius: "9999px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Start Break</button>
                    <button onClick={skipBreak} style={{ padding: "10px 20px", background: "var(--bg-hover)", color: "var(--fg)", borderRadius: "9999px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Skip</button>
                  </div>
                </div>
              ) : (
                <div style={{ position: "relative", width: "240px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="240" height="240" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", overflow: "visible" }}>
                    <defs>
                      <linearGradient id="pomodoroGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--accent)" />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.6" />
                      </linearGradient>
                    </defs>
                    <circle cx="120" cy="120" r="108" fill="none" stroke="var(--border-mid)" strokeWidth="12" opacity={0.3} />
                    <motion.circle
                      cx="120" cy="120" r="108"
                      fill="none"
                      stroke="url(#pomodoroGrad)"
                      strokeWidth="12"
                      strokeDasharray={2 * Math.PI * 108}
                      initial={{ strokeDashoffset: 2 * Math.PI * 108 * (1 - ringProgress) }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 108 * (1 - Math.max(0, Math.min(1, ringProgress))) }}
                      transition={{ duration: 0.5, ease: "linear" }}
                      strokeLinecap="round"
                    />
                  </svg>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                    <span style={{
                      fontSize: "76px",
                      fontWeight: 500,
                      fontFamily: '"SF Pro Display", "Inter", "Helvetica Neue", sans-serif',
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--accent)",
                      lineHeight: 1,
                      letterSpacing: "-0.05em",
                    }}>
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Timer display ───────────────────────────────────────────────────── */}
      {mode === 'timer' && (
        <>
          {/* Header Backdrop Gradient */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: "300px",
            background: "linear-gradient(to bottom, var(--bg-app) 60%, transparent 100%)",
            zIndex: 90,
            pointerEvents: "none"
          }} />

          <div style={{ position: "absolute", top: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "0 16px" }}>

            <div style={{
              borderRadius: "40px",
              padding: "32px 48px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}>
              <span style={{
                fontSize: "88px",
                fontWeight: 400,
                fontFamily: '"SF Pro Display", "Inter", "Helvetica Neue", sans-serif',
                fontVariantNumeric: "tabular-nums",
                color: "var(--accent)",
                lineHeight: 1,
                letterSpacing: "-0.05em"
              }}>
                {formatStopwatch(sessionElapsed)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Main content area ────────────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col relative z-10 transition-all duration-700 ${isSpotlightOn ? 'items-center justify-center overflow-hidden' : 'items-center overflow-y-auto'}`}
        style={{ paddingTop: isSpotlightOn ? 0 : mode === 'pomodoro' ? '300px' : mode === 'timer' ? '250px' : '20vh', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
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
                  const style = getCardStyle(visibleIdx);

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      ref={isActive ? activeCardRef : null}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: isActive ? 1 : 0.4, scale: isActive ? 1 : 0.98, y: 0 }}
                      exit={{ opacity: 0, x: -60, scale: 0.9, transition: { duration: 0.5, ease: "anticipate" } }}
                      transition={{
                        duration: 0.5,
                        ease: [0.33, 1, 0.68, 1] // Custom easeOutQuart
                      }}
                      className="relative w-full rounded-[32px] p-10 md:p-14 mb-4 last:mb-0 transition-all duration-700 shadow-none"
                      style={{ background: style.bg, border: style.border }}
                    >
                      <div className="flex items-center gap-10">
                        <button
                          onClick={() => handleComplete(task.id, originalIdx)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-500"
                          style={{ borderColor: isChecking ? style.fill : 'var(--border-mid)', backgroundColor: isChecking ? style.fill : 'transparent' }}
                        >
                          <Check className={`w-3.5 h-3.5 text-white transition-opacity ${isChecking ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <h2
                            className={`font-medium transition-all duration-500 ${isSpotlightOn ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'} ${isChecking ? 'line-through opacity-50' : ''}`}
                            style={{ color: isChecking ? "var(--fg-muted)" : style.textColor, letterSpacing: "-0.03em" }}
                          >
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

      {/* ── Control pill ─────────────────────────────────────────────────────────── */}
      <div
        ref={pillRef}
        className="absolute bottom-6 md:bottom-12 left-0 right-0 z-[120] pointer-events-none flex flex-col items-center justify-center gap-4 px-4 md:flex-row md:px-6"
        style={{ transform: `translate(${pillOffset.x}px, ${pillOffset.y}px)` }}
      >
        <div
          className="flex items-center gap-1 pointer-events-auto rounded-full px-2 py-2"
          style={{
            background: "var(--bg-card)",
            backdropFilter: "var(--glass-blur-card)",
            WebkitBackdropFilter: "var(--glass-blur-card)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            cursor: isDraggingPill ? "grabbing" : "grab",
          }}
          onPointerDown={handlePillPointerDown}
          onPointerMove={handlePillPointerMove}
          onPointerUp={handlePillPointerUp}
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

          <button onClick={toggleMinimized} className="p-3 rounded-full transition-all focus:outline-none" style={{ color: "var(--fg-faint)" }} title="Minimize to pill">
            <Minimize2 className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <button onClick={prevTask} disabled={currentIndex === 0} className="p-3 disabled:opacity-5 transition-colors focus:outline-none" style={{ color: "var(--fg-faint)" }}>
            <ChevronLeft className="w-6 h-6" strokeWidth={1.2} />
          </button>

          <button
            onClick={() => setIsSpotlightOn(!isSpotlightOn)}
            className="p-3 transition-all rounded-full"
            style={{ color: isSpotlightOn ? "var(--accent)" : "var(--fg)", background: isSpotlightOn ? "var(--accent-bg)" : "transparent" }}
          >
            {isSpotlightOn ? <Eye className="w-6 h-6" strokeWidth={1.5} /> : <EyeOff className="w-6 h-6" strokeWidth={1.5} />}
          </button>

          {(mode === 'pomodoro' || mode === 'timer') && (
            <button onClick={togglePause} className="p-3 focus:outline-none transition-colors" style={{ color: "var(--accent)" }}>
              {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
            </button>
          )}

          <button onClick={nextTask} disabled={currentIndex === playlist.length - 1} className="p-3 disabled:opacity-5 transition-colors focus:outline-none" style={{ color: "var(--fg-faint)" }}>
            <ChevronRight className="w-6 h-6" strokeWidth={1.2} />
          </button>

          <button
            onClick={() => setSetupModalOpen(true)}
            className="p-3 rounded-full transition-all focus:outline-none"
            style={{ color: "var(--fg-faint)" }}
            title="Switch Session Mode"
          >
            <ArrowRightLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <button
            onClick={() => setPanelOpen(true)}
            className="p-3 rounded-full transition-all focus:outline-none"
            style={{ color: "var(--fg-faint)" }}
            title="Manage session playlist"
          >
            <Plus className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <button
          onClick={handleLeave}
          className="pointer-events-auto backdrop-blur-3xl rounded-full transition-all"
          style={{ padding: "16px 40px", background: "var(--accent)", border: "none", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "white", opacity: isVaultLocked ? 0.3 : 1, cursor: isVaultLocked ? "not-allowed" : "pointer", boxShadow: "var(--shadow-float)", flexShrink: 0 }}
        >
          {isVaultLocked ? "Locked" : "Finish"}
        </button>
      </div>

      {/* ── Playlist management panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[200]"
              style={{ background: "rgba(0,0,0,0.50)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelOpen(false)}
            />

            {/* Panel — side drawer on desktop, bottom sheet on mobile */}
            <motion.div
              className="fixed z-[201] flex flex-col"
              style={{
                bottom: 0, right: 0,
                height: "100%",
                width: "100%",
                maxWidth: "580px",
                background: "var(--bg-card)",
                borderLeft: "1px solid var(--border-mid)",
                boxShadow: "var(--shadow-float)",
              }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Panel header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--fg)", textTransform: "uppercase", }}>Session Playlist</span>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--fg-faint)", border: "none", background: "transparent", cursor: "pointer", lineHeight: 0 }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile tabs */}
              <div className="flex md:hidden px-4 pt-3 gap-2" style={{ flexShrink: 0 }}>
                {(['today', 'playlist'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setPanelTab(tab)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                    style={panelTab === tab
                      ? { background: "var(--accent-bg-strong)", color: "var(--accent)" }
                      : { background: "var(--bg-hover)", color: "var(--fg-muted)" }
                    }
                  >
                    {tab === 'today' ? 'Today' : `Playlist (${playlist.length})`}
                  </button>
                ))}
              </div>

              {/* Panel body */}
              <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">

                {/* TODAY column */}
                <div
                  className={`flex flex-col min-h-0 md:flex-1 md:border-r ${panelTab === 'today' ? 'flex' : 'hidden md:flex'}`}
                  style={{ borderColor: "var(--border)" }}
                >
                  <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg)", textTransform: "uppercase", }}>Today</span>
                      <span style={{ fontSize: "10px", color: "var(--fg-faint)", padding: "1px 8px", borderRadius: "9999px", border: "1px solid var(--border)" }}>{todayTasks.length}</span>
                    </div>
                    {/* Quick-add input */}
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        ref={quickAddRef}
                        value={quickAddTitle}
                        onChange={e => setQuickAddTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
                        placeholder="Add a task…"
                        className="flex-1 rounded-xl px-3 py-2 outline-none"
                        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--fg)", fontSize: "14px" }}
                      />
                      <button
                        onClick={handleQuickAdd}
                        disabled={!quickAddTitle.trim()}
                        className="rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-40 transition-all"
                        style={{ background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                    {todayTasks.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center", fontSize: "12px", color: "var(--fg-faint)", opacity: 0.6 }}>No tasks due today</div>
                    ) : (
                      todayTasks.map(task => {
                        const inSession = playlistIds.has(task.id);
                        return (
                          <PanelTodayRow
                            key={task.id}
                            task={task}
                            inSession={inSession}
                            onClick={() => handleTodayTaskClick(task)}
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {/* PLAYLIST column */}
                <div
                  className={`flex flex-col min-h-0 md:flex-1 ${panelTab === 'playlist' ? 'flex' : 'hidden md:flex'}`}
                >
                  <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg)", textTransform: "uppercase", }}>Playlist</span>
                    <span style={{ fontSize: "10px", color: "var(--fg-faint)", padding: "1px 8px", borderRadius: "9999px", border: "1px solid var(--border)" }}>{playlist.length}</span>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                    {playlist.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center", fontSize: "12px", color: "var(--fg-faint)", opacity: 0.6 }}>No tasks in session</div>
                    ) : (
                      playlist.map((task, idx) => {
                        const isActive = idx === currentIndex;
                        const isDone = completedIds.has(task.id);
                        return (
                          <PanelPlaylistRow
                            key={task.id}
                            task={task}
                            isActive={isActive}
                            isDone={isDone}
                            onRemove={() => removeTaskFromPlaylist(task.id)}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Panel sub-components ───────────────────────────────────────────────────────

function PanelTodayRow({ task, inSession, onClick }: { task: Task; inSession: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "9px 12px", borderRadius: "8px",
        background: hovered ? "var(--bg-hover)" : "transparent",
        cursor: "pointer", transition: "background 120ms",
        opacity: inSession ? 0.55 : 1,
      }}
    >
      {/* Checkmark if in session */}
      <div style={{
        width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
        border: inSession ? "1.5px solid var(--accent)" : "1.5px solid var(--border-mid)",
        background: inSession ? "var(--accent-bg)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 150ms",
      }}>
        {inSession && <Check style={{ width: "9px", height: "9px", color: "var(--accent)" }} strokeWidth={3} />}
      </div>
      <span style={{
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontSize: "13px", fontWeight: 500,
        color: inSession ? "var(--fg-muted)" : "var(--fg)",
        textDecoration: inSession ? "line-through" : "none",
      }}>
        {task.title}
      </span>
      {inSession && hovered && (
        <span style={{ fontSize: "10px", color: "var(--accent)", flexShrink: 0 }}>Remove</span>
      )}
      {!inSession && hovered && (
        <Plus style={{ width: "12px", height: "12px", color: "var(--fg-faint)", flexShrink: 0 }} strokeWidth={2.5} />
      )}
    </div>
  );
}

function PanelPlaylistRow({ task, isActive, isDone, onRemove }: { task: Task; isActive: boolean; isDone: boolean; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "9px 12px", borderRadius: "8px",
        background: isActive ? "var(--accent-bg)" : hovered ? "var(--bg-hover)" : "transparent",
        border: isActive ? "1px solid var(--accent)" : "1px solid transparent",
        transition: "all 150ms",
        opacity: isDone ? 0.4 : 1,
      }}
    >
      {/* Active indicator */}
      <div style={{
        width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
        background: isActive ? "var(--accent)" : "transparent",
        transition: "background 150ms",
      }} />
      <span style={{
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontSize: "13px",
        fontWeight: isActive ? 600 : 500,
        color: isActive ? "var(--accent)" : isDone ? "var(--fg-muted)" : "var(--fg)",
        textDecoration: isDone ? "line-through" : "none",
      }}>
        {task.title}
      </span>
      {isActive && (
        <span style={{ fontSize: "10px", color: "var(--accent)", flexShrink: 0, fontWeight: 600 }}>Now</span>
      )}
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        style={{
          padding: "3px", borderRadius: "4px", border: "none",
          background: "transparent", cursor: "pointer", lineHeight: 0,
          color: hovered ? "var(--fg-muted)" : "transparent",
          transition: "all 120ms",
          flexShrink: 0,
        }}
        title="Remove from session"
      >
        <X style={{ width: "12px", height: "12px" }} />
      </button>
    </div>
  );
}