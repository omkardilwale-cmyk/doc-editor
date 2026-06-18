"use client";

import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { drawAnnotationsOnCanvas } from "@/lib/pdf/drawAnnotations";
import { paintPdfTextEditsOnCanvas } from "@/lib/pdf/drawPdfTextEdits";
import { renderPageToCanvas } from "@/lib/pdf/pdfjs";
import type { ExportPayload } from "@/types/annotations";

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode page image"));
          return;
        }
        void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)));
      },
      "image/png",
    );
  });
}

/** Flatten the live editor view into a downloadable PDF (matches on-screen preview). */
export async function exportPdfFromRenderedPages(
  pdf: PDFDocumentProxy,
  { annotations, pdfTextEdits }: ExportPayload,
  renderScale = 2,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const pageCount = pdf.numPages;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const canvas = document.createElement("canvas");
    const dims = await renderPageToCanvas(pdf, pageIndex, canvas, renderScale);
    paintPdfTextEditsOnCanvas(canvas, pdfTextEdits, pageIndex, dims);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      drawAnnotationsOnCanvas(ctx, annotations, pageIndex);
    }

    const pngBytes = await canvasToPngBytes(canvas);
    const image = await pdfDoc.embedPng(pngBytes);
    const page = pdfDoc.addPage([dims.pdfWidth, dims.pdfHeight]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: dims.pdfWidth,
      height: dims.pdfHeight,
    });
  }

  return pdfDoc.save();
}
