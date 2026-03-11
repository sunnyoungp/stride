"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/documentStore";
import { DocumentContextMenu } from "@/components/DocumentContextMenu";
import type { StrideDocument } from "@/types/index";

function formatUpdatedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function DocumentList() {
  const router = useRouter();
  const documents = useDocumentStore((s) => s.documents);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);
  const createDocument = useDocumentStore((s) => s.createDocument);

  const [contextMenu, setContextMenu] = useState<{
    doc: StrideDocument;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const sorted = useMemo(() => {
    return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [documents]);

  const onNew = async () => {
    const doc = await createDocument("Untitled");
    router.push(`/documents/${doc.id}`);
  };

  return (
    <div className="mx-auto h-full w-full max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-100">Documents</h1>
        <button
          type="button"
          onClick={() => void onNew()}
          className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-white/15"
        >
          + New Document
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.length === 0 ? (
          <div className="col-span-full py-16 text-center text-sm text-zinc-500">
            No documents yet. Click + New Document to get started.
          </div>
        ) : (
          sorted.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => router.push(`/documents/${doc.id}`)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  doc,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-900/40 p-5 text-left transition-colors hover:border-white/20 hover:bg-zinc-900/60"
            >
              <div className="line-clamp-2 text-base font-semibold text-zinc-100">
                {doc.title || "Untitled"}
              </div>
              <div className="mt-auto text-xs text-zinc-500">
                Updated {formatUpdatedAt(doc.updatedAt)}
              </div>
            </button>
          ))
        )}
      </div>

      {contextMenu && (
        <DocumentContextMenu
          document={contextMenu.doc}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
