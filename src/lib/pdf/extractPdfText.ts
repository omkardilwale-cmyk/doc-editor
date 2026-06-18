import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfTextItem } from "@/types/pdfText";

export function measureCanvasTextWidth(text: string, fontSize: number): number {
  if (typeof document === "undefined") {
    return text.length * fontSize * 0.55;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * fontSize * 0.55;
  ctx.font = `${fontSize}px sans-serif`;
  return ctx.measureText(text || " ").width;
}

export async function extractPageTextItems(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
): Promise<PdfTextItem[]> {
  const pdfjs = await import("pdfjs-dist");
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const pdfViewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();

  const items: PdfTextItem[] = [];
  let index = 0;

  for (const item of textContent.items) {
    if (!("str" in item)) continue;
    const text = item.str;
    if (!text.trim()) continue;

    const canvasTx = pdfjs.Util.transform(viewport.transform, item.transform);
    const pdfTx = pdfjs.Util.transform(pdfViewport.transform, item.transform);

    const fontSize = Math.hypot(canvasTx[0], canvasTx[1]) || 12;
    const pdfFontSize = Math.hypot(pdfTx[0], pdfTx[1]) || fontSize;
    const baselineY = canvasTx[5];
    const x = canvasTx[4];
    const y = baselineY - fontSize;
    const height = fontSize * 1.2;
    const pdfWidth = item.width || text.length * pdfFontSize * 0.55;
    const pdfHeight = pdfFontSize * 1.2;
    const width = Math.max(
      (item.width ?? 0) * scale,
      measureCanvasTextWidth(text, fontSize),
    );

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(height)) {
      continue;
    }

    items.push({
      id: `pdf-text-${pageIndex}-${index++}`,
      pageIndex,
      text,
      sourceText: text,
      sourceWidth: width,
      x,
      y,
      width,
      height,
      fontSize,
      canvasBaselineY: baselineY,
      pdfX: pdfTx[4],
      pdfBaselineY: pdfTx[5],
      pdfFontSize,
      pdfWidth,
      pdfHeight,
    });
  }

  return items;
}

/** Pick the smallest text fragment under the pointer (most specific). */
export function hitTestPdfTextItem(
  items: PdfTextItem[],
  x: number,
  y: number,
): PdfTextItem | null {
  let best: PdfTextItem | null = null;
  let bestArea = Infinity;

  for (const item of items) {
    const pad = 2;
    if (
      x >= item.x - pad &&
      x <= item.x + item.width + pad &&
      y >= item.y - pad &&
      y <= item.y + item.height + pad
    ) {
      const area = item.width * item.height;
      if (area < bestArea) {
        bestArea = area;
        best = item;
      }
    }
  }

  return best;
}
