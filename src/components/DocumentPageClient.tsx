"use client";

import { useParams } from "next/navigation";
import { DocumentEditor } from "@/components/DocumentEditor";

export function DocumentPageClient() {
  const params = useParams<{ id: string }>();
  return <DocumentEditor documentId={params.id ?? ""} />;
}
