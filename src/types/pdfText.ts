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
  /** Calibrated size for browser width matching. */
  fontSize: number;
  /** Raw size from the PDF transform matrix (matches rendered glyphs). */
  matrixFontSize: number;
  fontFamily: string;
  fontBold: boolean;
  fontItalic: boolean;
  ascent: number;
  descent: number;
  /** Sampled or preserved text color. */
  color?: string;
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
  color?: string;
  fontFamily?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  ascent?: number;
  descent?: number;
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
