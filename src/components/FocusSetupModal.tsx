"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Zap, Timer, Lock, Plus, GripVertical, Minus, Check, Watch } from "lucide-react";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import { useFocusStore, FocusMode } from "@/store/focusStore";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types/index";

export function FocusSetupModal({ isSwitching = false }: { isSwitching?: boolean } = {}) {
  const { isSetupModalOpen, setSetupModalOpen, startFocusSession, focusState, switchMode } = useFocusStore();
  const allTasks = useTaskStore((state) => state.tasks);

  const effectiveIsSwitching = isSwitching || focusState.isActive;

  const [selectedMode, setSelectedMode] = useState<FocusMode>("tunnel");
  const [playlist, setPlaylist] = useState<Task[]>([]);
  const [autoFlow, setAutoFlow] = useState(false);

  const eligibleTasks = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return allTasks.filter(t => {
      const isCompleted = t.status === "done" || t.status === "cancelled";
      if (isCompleted) return false;
      return t.dueDate && t.dueDate.startsWith(todayStr);
    });
  }, [allTasks]);

  const availableTasks = useMemo(() => {
    const playlistIds = new Set(playlist.map(t => t.id));
    return eligibleTasks.filter(t => !playlistIds.has(t.id));
  }, [eligibleTasks, playlist]);

  // When modal opens, pre-populate from active session (playlist persistence across mode switches)
  useEffect(() => {
    if (isSetupModalOpen) {
      if (focusState.isActive && focusState.playlist.length > 0) {
        setPlaylist(focusState.playlist);
        setSelectedMode(focusState.mode ?? "tunnel");
        setAutoFlow(focusState.autoFlow);
      }
    } else {
      setPlaylist([]);
      setAutoFlow(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const duration = selectedMode === 'timer' ? 0 : 1500;
    startFocusSession(selectedMode, playlist, allTasks, duration, autoFlow);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-12"
      style={{ background: "rgba(0,0,0,0.68)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      onClick={() => setSetupModalOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "768px",
          background: "var(--bg)",
          border: "1px solid var(--border-mid)",
          borderRadius: "20px",
          boxShadow: "var(--shadow-float)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-mid)",
          flexShrink: 0,
        }}>
          <h2 style={{
            fontSize: "12px", fontWeight: 700, color: "var(--fg)",
            textTransform: "uppercase", }}>Setup Focus</h2>
          <button
            onClick={() => setSetupModalOpen(false)}
            style={{
              padding: "6px", borderRadius: "8px", border: "none",
              background: "transparent", color: "var(--fg-faint)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 150ms, color 150ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--fg)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-faint)"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Mode selection */}
          <section>
            <h3 style={{
              fontSize: "10px", fontWeight: 700, color: "var(--fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "16px",
            }}>Session Mode</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ModeCard
                title="Flow"
                description="Pure focus, no distractions."
                icon={<Zap className="w-5 h-5" />}
                isSelected={selectedMode === "tunnel"}
                onClick={() => setSelectedMode("tunnel")}
              />
              <ModeCard
                title="Pomodoro"
                description="Timed work and break intervals."
                icon={<Timer className="w-5 h-5" />}
                isSelected={selectedMode === "pomodoro"}
                onClick={() => setSelectedMode("pomodoro")}
              />
              <ModeCard
                title="Timer"
                description="Count up, no time limit."
                icon={<Watch className="w-5 h-5" />}
                isSelected={selectedMode === "timer"}
                onClick={() => setSelectedMode("timer")}
              />
              {/* Vault — not yet developed, re-enable when ready 
              <ModeCard
                title="Vault"
                description="Manage your whole list."
                icon={<Lock className="w-5 h-5" />}
                isSelected={selectedMode === "vault"}
                onClick={() => setSelectedMode("vault")}
              />
              */}
            </div>

            {/* Pomodoro-only: Auto-flow toggle */}
            {selectedMode === "pomodoro" && (
              <div style={{
                marginTop: "12px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: "10px",
                background: "var(--bg-subtle)", border: "1px solid var(--border)",
              }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--fg)" }}>Auto-flow</div>
                  <div style={{ fontSize: "11px", color: "var(--fg-muted)", marginTop: "2px" }}>
                    Cycle through work and breaks automatically without prompts
                  </div>
                </div>
                <button
                  onClick={() => setAutoFlow(v => !v)}
                  style={{
                    position: "relative",
                    width: "40px", height: "22px",
                    borderRadius: "9999px",
                    border: "none",
                    background: autoFlow ? "var(--accent)" : "var(--border-strong)",
                    cursor: "pointer",
                    transition: "background 200ms",
                    flexShrink: 0,
                    marginLeft: "16px",
                  }}
                  aria-label="Toggle auto-flow"
                >
                  <span style={{
                    position: "absolute",
                    top: "2px",
                    left: autoFlow ? "20px" : "2px",
                    width: "18px", height: "18px",
                    borderRadius: "50%",
                    background: "white",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    transition: "left 200ms",
                    display: "block",
                  }} />
                </button>
              </div>
            )}
          </section>

          {/* Playlist */}
          {!effectiveIsSwitching && (
            <section style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: "350px" }}>
              <h3 style={{
                fontSize: "10px", fontWeight: 700, color: "var(--fg-muted)",
                textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "16px",
              }}>Playlist Configuration</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flex: 1, minHeight: 0 }}>

              {/* Available tasks */}
              <div style={{
                display: "flex", flexDirection: "column",
                background: "var(--bg-subtle)", borderRadius: "12px",
                border: "1px solid var(--border-mid)", overflow: "hidden",
              }}>
                <div style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg)" }}>TODAY</span>
                  <span style={{
                    fontSize: "10px", background: "var(--bg-subtle)", border: "1px solid var(--border)",
                    padding: "1px 8px", borderRadius: "9999px", color: "var(--fg-faint)",
                  }}>{availableTasks.length}</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                  <AnimatePresence initial={false}>
                    {availableTasks.length === 0 ? (
                      <div style={{
                        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "48px 16px", fontSize: "12px", color: "var(--fg-faint)",
                        textAlign: "center", opacity: 0.5,
                      }}>
                        No tasks left for today.
                      </div>
                    ) : availableTasks.map(task => (
                      <AvailableTaskRow key={task.id} task={task} onClick={() => handleAddToPlaylist(task)} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Playlist */}
              <div
                className="flex flex-col rounded-xl overflow-hidden"
                style={{
                  border: `1.5px ${playlist.length === 0 ? "dashed" : "solid"} ${playlist.length === 0 ? "var(--border-mid)" : "var(--border-mid)"}`,
                  background: playlist.length === 0 ? "transparent" : "var(--bg-subtle)",
                  flex: 1, minHeight: 0,
                  opacity: playlist.length === 0 ? 0.6 : 1,
                  transition: "all 300ms ease",
                }}
              >
                <div style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg)" }}>PLAYLIST</span>
                  <span style={{
                    fontSize: "10px", fontWeight: 700, background: "var(--bg-subtle)", border: "1px solid var(--border)",
                    padding: "1px 8px", borderRadius: "9999px", color: "var(--fg-faint)",
                  }}>{playlist.length}</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                  <AnimatePresence initial={false}>
                    {playlist.length === 0 ? (
                      <div style={{
                        height: "100%", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        padding: "40px 16px", textAlign: "center",
                      }}>
                        <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--fg-faint)", opacity: 0.6 }}>
                          Ready for Focus
                        </p>
                      </div>
                    ) : (
                      <Reorder.Group axis="y" values={playlist} onReorder={setPlaylist} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <AnimatePresence initial={false}>
                          {playlist.map(task => (
                            <PlaylistItemRow
                              key={task.id}
                              task={task}
                              onRemove={() => handleRemoveFromPlaylist(task)}
                            />
                          ))}
                        </AnimatePresence>
                      </Reorder.Group>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </div>
          </section>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "20px 32px",
          borderTop: "1px solid var(--border-mid)",
          background: "var(--bg)",
          flexShrink: 0,
        }}>
          <button
            onClick={effectiveIsSwitching ? () => switchMode(selectedMode) : handleStart}
            disabled={!effectiveIsSwitching && playlist.length === 0}
            className="w-full active:scale-[0.98] transition-all"
            style={{
              padding: "16px 20px",
              borderRadius: "14px",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              cursor: (!effectiveIsSwitching && playlist.length === 0) ? "not-allowed" : "pointer",
              opacity: (!effectiveIsSwitching && playlist.length === 0) ? 0.35 : 1,
              touchAction: "manipulation",
            }}
          >
            {effectiveIsSwitching ? "Switch Mode" : "Start Session →"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ModeCard({ title, description, icon, isSelected, onClick }: {
  title: string; description: string; icon: React.ReactNode; isSelected: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        padding: "20px",
        borderRadius: "14px",
        cursor: "pointer",
        border: isSelected ? "1.5px solid var(--accent)" : "1.5px solid var(--border-mid)",
        background: isSelected ? "var(--accent-bg)" : "var(--bg-subtle)",
        transition: "all 150ms ease",
      }}
    >
      <div style={{
        marginBottom: "10px",
        color: isSelected ? "var(--accent)" : "var(--fg-faint)",
        transition: "color 150ms",
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--fg)",
        marginBottom: "3px",
      }}>{title}</div>
      <div style={{
        fontSize: "11px",
        color: "var(--fg-muted)",
        lineHeight: 1.4,
      }}>{description}</div>
      {isSelected && (
        <div style={{
          position: "absolute",
          top: "14px",
          right: "14px",
          color: "var(--accent)",
        }}>
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

function AvailableTaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 12px", borderRadius: "8px",
        background: hovered ? "var(--bg-hover)" : "transparent",
        cursor: "pointer", transition: "background 120ms ease",
      }}
    >
      <Plus className="w-3.5 h-3.5 shrink-0" style={{ color: hovered ? "var(--fg)" : "var(--fg-faint)" }} strokeWidth={2.5} />
      <span style={{
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontSize: "13px", fontWeight: 500, color: "var(--fg)", }}>
        {task.title}
      </span>
    </motion.div>
  );
}

function PlaylistItemRow({ task, onRemove }: { task: Task; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Reorder.Item
      value={task}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 12px", borderRadius: "8px",
        background: "var(--bg-card)",
        border: `1px solid ${hovered ? "var(--accent)" : "var(--border)"}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        cursor: "grab",
        transition: "border-color 150ms ease",
        listStyle: "none",
      }}
    >
      <GripVertical
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: hovered ? "var(--fg-faint)" : "var(--border)" }}
        strokeWidth={1.5}
      />
      <div
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontSize: "13px", fontWeight: 600, color: "var(--fg)",
          cursor: "pointer",
        }}
      >
        {task.title}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          padding: "4px", borderRadius: "6px", border: "none",
          background: "transparent", color: "var(--fg-faint)",
          cursor: "pointer", display: "flex", flexShrink: 0,
          transition: "background 120ms, color 120ms",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,82,82,0.08)"; e.currentTarget.style.color = "var(--accent)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-faint)"; }}
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
    </Reorder.Item>
  );
}
