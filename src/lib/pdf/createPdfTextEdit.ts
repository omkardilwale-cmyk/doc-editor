import { measureCanvasTextWidth } from "@/lib/pdf/extractPdfText";
import { editStyleFromItem } from "@/lib/pdf/pdfTextStyle";
import type { PdfNativeTextDraft } from "@/types/pdfNativeTextEdit";
import type { PageDimensions } from "@/types/annotations";
import type { PdfTextEdit, PdfTextItem } from "@/types/pdfText";

export interface PdfTextEditSession {
  canvasFontSize: number;
  pdfFontSize: number;
  previewCoverWidth: number;
}

export function createPdfTextEdit(
  item: PdfTextItem,
  draft: PdfNativeTextDraft,
  pageIndex: number,
  pageDimensions: PageDimensions | undefined,
  existingEdits: PdfTextEdit[],
  session: PdfTextEditSession | null,
): { edit: PdfTextEdit; isUnchanged: boolean } | null {
  const trimmed = draft.text.trim();
  if (!trimmed) return null;

  const existingEdit = existingEdits.find((e) => e.itemId === item.id);
  const originalStyle = editStyleFromItem(
    { ...item, text: item.sourceText },
    undefined,
  );
  const fontMetrics = {
    fontFamily: item.fontFamily,
    fontBold: draft.fontBold,
    fontItalic: draft.fontItalic,
  };
  const baseCanvasFontSize = session?.canvasFontSize ?? item.fontSize;
  const basePdfFontSize = session?.pdfFontSize ?? item.pdfFontSize;
  const fontScale = draft.fontSize / baseCanvasFontSize;
  const coverWidth = Math.max(
    item.sourceWidth,
    measureCanvasTextWidth(trimmed, draft.fontSize, fontMetrics),
    existingEdit?.canvasCoverWidth ?? 0,
  );
  const pdfCoverWidth = Math.max(
    item.pdfWidth,
    measureCanvasTextWidth(trimmed, basePdfFontSize * fontScale, fontMetrics),
    existingEdit?.pdfCoverWidth ?? item.pdfWidth,
  );

  const isUnchanged =
    trimmed === item.sourceText &&
    draft.color === (originalStyle.color ?? "#111827") &&
    Math.round(draft.fontSize) === Math.round(baseCanvasFontSize) &&
    draft.fontBold === originalStyle.fontBold &&
    draft.fontItalic === originalStyle.fontItalic;

  const edit: PdfTextEdit = {
    itemId: item.id,
    pageIndex,
    originalText: item.sourceText,
    newText: trimmed,
    color: draft.color,
    fontFamily: item.fontFamily,
    fontBold: draft.fontBold,
    fontItalic: draft.fontItalic,
    ascent: item.ascent,
    descent: item.descent,
    pdfX: item.pdfX,
    pdfBaselineY: item.pdfBaselineY,
    pdfFontSize: basePdfFontSize * fontScale,
    pdfWidth: item.pdfWidth,
    pdfHeight: item.pdfHeight,
    canvasX: item.x,
    canvasY: item.y,
    canvasWidth: item.sourceWidth,
    canvasHeight: draft.fontSize * 1.1,
    canvasFontSize: draft.fontSize,
    canvasBaselineY: item.canvasBaselineY,
    canvasViewportWidth: pageDimensions?.width ?? item.width,
    canvasCoverWidth: coverWidth,
    pdfCoverWidth,
  };

  return { edit, isUnchanged };
}
