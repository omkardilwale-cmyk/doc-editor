import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfTextItem } from "@/types/pdfText";
import {
  buildCanvasFontCss,
  inferBoldFromWidth,
  inputTopFromBaseline,
  editOverlayTopFromBaseline,
  resolvePdfFontStyleFromPage,
  type PdfFontStyle,
} from "@/lib/pdf/pdfTextFont";
import { extractTextFillColors } from "@/lib/pdf/extractPdfTextColors";

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

/** Match browser-rendered width to the PDF glyph width at this viewport scale. */
export function resolveCanvasFontSize(
  text: string,
  transformFontSize: number,
  targetWidth: number,
  font?: Pick<PdfFontStyle, "fontFamily" | "fontBold" | "fontItalic">,
): number {
  if (!Number.isFinite(transformFontSize) || transformFontSize <= 0) return 12;
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) return transformFontSize;

  const measured = measureCanvasTextWidth(text, transformFontSize, font);
  if (measured <= 0) return transformFontSize;

  const ratio = targetWidth / measured;
  if (ratio >= 0.98 && ratio <= 1.45) {
    const scaled = transformFontSize * ratio;
    // Width calibration can shrink bold text slightly, making it look lighter.
    if (font?.fontBold && scaled < transformFontSize) {
      return transformFontSize;
    }
    return scaled;
  }
  return transformFontSize;
}

function transformFontSizeFromMatrix(tx: number[]): number {
  return (
    Math.max(Math.hypot(tx[0], tx[1]), Math.hypot(tx[2], tx[3])) || 12
  );
}

export async function extractPageTextItems(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
): Promise<PdfTextItem[]> {
  const pdfjs = await import("pdfjs-dist");
  const page = await pdf.getPage(pageIndex + 1);
  // Load embedded fonts so commonObjs exposes real names like "Helvetica-Bold".
  await page.getOperatorList();
  const viewport = page.getViewport({ scale });
  const pdfViewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const fillColors = await extractTextFillColors(page);

  const items: PdfTextItem[] = [];
  let index = 0;
  let colorIndex = 0;
  const fontStyleCache = new Map<string, PdfFontStyle>();

  for (const item of textContent.items) {
    if (!("str" in item)) continue;
    const text = item.str;
    if (!text.trim()) continue;

    const canvasTx = pdfjs.Util.transform(viewport.transform, item.transform);
    const pdfTx = pdfjs.Util.transform(pdfViewport.transform, item.transform);

    const fontSizeFromMatrix = transformFontSizeFromMatrix(canvasTx);
    const pdfFontSize = transformFontSizeFromMatrix(pdfTx);
    const baselineY = canvasTx[5];
    const x = canvasTx[4];

    const fontStyle = await resolvePdfFontStyleFromPage(
      page,
      "fontName" in item ? String(item.fontName) : undefined,
      textContent.styles ?? {},
      fontStyleCache,
    );
    const targetWidth = (item.width ?? 0) * scale;
    const fontBold = inferBoldFromWidth(
      text,
      fontSizeFromMatrix,
      targetWidth,
      fontStyle,
      measureCanvasTextWidth,
    );
    const fontMetrics = {
      fontFamily: fontStyle.fontFamily,
      fontBold,
      fontItalic: fontStyle.fontItalic,
    };
    const matrixFontSize = fontSizeFromMatrix;
    const fontSize = resolveCanvasFontSize(
      text,
      fontSizeFromMatrix,
      targetWidth,
      fontMetrics,
    );
    const y = editOverlayTopFromBaseline(baselineY, matrixFontSize);
    const height = matrixFontSize * 1.05;
    const pdfHeight = pdfFontSize * (fontStyle.ascent - fontStyle.descent);

    const pdfWidth = item.width || text.length * pdfFontSize * 0.55;
    const width = Math.max(
      targetWidth,
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
      matrixFontSize,
      fontFamily: fontStyle.fontFamily,
      fontBold,
      fontItalic: fontStyle.fontItalic,
      ascent: fontStyle.ascent,
      descent: fontStyle.descent,
      color: fillColors[colorIndex++],
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
