import type { Annotation, ExportPayload } from "@/types/annotations";
import type { PdfTextEdit } from "@/types/pdfText";

export interface PageExportFlush {
  pdfTextEdits: PdfTextEdit[];
  annotations: Annotation[];
  removedAnnotationIds: string[];
}

export function mergeExportPayload(
  base: ExportPayload,
  flushes: PageExportFlush[],
): ExportPayload {
  let annotations = [...base.annotations];
  let pdfTextEdits = [...base.pdfTextEdits];

  for (const flush of flushes) {
    for (const id of flush.removedAnnotationIds) {
      annotations = annotations.filter((a) => a.id !== id);
    }

    for (const annotation of flush.annotations) {
      const index = annotations.findIndex((a) => a.id === annotation.id);
      if (index >= 0) {
        annotations[index] = annotation;
      } else {
        annotations.push(annotation);
      }
    }

    for (const edit of flush.pdfTextEdits) {
      pdfTextEdits = pdfTextEdits.filter((e) => e.itemId !== edit.itemId);
      if (edit.newText !== edit.originalText) {
        pdfTextEdits.push(edit);
      }
    }
  }

  return {
    annotations,
    pageDimensions: base.pageDimensions,
    pdfTextEdits,
  };
}
