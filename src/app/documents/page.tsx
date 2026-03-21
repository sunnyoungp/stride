"use client";

import { DocumentList } from "@/components/DocumentList";

export default function Page() {
  return (
    <div className="mobile-scroll-content h-full overflow-auto">
      <DocumentList />
    </div>
  );
}
