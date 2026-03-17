"use client";

import { create } from "zustand";
import { db } from "@/db/index";
import type { Project } from "@/types/index";

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
    const existing = await db.projects.toArray();
    if (existing.length > 0) {
      set({ projects: existing });
      return;
    }

    const seeded: Project[] = defaultProjects.map((title) => ({
      id: crypto.randomUUID(),
      title,
      status: "active",
      taskIds: [],
      documentIds: [],
    }));
    await db.projects.bulkPut(seeded);
    set({ projects: seeded });
  };

  const createProject: ProjectStore["createProject"] = async (title) => {
    const project: Project = {
      id: crypto.randomUUID(),
      title,
      status: "active",
      taskIds: [],
      documentIds: [],
    };
    await db.projects.put(project);
    set({ projects: [...get().projects, project] });
    return project;
  };

  const updateProject: ProjectStore["updateProject"] = async (id, changes) => {
    await db.projects.update(id, changes);
    set({
      projects: get().projects.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    });
  };

  const deleteProject: ProjectStore["deleteProject"] = async (id) => {
    await db.projects.delete(id);
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
