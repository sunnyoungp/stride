"use client";

import { use } from "react";
import { DocumentEditor } from "@/components/DocumentEditor";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DocumentEditor documentId={id} />;
}
