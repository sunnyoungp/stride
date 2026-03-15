"use client";

import { create } from "zustand";

import { db } from "@/db/index";
import type { StrideDocument } from "@/types/index";

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
    const documents = await db.documents.toArray();
    set({ documents });
    void get().cleanOrphanedTaskRefs();
  };

  const createDocument: DocumentStore["createDocument"] = async (title) => {
    const now = new Date().toISOString();
    const doc: StrideDocument = {
      id: crypto.randomUUID(),
      title,
      content: JSON.stringify({ type: "doc", content: [] }),
      linkedTaskIds: [],
      createdAt: now,
      updatedAt: now,
    };

    await db.documents.put(doc);
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
    await db.documents.update(id, { ...changes, updatedAt });
    set({
      documents: get().documents.map((d) =>
        d.id === id ? { ...d, ...changes, updatedAt } : d,
      ),
    });
  };

  const deleteDocument: DocumentStore["deleteDocument"] = async (id) => {
    const doc = await db.documents.get(id);
    if (doc?.linkedTaskIds && doc.linkedTaskIds.length > 0) {
      await db.tasks.bulkDelete(doc.linkedTaskIds);
      // We don't have direct access to TaskStore here without circular imports usually, 
      // but the TaskStore's loadTasks() or reactive state will handle the UI if we're careful.
      // However, we should try to trigger a reload or update in TaskStore if possible.
    }
    await db.documents.delete(id);
    set({ documents: get().documents.filter((d) => d.id !== id) });

    // Trigger task store reload to reflect deleted tasks
    const { useTaskStore } = await import("./taskStore");
    await useTaskStore.getState().loadTasks();
  };

  const cleanOrphanedTaskRefs: DocumentStore["cleanOrphanedTaskRefs"] = async () => {
    const currentDocuments = get().documents;
    const allTasks = await db.tasks.toArray();
    const taskIds = new Set(allTasks.map((t) => t.id));

    for (const doc of currentDocuments) {
      if (!doc.linkedTaskIds) continue;
      const validIds = doc.linkedTaskIds.filter((id) => taskIds.has(id));

      if (validIds.length !== doc.linkedTaskIds.length) {
        await get().updateDocument(doc.id, { linkedTaskIds: validIds });
      }
    }
  };

  void loadDocuments();

  return {
    documents: [],
    loadDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    cleanOrphanedTaskRefs,
  };
});

