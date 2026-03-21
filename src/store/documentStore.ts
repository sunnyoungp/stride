"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { StrideDocument } from "@/types/index";

const supabase = createClient();

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function documentFromRow(row: Record<string, unknown>): StrideDocument {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    projectId: (row.project_id as string | null) ?? undefined,
    linkedTaskIds: (row.linked_task_ids as string[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function documentToRow(d: StrideDocument, userId: string) {
  return {
    id: d.id,
    title: d.title,
    content: d.content,
    project_id: d.projectId ?? null,
    linked_task_ids: d.linkedTaskIds,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    user_id: userId,
  };
}

// ── Store ──────────────────────────────────────────────────────────────────────

type DocumentStore = {
  documents: StrideDocument[];
  loadDocuments: () => Promise<void>;
  createDocument: (title: string) => Promise<StrideDocument>;
  updateDocument: (id: string, changes: Partial<StrideDocument>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  cleanOrphanedTaskRefs: () => Promise<void>;
};

export const useDocumentStore = create<DocumentStore>((set, get) => {
  const loadDocuments: DocumentStore["loadDocuments"] = async () => {
    try {
      const { data: rows, error } = await supabase.from("documents").select("*");
      if (error) throw error;
      set({ documents: (rows ?? []).map(documentFromRow) });
      void get().cleanOrphanedTaskRefs();
    } catch (error) {
      console.error("Failed to load documents:", error);
      set({ documents: [] });
    }
  };

  const createDocument: DocumentStore["createDocument"] = async (title) => {
    const userId = await getUserId();
    if (!userId) throw new Error("Not authenticated");
    const now = new Date().toISOString();
    const doc: StrideDocument = {
      id: crypto.randomUUID(),
      title,
      content: JSON.stringify({ type: "doc", content: [] }),
      linkedTaskIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const { error } = await supabase.from("documents").insert(documentToRow(doc, userId));
    if (error) console.error("Failed to create document:", error);
    set({ documents: [...get().documents, doc] });
    return doc;
  };

  const updateDocument: DocumentStore["updateDocument"] = async (id, changes) => {
    // Guard against corrupted or empty content updates
    if (Object.prototype.hasOwnProperty.call(changes, "content")) {
      if (!changes.content || changes.content === "" || changes.content === "null") {
        console.warn(`Blocked attempt to overwrite document ${id} with empty content.`);
        delete changes.content;
      }
    }
    if (Object.keys(changes).length === 0) return;

    const updatedAt = new Date().toISOString();
    const row: Record<string, unknown> = { updated_at: updatedAt };
    if ("title" in changes) row.title = changes.title;
    if ("content" in changes) row.content = changes.content;
    if ("projectId" in changes) row.project_id = changes.projectId ?? null;
    if ("linkedTaskIds" in changes) row.linked_task_ids = changes.linkedTaskIds;

    const { error } = await supabase.from("documents").update(row).eq("id", id);
    if (error) console.error("Failed to update document:", error);
    set({
      documents: get().documents.map((d) =>
        d.id === id ? { ...d, ...changes, updatedAt } : d,
      ),
    });
  };

  const deleteDocument: DocumentStore["deleteDocument"] = async (id) => {
    const doc = get().documents.find((d) => d.id === id);
    if (doc?.linkedTaskIds && doc.linkedTaskIds.length > 0) {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .in("id", doc.linkedTaskIds);
      if (error) console.error("Failed to delete linked tasks:", error);
    }
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) console.error("Failed to delete document:", error);
    set({ documents: get().documents.filter((d) => d.id !== id) });

    const { useTaskStore } = await import("./taskStore");
    await useTaskStore.getState().loadTasks();
  };

  const cleanOrphanedTaskRefs: DocumentStore["cleanOrphanedTaskRefs"] = async () => {
    const currentDocuments = get().documents;
    const { data: taskRows } = await supabase.from("tasks").select("id");
    const taskIds = new Set((taskRows ?? []).map((t: Record<string, unknown>) => t.id as string));

    for (const doc of currentDocuments) {
      if (!doc.linkedTaskIds) continue;
      const validIds = doc.linkedTaskIds.filter((id) => taskIds.has(id));
      if (validIds.length !== doc.linkedTaskIds.length) {
        await get().updateDocument(doc.id, { linkedTaskIds: validIds });
      }
    }
  };

  if (typeof window !== "undefined") void loadDocuments();

  return {
    documents: [],
    loadDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    cleanOrphanedTaskRefs,
  };
});
