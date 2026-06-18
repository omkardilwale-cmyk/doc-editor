"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { arrayBufferToBase64 } from "@/lib/pdf/base64";
import {
  clearEditorDraft,
  type EditorDraft,
  writeEditorDraft,
} from "@/lib/editor/editorDraft";
import { mergeExportPayload } from "@/lib/pdf/mergeExportPayload";
import type { PdfPageCanvasHandle } from "@/components/pdf/PdfPageCanvas";
import type {
  Annotation,
  EditTool,
  PageDimensions,
} from "@/types/annotations";
import type { PdfTextEdit } from "@/types/pdfText";

interface UseEditorDraftOptions {
  userKey: string;
  documentKey: string | null;
  fileHash: string | null;
  file: File | null;
  pdfBytes: ArrayBuffer | null;
  documentId: string | null;
  annotations: Annotation[];
  pdfTextEdits: PdfTextEdit[];
  pageDimensions: PageDimensions[];
  currentPage: number;
  scale: number;
  tool: EditTool;
  color: string;
  fontSize: number;
  pageCanvasRefs: MutableRefObject<(PdfPageCanvasHandle | null)[]>;
}

export function useEditorDraft({
  userKey,
  documentKey,
  fileHash,
  file,
  pdfBytes,
  documentId,
  annotations,
  pdfTextEdits,
  pageDimensions,
  currentPage,
  scale,
  tool,
  color,
  fontSize,
  pageCanvasRefs,
}: UseEditorDraftOptions) {
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildDraftPayload = useCallback((): EditorDraft | null => {
    if (!file || !pdfBytes || !documentKey) return null;

    const flushes = pageCanvasRefs.current
      .filter((ref): ref is PdfPageCanvasHandle => ref != null)
      .map((ref) => ref.flushPendingEdits());
    const merged = mergeExportPayload(
      { annotations, pageDimensions, pdfTextEdits },
      flushes,
    );

    let pdfBase64: string | null = null;
    if (!documentId) {
      try {
        pdfBase64 = arrayBufferToBase64(pdfBytes);
      } catch {
        pdfBase64 = null;
      }
    }

    return {
      version: 1,
      userKey,
      documentKey,
      documentId,
      fileName: file.name,
      fileHash,
      pdfBase64,
      annotations: merged.annotations,
      pdfTextEdits: merged.pdfTextEdits,
      pageDimensions,
      currentPage,
      scale,
      tool,
      color,
      fontSize,
      updatedAt: Date.now(),
    };
  }, [
    annotations,
    color,
    currentPage,
    documentId,
    documentKey,
    file,
    fileHash,
    fontSize,
    pageCanvasRefs,
    pageDimensions,
    pdfBytes,
    pdfTextEdits,
    scale,
    tool,
    userKey,
  ]);

  const persistDraft = useCallback(() => {
    const payload = buildDraftPayload();
    if (!payload) return false;
    return writeEditorDraft(payload);
  }, [buildDraftPayload]);

  const persistDraftNow = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    return persistDraft();
  }, [persistDraft]);

  const clearDraft = useCallback(() => {
    if (!documentKey) return;
    clearEditorDraft(userKey, documentKey);
  }, [documentKey, userKey]);

  useEffect(() => {
    if (!file || !pdfBytes || !documentKey) return;

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistDraft();
      persistTimerRef.current = null;
    }, 150);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [
    file,
    pdfBytes,
    documentKey,
    documentId,
    annotations,
    pdfTextEdits,
    pageDimensions,
    currentPage,
    scale,
    tool,
    color,
    fontSize,
    persistDraft,
  ]);

  useEffect(() => {
    const onPageHide = () => persistDraftNow();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [persistDraftNow]);

  return { persistDraftNow, clearDraft };
}
