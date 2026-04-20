"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentList } from "@/components/DocumentList";
import { DocumentEditor } from "@/components/DocumentEditor";

function DocumentsContent() {
  const params = useSearchParams();
  const docId = params.get("id");

  if (docId) {
    return (
      <div className="mobile-scroll-content h-full overflow-auto">
        <DocumentEditor documentId={docId} />
      </div>
    );
  }

  return (
    <div className="mobile-scroll-content h-full overflow-auto">
      <DocumentList />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 32, fontSize: 13, color: "var(--fg-muted)" }}>Loading…</div>}>
      <DocumentsContent />
    </Suspense>
  );
}
