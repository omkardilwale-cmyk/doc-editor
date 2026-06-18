export type EditTool =
  | "select"
  | "editPdf"
  | "text"
  | "highlight"
  | "draw"
  | "eraser";

export type AnnotationType = "text" | "highlight" | "draw";

export interface Point {
  x: number;
  y: number;
}

interface BaseAnnotation {
  id: string;
  pageIndex: number;
  type: AnnotationType;
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  width: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface DrawAnnotation extends BaseAnnotation {
  type: "draw";
  points: Point[];
  color: string;
  strokeWidth: number;
}

export type Annotation = TextAnnotation | HighlightAnnotation | DrawAnnotation;

export interface PageDimensions {
  /** Rendered canvas width (viewport at current zoom). */
  width: number;
  /** Rendered canvas height (viewport at current zoom). */
  height: number;
  /** Native PDF page width in points. */
  pdfWidth: number;
  /** Native PDF page height in points. */
  pdfHeight: number;
}

import type { PdfTextEdit } from "@/types/pdfText";

export interface ExportPayload {
  annotations: Annotation[];
  pageDimensions: PageDimensions[];
  pdfTextEdits: PdfTextEdit[];
}
