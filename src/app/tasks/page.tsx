"use client";

import { Suspense, useState } from "react";
import { useTaskStore } from "@/store/taskStore";
import { TaskListView } from "@/components/TaskListView";
import { TaskDetailModal } from "@/components/TaskDetailModal";

export default function Page() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const tasks = useTaskStore((s) => s.tasks);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Page header */}
        <div
          className="sticky top-0 z-10 flex-none flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
        >
          <h1 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Tasks</h1>
        </div>
        <Suspense fallback={
          <div className="p-8 text-sm" style={{ color: "var(--fg-muted)" }}>Loading tasks…</div>
        }>
          <TaskListView onTaskClick={(task, pos) => { setSelectedTaskId(task.id); setClickPos(pos); }} />
        </Suspense>
      </div>
      {selectedTask && (
        <TaskDetailModal task={selectedTask} position={clickPos} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
}
