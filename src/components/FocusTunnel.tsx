"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useFocusStore } from "@/store/focusStore";
import { useTaskStore } from "@/store/taskStore";
import { X, Check, ChevronRight, ChevronLeft, Pause, Play, Eye, EyeOff, RotateCcw } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { Task } from "@/types/index";

// Matte Gallery Palette Logic
const getMatteStyle = (index: number) => {
  // Odd-Indexed (0, 2, 4...) -> White
  if (index % 2 === 0) {
    return {
      bg: "bg-white",
      text: "text-zinc-900",
      fill: "#E05252",
    };
  }

  // Even-Indexed (1, 3, 5...) -> Cycling Matte
  const cycleIndex = (Math.floor(index / 2)) % 3;
  switch (cycleIndex) {
    case 0: return { bg: "bg-[#E8F5E9]", text: "text-green-900", fill: "#1b4332" }; // Muted Sage
    case 1: return { bg: "bg-[#F3E5F5]", text: "text-purple-900", fill: "#4a148c" }; // Muted Lavender
    case 2: return { bg: "bg-[#FFEBEE]", text: "text-rose-900", fill: "#880e4f" };    // Muted Rose
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
  
  // Logic State
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [lastDoneTask, setLastDoneTask] = useState<{ task: Task, index: number } | null>(null);
  const [hasDoneAnything, setHasDoneAnything] = useState(false);

  // Auto-scroll logic
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

  if (!currentTask) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#F2F2F7]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <h1 className="text-xl font-bold text-zinc-400 mb-8 uppercase tracking-[0.2em]">All Tasks Clear</h1>
            <button onClick={handleLeave} className="px-12 py-4 bg-zinc-900 text-white rounded-full font-bold shadow-sm">Return</button>
        </motion.div>
      </div>
    );
  }

  const sessionTotalTime = duration || 1500;
  const timerProgress = (timeRemaining / sessionTotalTime) * 100;
  const isVaultLocked = mode === "vault" && sessionElapsed < 300;

  return (
    <div className="relative flex flex-col h-screen w-screen bg-[#F2F2F7] transition-colors duration-1000">
      
      {/* 5. HUD: ESC TO EXIT */}
      <div className="absolute top-10 right-10 z-[100] pointer-events-none">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] opacity-60">Esc to exit</span>
      </div>

      {/* 2. Timer: Refined top center circular progress */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[70]">
        {mode === 'timer' && (
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#E5E7EB" strokeWidth="1" />
              <motion.circle
                cx="40" cy="40" r="36" fill="none" stroke="#E05252" strokeWidth="1.5"
                strokeDasharray="226.2"
                animate={{ strokeDashoffset: 226.2 * (1 - timerProgress / 100) }}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[13px] font-bold font-mono text-zinc-900 tracking-tight">{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      {/* 2. Main content area with horizontal & vertical centering depends on view */}
      <div className={`flex-1 flex flex-col transition-all duration-700
        ${isSpotlightOn ? 'items-center justify-center overflow-hidden' : 'items-center pt-[20vh] overflow-y-auto'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* scrollbar-hide equivalent for cross-browser */}
        <style dangerouslySetInnerHTML={{ __html: `
          .flex-1::-webkit-scrollbar { display: none; }
        `}} />

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
                      className={`relative w-full ${style.bg} border border-zinc-200/50 rounded-[32px] p-10 md:p-12 mb-4 last:mb-0 transition-all duration-700 shadow-none`}
                    >
                      <div className="flex items-center gap-10">
                         <button
                            onClick={() => handleComplete(task.id, originalIdx)}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-500`}
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

      {/* 4. Control Pill: Simplified Icon-Only bar */}
      <div className="absolute bottom-12 left-0 right-0 z-[120] pointer-events-none flex items-center justify-center gap-4 px-6">
        <div className="flex items-center gap-1 pointer-events-auto backdrop-blur-3xl bg-white/70 border border-white/50 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1)] rounded-full px-2 py-2">
          
          <AnimatePresence>
            {hasDoneAnything && (
              <motion.button 
                initial={{ width: 0, opacity: 0 }} 
                animate={{ width: "auto", opacity: 1, marginRight: 8 }} 
                onClick={handleUndo}
                className="p-3 text-zinc-900 hover:bg-zinc-50 rounded-full transition-all focus:outline-none"
                title="Undo completion"
              >
                <RotateCcw className="w-5 h-5 focus:outline-none" strokeWidth={1.5} />
              </motion.button>
            )}
          </AnimatePresence>

          <button 
            onClick={prevTask} 
            disabled={currentIndex === 0}
            className="p-3 text-zinc-400 hover:text-zinc-900 disabled:opacity-5 transition-colors focus:outline-none"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={1.2} />
          </button>

          <button 
            onClick={() => setIsSpotlightOn(!isSpotlightOn)}
            className={`p-3 transition-all rounded-full ${isSpotlightOn ? 'text-[#E05252] bg-red-50' : 'text-zinc-400 hover:text-zinc-900'}`}
          >
            {isSpotlightOn ? <Eye className="w-6 h-6" strokeWidth={1.2} /> : <EyeOff className="w-6 h-6" strokeWidth={1.2} />}
          </button>

          {mode === 'timer' && (
            <button onClick={togglePause} className="p-3 text-[#E05252] focus:outline-none">
              {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
            </button>
          )}

          <button 
            onClick={nextTask} 
            disabled={currentIndex === playlist.length - 1}
            className="p-3 text-zinc-400 hover:text-zinc-900 disabled:opacity-5 transition-colors focus:outline-none"
          >
            <ChevronRight className="w-6 h-6" strokeWidth={1.2} />
          </button>
        </div>

        <button 
          onClick={handleLeave}
          className={`pointer-events-auto backdrop-blur-3xl bg-white/70 px-10 py-4 rounded-full border border-white shadow-sm text-[10px] font-black uppercase tracking-[0.3em] transition-all
            ${isVaultLocked ? 'opacity-20 text-zinc-300' : 'text-zinc-400 hover:text-red-500'}`}
        >
          {isVaultLocked ? `Locked` : 'Leave'}
        </button>
      </div>

    </div>
  );
}
