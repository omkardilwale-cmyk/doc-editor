import type { PdfTextEdit, PdfTextItem } from "@/types/pdfText";
import type { PageDimensions } from "@/types/annotations";
import {
  buildCanvasFontCss,
  fillCanvasTextWithBoldMatch,
  inputTopFromBaseline,
} from "@/lib/pdf/pdfTextFont";

export function getPdfTextItemCoverBounds(
  item: Pick<
    PdfTextItem,
    "x" | "width" | "sourceWidth" | "fontSize" | "canvasBaselineY"
  >,
) {
  const fontSize = item.fontSize;
  const top = inputTopFromBaseline(item.canvasBaselineY, fontSize) - 2;
  const height = fontSize + 4;
  const width = Math.max(item.width, item.sourceWidth, fontSize) + 12;

  return {
    x: item.x - 4,
    top,
    width,
    height,
    baselineY: item.canvasBaselineY,
    fontSize,
  };
}

/** Hide original PDF glyphs while inline editing. */
export function paintPdfTextItemCoverOnContext(
  ctx: CanvasRenderingContext2D,
  item: Pick<
    PdfTextItem,
    "x" | "width" | "sourceWidth" | "fontSize" | "canvasBaselineY"
  >,
) {
  const { x, top, width, height } = getPdfTextItemCoverBounds(item);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, top, width, height);
}

export function getEditCanvasBounds(
  edit: PdfTextEdit,
  dims: PageDimensions,
) {
  const ratio = dims.width / edit.canvasViewportWidth;
  const fontSize = edit.canvasFontSize * ratio;
  const x = edit.canvasX * ratio;
  const baselineY = edit.canvasBaselineY * ratio;
  const topY = inputTopFromBaseline(baselineY, fontSize);
  const width = edit.canvasCoverWidth * ratio;
  const height = Math.max(edit.canvasHeight * ratio, fontSize * 1.05);

  return { x, topY, baselineY, width, height, fontSize };
}

/** Paint a single PDF text replacement onto any canvas context. */
export function paintPdfTextEditOnContext(
  ctx: CanvasRenderingContext2D,
  edit: PdfTextEdit,
  dims: PageDimensions,
) {
  if (edit.newText === edit.originalText) return;

  const { x, topY, baselineY, width, height, fontSize } = getEditCanvasBounds(
    edit,
    dims,
  );

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 1, topY - 1, width + 2, height + 2);

  ctx.font = buildCanvasFontCss(fontSize, {
    fontFamily: edit.fontFamily ?? "sans-serif",
    fontBold: edit.fontBold ?? false,
    fontItalic: edit.fontItalic ?? false,
  });
  const fillColor = edit.color || "#111827";
  ctx.fillStyle = fillColor;
  fillCanvasTextWithBoldMatch(
    ctx,
    edit.newText,
    x,
    baselineY,
    edit.fontBold ?? false,
  );
}

export function paintPdfTextEditsOnCanvas(
  canvas: HTMLCanvasElement,
  edits: PdfTextEdit[],
  pageIndex: number,
  dims: PageDimensions,
  skipItemId?: string | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (const edit of edits) {
    if (edit.pageIndex !== pageIndex) continue;
    if (skipItemId && edit.itemId === skipItemId) continue;
    paintPdfTextEditOnContext(ctx, edit, dims);
  }
}

export function drawPdfTextHover(
  ctx: CanvasRenderingContext2D,
  item: { x: number; y: number; width: number; height: number },
) {
  ctx.save();
  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(item.x - 2, item.y - 2, item.width + 4, item.height + 4);
  ctx.setLineDash([]);
  ctx.restore();
}
