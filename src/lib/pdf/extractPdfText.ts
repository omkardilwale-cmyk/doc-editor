import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfTextItem } from "@/types/pdfText";
import {
  buildCanvasFontCss,
  resolvePdfFontStyle,
  textBoxMetrics,
  topFromBaseline,
  type PdfFontStyle,
} from "@/lib/pdf/pdfTextFont";

export function measureCanvasTextWidth(
  text: string,
  fontSize: number,
  font?: Pick<PdfFontStyle, "fontFamily" | "fontBold" | "fontItalic">,
): number {
  if (typeof document === "undefined") {
    return text.length * fontSize * 0.55;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * fontSize * 0.55;
  ctx.font = buildCanvasFontCss(fontSize, {
    fontFamily: font?.fontFamily ?? "sans-serif",
    fontBold: font?.fontBold ?? false,
    fontItalic: font?.fontItalic ?? false,
  });
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

    const fontStyle = resolvePdfFontStyle(
      "fontName" in item ? String(item.fontName) : undefined,
      textContent.styles ?? {},
    );
    const { height } = textBoxMetrics(fontSize, fontStyle);
    const y = topFromBaseline(baselineY, fontSize, fontStyle);
    const pdfHeight = pdfFontSize * (fontStyle.ascent - fontStyle.descent);

    const fontMetrics = {
      fontFamily: fontStyle.fontFamily,
      fontBold: fontStyle.fontBold,
      fontItalic: fontStyle.fontItalic,
    };
    const pdfWidth = item.width || text.length * pdfFontSize * 0.55;
    const width = Math.max(
      (item.width ?? 0) * scale,
      measureCanvasTextWidth(text, fontSize, fontMetrics),
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
      fontFamily: fontStyle.fontFamily,
      fontBold: fontStyle.fontBold,
      fontItalic: fontStyle.fontItalic,
      ascent: fontStyle.ascent,
      descent: fontStyle.descent,
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
