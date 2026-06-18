import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";
import type {
  DrawAnnotation,
  ExportPayload,
  HighlightAnnotation,
  PageDimensions,
  TextAnnotation,
} from "@/types/annotations";
import type { PdfTextEdit } from "@/types/pdfText";

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  const num = parseInt(value, 16);
  return rgb(
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  );
}

/** Map canvas (screen) coordinates to PDF point coordinates. */
function toPdfCoords(
  x: number,
  y: number,
  dims: PageDimensions,
): { x: number; y: number } {
  return {
    x: x * (dims.pdfWidth / dims.width),
    y: y * (dims.pdfHeight / dims.height),
  };
}

function screenBottomToPdfY(bottomY: number, dims: PageDimensions): number {
  const { y } = toPdfCoords(0, bottomY, dims);
  return dims.pdfHeight - y;
}

function applyTextAnnotation(
  page: ReturnType<PDFDocument["getPages"]>[number],
  annotation: TextAnnotation,
  dims: PageDimensions,
) {
  const { x } = toPdfCoords(annotation.x, annotation.y, dims);
  const fontSize = annotation.fontSize * (dims.pdfHeight / dims.height);
  const pdfY = screenBottomToPdfY(annotation.y + annotation.fontSize, dims);

  page.drawText(annotation.text, {
    x,
    y: pdfY,
    size: fontSize,
    color: hexToRgb(annotation.color),
  });
}

function applyHighlightAnnotation(
  page: ReturnType<PDFDocument["getPages"]>[number],
  annotation: HighlightAnnotation,
  dims: PageDimensions,
) {
  const topLeft = toPdfCoords(annotation.x, annotation.y, dims);
  const bottomRight = toPdfCoords(
    annotation.x + annotation.width,
    annotation.y + annotation.height,
    dims,
  );
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;
  const color = hexToRgb(annotation.color);

  page.drawRectangle({
    x: topLeft.x,
    y: dims.pdfHeight - bottomRight.y,
    width,
    height,
    color,
    opacity: 0.35,
    borderWidth: 0,
  });
}

function applyDrawAnnotation(
  page: ReturnType<PDFDocument["getPages"]>[number],
  annotation: DrawAnnotation,
  dims: PageDimensions,
) {
  const color = hexToRgb(annotation.color);
  const strokeWidth =
    annotation.strokeWidth * (dims.pdfHeight / dims.height);
  const { points } = annotation;

  if (points.length < 2) return;

  for (let i = 1; i < points.length; i++) {
    const start = toPdfCoords(points[i - 1].x, points[i - 1].y, dims);
    const end = toPdfCoords(points[i].x, points[i].y, dims);
    page.drawLine({
      start: { x: start.x, y: dims.pdfHeight - start.y },
      end: { x: end.x, y: dims.pdfHeight - end.y },
      thickness: strokeWidth,
      color,
    });
  }
}

function resolvePageDimensions(
  pageIndex: number,
  pageDimensions: PageDimensions[],
  pdfWidth: number,
  pdfHeight: number,
): PageDimensions | null {
  const stored = pageDimensions[pageIndex];
  if (stored?.width && stored?.height) {
    return {
      ...stored,
      pdfWidth: stored.pdfWidth || pdfWidth,
      pdfHeight: stored.pdfHeight || pdfHeight,
    };
  }
  return {
    width: pdfWidth,
    height: pdfHeight,
    pdfWidth,
    pdfHeight,
  };
}

function applyPdfTextEdit(
  page: ReturnType<PDFDocument["getPages"]>[number],
  edit: PdfTextEdit,
  font: PDFFont,
) {
  if (edit.newText === edit.originalText) return;

  const textWidth = font.widthOfTextAtSize(edit.newText, edit.pdfFontSize);
  const coverWidth =
    Math.max(edit.pdfWidth, textWidth, edit.pdfCoverWidth ?? edit.pdfWidth) + 4;
  const coverHeight = edit.pdfFontSize * 1.2 + 4;

  page.drawRectangle({
    x: edit.pdfX - 2,
    y: edit.pdfBaselineY - 2,
    width: coverWidth,
    height: coverHeight,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  page.drawText(edit.newText, {
    x: edit.pdfX,
    y: edit.pdfBaselineY,
    size: edit.pdfFontSize,
    font,
    color: rgb(0, 0, 0),
  });
}

export async function exportPdfWithAnnotations(
  pdfBytes: ArrayBuffer,
  { annotations, pageDimensions, pdfTextEdits }: ExportPayload,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const edit of pdfTextEdits) {
    const page = pages[edit.pageIndex];
    if (!page) continue;
    applyPdfTextEdit(page, edit, helvetica);
  }

  for (const annotation of annotations) {
    const page = pages[annotation.pageIndex];
    if (!page) continue;

    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const dims = resolvePageDimensions(
      annotation.pageIndex,
      pageDimensions,
      pdfWidth,
      pdfHeight,
    );
    if (!dims) continue;

    switch (annotation.type) {
      case "text":
        applyTextAnnotation(page, annotation, dims);
        break;
      case "highlight":
        applyHighlightAnnotation(page, annotation, dims);
        break;
      case "draw":
        applyDrawAnnotation(page, annotation, dims);
        break;
    }
  }

  return pdfDoc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
