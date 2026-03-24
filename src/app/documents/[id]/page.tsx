import { DocumentEditor } from "@/components/DocumentEditor";

export const dynamic = 'force-static'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = (await params);
  return <DocumentEditor documentId={id} />;
}