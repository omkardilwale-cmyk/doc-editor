import type { Metadata } from "next";
import { PdfEditor } from "@/components/pdf/PdfEditor";
import { ToolChrome } from "@/components/layout/ToolChrome";

export const metadata: Metadata = {
  title: "PDF Editor — Doc Editor",
  description:
    "Upload, edit existing PDF text, add annotations, and download your document.",
};

interface PdfEditorPageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function PdfEditorPage({ searchParams }: PdfEditorPageProps) {
  const { id } = await searchParams;

  return (
    <ToolChrome>
      <PdfEditor initialDocumentId={id} />
    </ToolChrome>
  );
}
