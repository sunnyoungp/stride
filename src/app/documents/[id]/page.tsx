import { DocumentPageClient } from "@/components/DocumentPageClient";

export const dynamic = 'force-static'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function Page() {
  return <DocumentPageClient />;
}