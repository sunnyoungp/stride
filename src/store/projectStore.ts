"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types/index";

const supabase = createClient();

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function projectFromRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? undefined,
    status: row.status as Project["status"],
    taskIds: (row.task_ids as string[]) ?? [],
    documentIds: (row.document_ids as string[]) ?? [],
    color: (row.color as string | null) ?? undefined,
  };
}

function projectToRow(p: Project, userId: string) {
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    status: p.status,
    task_ids: p.taskIds,
    document_ids: p.documentIds,
    color: p.color ?? null,
    user_id: userId,
  };
}

// ── Store ──────────────────────────────────────────────────────────────────────

type ProjectStore = {
  projects: Project[];
  loadProjects: () => Promise<void>;
  createProject: (title: string) => Promise<Project>;
  updateProject: (id: string, changes: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
};

const defaultProjects = ["Stride", "Client Project"];

export const useProjectStore = create<ProjectStore>((set, get) => {
  const loadProjects: ProjectStore["loadProjects"] = async () => {
    try {
      const { data: rows, error } = await supabase.from("projects").select("*");
      if (error) throw error;

      if (rows && rows.length > 0) {
        set({ projects: rows.map(projectFromRow) });
        return;
      }

      // Seed defaults for this user
      const userId = await getUserId();
      if (!userId) return;

      const seeded: Project[] = defaultProjects.map((title) => ({
        id: crypto.randomUUID(),
        title,
        status: "active",
        taskIds: [],
        documentIds: [],
      }));
      const { error: insertError } = await supabase
        .from("projects")
        .insert(seeded.map((p) => projectToRow(p, userId)));
      if (insertError) console.error("Failed to seed projects:", insertError);
      set({ projects: seeded });
    } catch (error) {
      console.error("Failed to load projects:", error);
      set({ projects: [] });
    }
  };

  const createProject: ProjectStore["createProject"] = async (title) => {
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");
    const project: Project = {
      id: crypto.randomUUID(),
      title,
      status: "active",
      taskIds: [],
      documentIds: [],
    };
    const { error } = await supabase.from("projects").insert(projectToRow(project, userId));
    if (error) console.error("Failed to create project:", error);
    set({ projects: [...get().projects, project] });
    return project;
  };

  const updateProject: ProjectStore["updateProject"] = async (id, changes) => {
    const row: Record<string, unknown> = {};
    if ("title" in changes) row.title = changes.title;
    if ("description" in changes) row.description = changes.description ?? null;
    if ("status" in changes) row.status = changes.status;
    if ("taskIds" in changes) row.task_ids = changes.taskIds;
    if ("documentIds" in changes) row.document_ids = changes.documentIds;
    if ("color" in changes) row.color = changes.color ?? null;
    const { error } = await supabase.from("projects").update(row).eq("id", id);
    if (error) console.error("Failed to update project:", error);
    set({ projects: get().projects.map((p) => (p.id === id ? { ...p, ...changes } : p)) });
  };

  const deleteProject: ProjectStore["deleteProject"] = async (id) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) console.error("Failed to delete project:", error);
    set({ projects: get().projects.filter((p) => p.id !== id) });
  };

  if (typeof window !== "undefined") void loadProjects();

  return {
    projects: [],
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
  };
});
