export interface PdfTextItem {
  id: string;
  pageIndex: number;
  text: string;
  /** Immutable text as extracted from the PDF (for revert detection). */
  sourceText: string;
  /** Original extracted width (for revert). */
  sourceWidth: number;
  /** Canvas top-left X at current viewport scale. */
  x: number;
  /** Canvas top-left Y at current viewport scale. */
  y: number;
  width: number;
  height: number;
  fontSize: number;
  /** Canvas baseline Y (where glyphs sit). */
  canvasBaselineY: number;
  /** PDF X (points, origin bottom-left). */
  pdfX: number;
  /** PDF text baseline Y (points). */
  pdfBaselineY: number;
  pdfFontSize: number;
  pdfWidth: number;
  pdfHeight: number;
}

export interface PdfTextEdit {
  itemId: string;
  pageIndex: number;
  originalText: string;
  newText: string;
  pdfX: number;
  pdfBaselineY: number;
  pdfFontSize: number;
  pdfWidth: number;
  pdfHeight: number;
  /** Canvas position when the edit was made (for live preview). */
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasFontSize: number;
  canvasBaselineY: number;
  canvasViewportWidth: number;
  /** Width of white cover — spans longest text ever drawn here. */
  canvasCoverWidth: number;
  /** Max PDF width ever needed to cover edits on export. */
  pdfCoverWidth?: number;
}
