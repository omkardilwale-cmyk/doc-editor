import type { PdfTextEdit, PdfTextItem } from "@/types/pdfText";
import type { PageDimensions } from "@/types/annotations";
import {
  buildCanvasFontCss,
  fillCanvasTextWithBoldMatch,
  editOverlayTopFromBaseline,
} from "@/lib/pdf/pdfTextFont";

const COVER_PAD_X = 3;
const COVER_PAD_TOP = 2;
/** Extra room below glyphs so row rules/dividers are fully masked. */
const COVER_PAD_BOTTOM = 5;

export function getPdfTextItemCoverBounds(
  item: Pick<
    PdfTextItem,
    | "x"
    | "y"
    | "width"
    | "sourceWidth"
    | "fontSize"
    | "matrixFontSize"
    | "canvasBaselineY"
  >,
) {
  const matrixFontSize = item.matrixFontSize ?? item.fontSize;
  const displayScale = item.fontSize / matrixFontSize;
  const top = Number.isFinite(item.y)
    ? item.y -
      (displayScale > 1 ? matrixFontSize * (displayScale - 1) : 0) -
      COVER_PAD_TOP
    : editOverlayTopFromBaseline(item.canvasBaselineY, matrixFontSize) -
      COVER_PAD_TOP;
  const height =
    Math.max(matrixFontSize * 1.1, item.fontSize) +
    COVER_PAD_TOP +
    COVER_PAD_BOTTOM;
  const width = Math.max(item.width, item.sourceWidth, item.fontSize) + COVER_PAD_X * 2;

  return {
    x: item.x - COVER_PAD_X,
    top,
    width,
    height,
    baselineY: item.canvasBaselineY,
    fontSize: item.fontSize,
  };
}

const EDIT_COVER_PAD_X = 2;
const EDIT_COVER_PAD_TOP = 1;
const EDIT_COVER_PAD_BOTTOM = 2;

/** Tight white cover for the inline editor — hides PDF glyphs without a large flash. */
export function getPdfTextItemEditCoverBounds(
  item: Pick<
    PdfTextItem,
    | "x"
    | "y"
    | "width"
    | "sourceWidth"
    | "fontSize"
    | "matrixFontSize"
    | "canvasBaselineY"
  >,
) {
  const matrixFontSize = item.matrixFontSize ?? item.fontSize;
  const displayScale = item.fontSize / matrixFontSize;
  const top = Number.isFinite(item.y)
    ? item.y -
      (displayScale > 1 ? matrixFontSize * (displayScale - 1) : 0) -
      EDIT_COVER_PAD_TOP
    : editOverlayTopFromBaseline(item.canvasBaselineY, matrixFontSize) -
      EDIT_COVER_PAD_TOP;
  const height =
    Math.max(matrixFontSize * 1.05, item.fontSize) +
    EDIT_COVER_PAD_TOP +
    EDIT_COVER_PAD_BOTTOM;
  const width =
    Math.max(item.width, item.sourceWidth, item.fontSize) + EDIT_COVER_PAD_X * 2;

  return {
    x: item.x - EDIT_COVER_PAD_X,
    top,
    width,
    height,
  };
}

export function paintPdfTextItemEditCoverOnContext(
  ctx: CanvasRenderingContext2D,
  item: Pick<
    PdfTextItem,
    | "x"
    | "y"
    | "width"
    | "sourceWidth"
    | "fontSize"
    | "matrixFontSize"
    | "canvasBaselineY"
  >,
) {
  const { x, top, width, height } = getPdfTextItemEditCoverBounds(item);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, top, width, height);
}

/** Hide original PDF glyphs while inline editing. */
export function paintPdfTextItemCoverOnContext(
  ctx: CanvasRenderingContext2D,
  item: Pick<
    PdfTextItem,
    | "x"
    | "y"
    | "width"
    | "sourceWidth"
    | "fontSize"
    | "matrixFontSize"
    | "canvasBaselineY"
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
  const textX = edit.canvasX * ratio;
  const baselineY = edit.canvasBaselineY * ratio;
  const topY = edit.canvasY * ratio - COVER_PAD_TOP;
  const width = edit.canvasCoverWidth * ratio + COVER_PAD_X * 2;
  const height =
    Math.max(edit.canvasHeight * ratio, fontSize * 1.1) +
    COVER_PAD_TOP +
    COVER_PAD_BOTTOM;

  return {
    coverX: textX - COVER_PAD_X,
    textX,
    topY,
    baselineY,
    width,
    height,
    fontSize,
  };
}

/** Paint a single PDF text replacement onto any canvas context. */
export function paintPdfTextEditOnContext(
  ctx: CanvasRenderingContext2D,
  edit: PdfTextEdit,
  dims: PageDimensions,
) {
  if (edit.newText === edit.originalText) return;

  const { coverX, textX, topY, baselineY, width, height, fontSize } =
    getEditCanvasBounds(edit, dims);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(coverX, topY, width, height);

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
    textX,
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
