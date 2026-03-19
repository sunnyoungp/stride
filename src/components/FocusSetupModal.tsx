"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Zap, Timer, Lock, Plus, GripVertical, Minus, Check } from "lucide-react";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import { useFocusStore, FocusMode } from "@/store/focusStore";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types/index";

export function FocusSetupModal() {
  const { isSetupModalOpen, setSetupModalOpen, startFocusSession } = useFocusStore();
  const tasks = useTaskStore((state) => state.tasks);
  
  const [selectedMode, setSelectedMode] = useState<FocusMode>("tunnel");
  const [playlist, setPlaylist] = useState<Task[]>([]);

  // Filtering: Only incomplete tasks due today (no timezone ambiguity)
  const eligibleTasks = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return tasks.filter(t => {
      const isCompleted = t.status === "done" || t.status === "cancelled";
      if (isCompleted) return false;
      return t.dueDate && t.dueDate.startsWith(todayStr);
    });
  }, [tasks]);

  const availableTasks = useMemo(() => {
    const playlistIds = new Set(playlist.map(t => t.id));
    return eligibleTasks.filter(t => !playlistIds.has(t.id));
  }, [eligibleTasks, playlist]);

  useEffect(() => {
    if (!isSetupModalOpen) {
      setPlaylist([]);
    }
  }, [isSetupModalOpen]);

  if (!isSetupModalOpen) return null;

  const handleAddToPlaylist = (task: Task) => {
    setPlaylist(prev => [...prev, task]);
  };

  const handleRemoveFromPlaylist = (task: Task) => {
    setPlaylist(prev => prev.filter(t => t.id !== task.id));
  };

  const handleStart = () => {
    if (playlist.length === 0) return;
    startFocusSession(selectedMode, playlist, 1500); // 25 min default
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12 bg-zinc-950/20 dark:bg-black/40 backdrop-blur-lg"
      onClick={() => setSetupModalOpen(false)}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header: OS-style header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Setup Focus</h2>
          <button 
            onClick={() => setSetupModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 space-y-10 min-h-0">
          
          {/* Mode Selection */}
          <section className="shrink-0">
            <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mb-5 uppercase tracking-[0.1em]">Session Mode</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ModeCard 
                title="Tunnel" 
                description="The pure essentials only." 
                icon={<Zap className="w-5 h-5" />}
                isSelected={selectedMode === "tunnel"}
                onClick={() => setSelectedMode("tunnel")}
              />
              <ModeCard 
                title="Timer" 
                description="Timed deep work blocks." 
                icon={<Timer className="w-5 h-5" />}
                isSelected={selectedMode === "timer"}
                onClick={() => setSelectedMode("timer")}
              />
              <ModeCard 
                title="Vault" 
                description="Manage your whole list." 
                icon={<Lock className="w-5 h-5" />}
                isSelected={selectedMode === "vault"}
                onClick={() => setSelectedMode("vault")}
              />
            </div>
          </section>

          {/* Task Selection */}
          <section className="flex flex-col flex-1 min-h-[350px]">
            <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mb-5 uppercase tracking-[0.1em]">Playlist Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
              
              {/* === Available Tasks === */}
              <div className="flex flex-col bg-zinc-50/20 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-300">TODAY</span>
                  <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500">{availableTasks.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  <AnimatePresence initial={false}>
                    {availableTasks.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-6 text-zinc-400 text-xs text-center py-20 grayscale opacity-50">
                        No tasks left for today.
                      </div>
                    ) : (
                      availableTasks.map(task => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          key={task.id}
                          onClick={() => handleAddToPlaylist(task)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer group transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" strokeWidth={2.5} />
                          <span className="flex-1 truncate text-zinc-800 dark:text-zinc-300 text-[13px] font-medium tracking-tight">
                            {task.title}
                          </span>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* === Selected Playlist === */}
              <div className={`flex flex-col rounded-xl border transition-all duration-300 flex-1 min-h-0 ${
                playlist.length === 0 
                  ? 'border-dashed border-zinc-200 dark:border-zinc-800 opacity-60' 
                  : 'bg-zinc-50/20 dark:bg-zinc-800/10 border-zinc-100 dark:border-zinc-800'
              }`}>
                <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
                   <span className="text-xs font-bold text-zinc-900 dark:text-zinc-300">PLAYLIST</span>
                   <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full text-zinc-600 dark:text-zinc-400 font-bold">{playlist.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  <AnimatePresence initial={false}>
                    {playlist.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-10 text-center text-zinc-400">
                        <p className="text-[12px] font-medium opacity-60">Ready for Focus</p>
                      </div>
                    ) : (
                      <Reorder.Group axis="y" values={playlist} onReorder={setPlaylist} className="space-y-1">
                        <AnimatePresence initial={false}>
                          {playlist.map(task => (
                            <Reorder.Item 
                              key={task.id} 
                              value={task}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/50 shadow-sm cursor-grab active:cursor-grabbing group hover:border-[#E05252]/20 transition-all"
                            >
                              <GripVertical className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 shrink-0" strokeWidth={1.5} />
                              <div 
                                onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(task); }}
                                className="flex-1 truncate text-zinc-900 dark:text-zinc-100 font-semibold text-[13px] tracking-tight cursor-pointer"
                              >
                                {task.title}
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(task); }}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-[#E05252] dark:hover:text-red-400 transition-colors shrink-0"
                              >
                                <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                              </button>
                            </Reorder.Item>
                          ))}
                        </AnimatePresence>
                      </Reorder.Group>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <button 
            onClick={handleStart}
            disabled={playlist.length === 0}
            className="w-full py-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed rounded-lg font-bold text-sm tracking-tight transition-all active:scale-[0.99]"
          >
            Start Session
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ModeCard({ title, description, icon, isSelected, onClick }: { 
  title: string, description: string, icon: React.ReactNode, isSelected: boolean, onClick: () => void 
}) {
  return (
    <div 
      onClick={onClick}
      className={`relative p-5 rounded-xl cursor-pointer border transition-all duration-200 ${
        isSelected 
          ? 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-900 dark:border-zinc-100' 
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
      }`}
    >
      <div className={`mb-3 transition-colors ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>
        {icon}
      </div>
      <h4 className={`text-[13px] font-bold mb-0.5 transition-colors ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-800 dark:text-zinc-400'}`}>
        {title}
      </h4>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight font-medium">
        {description}
      </p>
      {isSelected && (
        <div className="absolute top-4 right-4 text-zinc-900 dark:text-zinc-100">
           <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}
