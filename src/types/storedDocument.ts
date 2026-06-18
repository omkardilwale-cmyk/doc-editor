import type { Annotation, PageDimensions } from "@/types/annotations";
import type { PdfTextEdit } from "@/types/pdfText";

export interface StoredDocumentEditorState {
  annotations: Annotation[];
  pdfTextEdits: PdfTextEdit[];
  pageDimensions?: PageDimensions[];
}

export interface StoredDocumentRecord extends StoredDocumentEditorState {
  _id: string;
  email: string;
  name: string;
  pdfBase64: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredDocumentSummary {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentBody {
  email: string;
  name: string;
  pdfBase64: string;
  annotations?: Annotation[];
  pdfTextEdits?: PdfTextEdit[];
  pageDimensions?: PageDimensions[];
}

export interface UpdateDocumentBody {
  name?: string;
  annotations?: Annotation[];
  pdfTextEdits?: PdfTextEdit[];
  pageDimensions?: PageDimensions[];
  pdfBase64?: string;
}
