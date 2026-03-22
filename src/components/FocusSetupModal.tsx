"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Zap, Timer, Lock, Plus, GripVertical, Minus, Check } from "lucide-react";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import { useFocusStore, FocusMode } from "@/store/focusStore";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types/index";

export function FocusSetupModal() {
  const { isSetupModalOpen, setSetupModalOpen, startFocusSession } = useFocusStore();
  const allTasks = useTaskStore((state) => state.tasks);

  const [selectedMode, setSelectedMode] = useState<FocusMode>("tunnel");
  const [playlist, setPlaylist] = useState<Task[]>([]);

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
    startFocusSession(selectedMode, playlist, allTasks, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onClick={() => setSetupModalOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "768px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
          animation: "gs-scale 200ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <h2 style={{
            fontSize: "12px", fontWeight: 700, color: "var(--fg)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Setup Focus</h2>
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
              fontSize: "10px", fontWeight: 700, color: "var(--fg-faint)",
              textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px",
            }}>Session Mode</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
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

          {/* Playlist */}
          <section style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: "350px" }}>
            <h3 style={{
              fontSize: "10px", fontWeight: 700, color: "var(--fg-faint)",
              textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px",
            }}>Playlist Configuration</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flex: 1, minHeight: 0 }}>

              {/* Available tasks */}
              <div style={{
                display: "flex", flexDirection: "column",
                background: "var(--bg-subtle)", borderRadius: "12px",
                border: "1px solid var(--border)", overflow: "hidden",
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
              <div style={{
                display: "flex", flexDirection: "column", borderRadius: "12px",
                border: `1px ${playlist.length === 0 ? "dashed" : "solid"} var(--border)`,
                background: playlist.length === 0 ? "transparent" : "var(--bg-subtle)",
                flex: 1, minHeight: 0,
                opacity: playlist.length === 0 ? 0.6 : 1,
                transition: "all 300ms ease",
                overflow: "hidden",
              }}>
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
        </div>

        {/* Footer */}
        <div style={{
          padding: "20px 32px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-card)",
          flexShrink: 0,
        }}>
          <button
            onClick={handleStart}
            disabled={playlist.length === 0}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: playlist.length === 0 ? "not-allowed" : "pointer",
              opacity: playlist.length === 0 ? 0.35 : 1,
              transition: "opacity 150ms",
            }}
          >
            Start Session →
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
        border: isSelected ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
        background: isSelected ? "var(--accent-bg)" : "var(--bg-card)",
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
        color: "var(--fg-faint)",
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
        fontSize: "13px", fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.01em",
      }}>
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
          letterSpacing: "-0.01em", cursor: "pointer",
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
