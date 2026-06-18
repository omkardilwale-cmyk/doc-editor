import type { PdfTextEdit } from "@/types/pdfText";
import type { PageDimensions } from "@/types/annotations";
import { buildCanvasFontCss } from "@/lib/pdf/pdfTextFont";

export function getEditCanvasBounds(
  edit: PdfTextEdit,
  dims: PageDimensions,
) {
  const ratio = dims.width / edit.canvasViewportWidth;
  const fontSize = edit.canvasFontSize * ratio;
  const x = edit.canvasX * ratio;
  const baselineY = edit.canvasBaselineY * ratio;
  const ascent = edit.ascent ?? 0.75;
  const topY = baselineY - fontSize * ascent;
  const width = edit.canvasCoverWidth * ratio;
  const height = edit.canvasHeight * ratio;

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
  ctx.fillStyle = edit.color || "#111827";
  ctx.fillText(edit.newText, x, baselineY);
}

export function paintPdfTextEditsOnCanvas(
  canvas: HTMLCanvasElement,
  edits: PdfTextEdit[],
  pageIndex: number,
  dims: PageDimensions,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (const edit of edits) {
    if (edit.pageIndex !== pageIndex) continue;
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
