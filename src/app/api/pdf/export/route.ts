import { NextResponse } from "next/server";
import { exportPdfWithAnnotations } from "@/lib/pdf/exportPdf";
import type { ExportPayload } from "@/types/annotations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const annotationsRaw = formData.get("annotations");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    if (typeof annotationsRaw !== "string") {
      return NextResponse.json(
        { error: "Annotations payload is required" },
        { status: 400 },
      );
    }

    const payload = JSON.parse(annotationsRaw) as ExportPayload;
    const pdfBytes = await file.arrayBuffer();
    const result = await exportPdfWithAnnotations(pdfBytes, payload);

    return new NextResponse(Buffer.from(result), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="edited-${file.name}"`,
      },
    });
  } catch (error) {
    console.error("PDF export failed:", error);
    return NextResponse.json(
      { error: "Failed to export PDF" },
      { status: 500 },
    );
  }
}
