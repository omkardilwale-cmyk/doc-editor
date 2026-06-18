import type { Metadata } from "next";
import { Suspense } from "react";
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
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500">
            Loading…
          </div>
        }
      >
        <PdfEditor key={id ?? "upload"} />
      </Suspense>
    </ToolChrome>
  );
}
