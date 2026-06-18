"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { DownloadFeedbackDialog } from "./DownloadFeedbackDialog";
import { EmailSaveDialog } from "./EmailSaveDialog";
import { PdfUploader } from "./PdfUploader";
import { PdfToolbar } from "./PdfToolbar";
import { PdfPageCanvas, type PdfPageCanvasHandle } from "./PdfPageCanvas";
import { loadPdfDocument } from "@/lib/pdf/pdfjs";
import { downloadPdf } from "@/lib/pdf/exportPdf";
import { exportPdfFromRenderedPages } from "@/lib/pdf/exportPdfCanvas";
import { mergeExportPayload } from "@/lib/pdf/mergeExportPayload";
import { arrayBufferToBase64, base64ToArrayBuffer } from "@/lib/pdf/base64";
import {
  createStoredDocument,
  fetchDocumentById,
  updateStoredDocument,
} from "@/lib/api/documents";
import { submitDownloadFeedback } from "@/lib/api/feedback";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import { useUserEmail } from "@/hooks/useUserEmail";
import type {
  Annotation,
  EditTool,
  PageDimensions,
  TextAnnotation,
} from "@/types/annotations";
import type { PdfTextEdit } from "@/types/pdfText";
export function PdfEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlDocumentId = searchParams.get("id");
  const { email, setEmail, ready: emailReady, isValid: emailValid } = useUserEmail();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pageDimensions, setPageDimensions] = useState<PageDimensions[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [tool, setTool] = useState<EditTool>("editPdf");
  const [color, setColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(16);
  const [scale, setScale] = useState(1.25);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogError, setSaveDialogError] = useState<string | null>(null);
  const [savedBlob, setSavedBlob] = useState<Uint8Array | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null,
  );
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingPdfTextId, setEditingPdfTextId] = useState<string | null>(null);
  const [newTextDraft, setNewTextDraft] = useState<TextAnnotation | null>(null);
  const [pdfTextEdits, setPdfTextEdits] = useState<PdfTextEdit[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(urlDocumentId);
  const [isLoadingDocument, setIsLoadingDocument] = useState(
    () => Boolean(urlDocumentId),
  );

  const annotationsRef = useRef(annotations);
  const pdfTextEditsRef = useRef(pdfTextEdits);
  const pageCanvasRefs = useRef<(PdfPageCanvasHandle | null)[]>([]);
  const loadedDocumentIdRef = useRef<string | null>(null);
  const hasAutoScaledRef = useRef(false);
  annotationsRef.current = annotations;
  pdfTextEditsRef.current = pdfTextEdits;

  const {
    revision: historyRevision,
    canUndo,
    canRedo,
    reset: resetHistory,
    push: pushHistory,
    undo,
    redo,
    beginRestore,
    endRestore,
  } = useEditorHistory();

  const commitHistory = useCallback(() => {
    queueMicrotask(() => {
      pushHistory({
        annotations: annotationsRef.current,
        pdfTextEdits: pdfTextEditsRef.current,
      });
    });
  }, [pushHistory]);

  const clearTransientEditing = useCallback(() => {
    setSelectedAnnotationId(null);
    setEditingTextId(null);
    setEditingPdfTextId(null);
    setNewTextDraft(null);
  }, []);

  const applySnapshot = useCallback(
    (snapshot: { annotations: Annotation[]; pdfTextEdits: PdfTextEdit[] }) => {
      beginRestore();
      setAnnotations(snapshot.annotations);
      setPdfTextEdits(snapshot.pdfTextEdits);
      clearTransientEditing();
      queueMicrotask(() => endRestore());
    },
    [beginRestore, clearTransientEditing, endRestore],
  );

  const handleUndo = useCallback(() => {
    const snapshot = undo();
    if (!snapshot) return;
    applySnapshot(snapshot);
  }, [applySnapshot, undo]);

  const handleRedo = useCallback(() => {
    const snapshot = redo();
    if (!snapshot) return;
    applySnapshot(snapshot);
  }, [applySnapshot, redo]);

  void historyRevision;

  const selectedAnnotation =
    annotations.find((a) => a.id === selectedAnnotationId) ??
    (newTextDraft?.id === selectedAnnotationId ? newTextDraft : undefined);

  const loadFromBytes = useCallback(
    async (
      bytes: ArrayBuffer,
      name: string,
      options?: {
        documentId?: string | null;
        annotations?: Annotation[];
        pdfTextEdits?: PdfTextEdit[];
        pageDimensions?: PageDimensions[];
      },
    ) => {
      const doc = await loadPdfDocument(bytes.slice(0));
      const pdfFile = new File([bytes], name, { type: "application/pdf" });
      setFile(pdfFile);
      setPdfBytes(bytes);
      setPdf(doc);
      setAnnotations(options?.annotations ?? []);
      setPageDimensions(options?.pageDimensions ?? []);
      setCurrentPage(0);
      setSelectedAnnotationId(null);
      setEditingTextId(null);
      setEditingPdfTextId(null);
      setNewTextDraft(null);
      setPdfTextEdits(options?.pdfTextEdits ?? []);
      setDocumentId(options?.documentId ?? null);
      loadedDocumentIdRef.current = options?.documentId ?? null;
      hasAutoScaledRef.current = false;
      setSavedBlob(null);
      setStatusMessage(null);
      resetHistory({
        annotations: options?.annotations ?? [],
        pdfTextEdits: options?.pdfTextEdits ?? [],
      });
    },
    [resetHistory],
  );

  const loadFile = useCallback(
    async (selected: File) => {
      const bytes = await selected.arrayBuffer();
      await loadFromBytes(bytes, selected.name, { documentId: null });
      router.replace("/pdfeditor");
    },
    [loadFromBytes, router],
  );

  const loadStoredDocument = useCallback(
    async (id: string) => {
      if (!emailValid) {
        setStatusMessage("Save a PDF with your email first to open saved documents.");
        return;
      }
      if (loadedDocumentIdRef.current === id && pdf) return;
      setIsLoadingDocument(true);
      setStatusMessage(null);
      try {
        const stored = await fetchDocumentById(id, email);
        const bytes = base64ToArrayBuffer(stored.pdfBase64);
        await loadFromBytes(bytes, stored.name, {
          documentId: stored._id,
          annotations: stored.annotations,
          pdfTextEdits: stored.pdfTextEdits,
          pageDimensions: stored.pageDimensions,
        });
        loadedDocumentIdRef.current = stored._id;
        router.replace(`/pdfeditor?id=${stored._id}`);
        setStatusMessage(`Opened "${stored.name}" from MongoDB.`);
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "Could not open saved PDF",
        );
      } finally {
        setIsLoadingDocument(false);
      }
    },
    [email, emailValid, loadFromBytes, pdf, router],
  );

  const handleDimensions = useCallback((pageIndex: number, dims: PageDimensions) => {
    setPageDimensions((prev) => {
      const next = [...prev];
      next[pageIndex] = dims;
      return next;
    });
  }, []);

  const updateAnnotation = useCallback((id: string, updated: Annotation) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }, []);

  const deleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
    setEditingTextId(null);
    setNewTextDraft(null);
    commitHistory();
  }, [selectedAnnotationId, commitHistory]);

  const resetEditor = () => {
    router.replace("/pdfeditor");
  };

  const handlePdfTextEdit = useCallback(
    (edit: PdfTextEdit) => {
      setPdfTextEdits((prev) => {
        const without = prev.filter((e) => e.itemId !== edit.itemId);
        const next =
          edit.newText === edit.originalText ? without : [...without, edit];
        queueMicrotask(() => {
          pushHistory({
            annotations: annotationsRef.current,
            pdfTextEdits: next,
          });
        });
        return next;
      });
    },
    [pushHistory],
  );

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    if (!selectedAnnotationId) return;

    if (newTextDraft?.id === selectedAnnotationId) {
      setNewTextDraft({ ...newTextDraft, color: newColor });
      return;
    }

    setAnnotations((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAnnotationId) return a;
        if (a.type === "text" || a.type === "highlight" || a.type === "draw") {
          return { ...a, color: newColor };
        }
        return a;
      }),
    );
    commitHistory();
  };

  const handleFontSizeChange = (newSize: number) => {
    if (!Number.isFinite(newSize) || newSize <= 0) return;
    setFontSize(newSize);
    if (!selectedAnnotationId) return;

    if (newTextDraft?.id === selectedAnnotationId) {
      setNewTextDraft({
        ...newTextDraft,
        fontSize: newSize,
        width: Math.max(newSize * 4, 140),
      });
      return;
    }

    setAnnotations((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAnnotationId || a.type !== "text") return a;
        return {
          ...a,
          fontSize: newSize,
          width: Math.max(newSize * a.text.length * 0.6, newSize),
        };
      }),
    );
    commitHistory();
  };

  const handleEditSelectedText = () => {
    if (!selectedAnnotation || selectedAnnotation.type !== "text") return;
    setEditingTextId(selectedAnnotation.id);
  };

  const handleApplyTextStyle = useCallback(
    (style: { fontSize: number; color: string }) => {
      setFontSize(style.fontSize);
      setColor(style.color);
    },
    [],
  );

  const buildExportPayload = () => ({
    annotations,
    pageDimensions,
    pdfTextEdits,
  });

  const collectExportPayload = () => {
    const flushes = pageCanvasRefs.current
      .filter((ref): ref is PdfPageCanvasHandle => ref != null)
      .map((ref) => ref.flushPendingEdits());
    return mergeExportPayload(buildExportPayload(), flushes);
  };

  const exportLocally = async (): Promise<Uint8Array> => {
    if (!pdf) throw new Error("No PDF loaded");
    const payload = collectExportPayload();
    return exportPdfFromRenderedPages(pdf, payload, Math.max(scale, 2));
  };

  const handleSave = () => {
    if (!file || !pdfBytes) return;
    setSaveDialogError(null);
    setSaveDialogOpen(true);
  };

  const performCloudSave = async (saveEmail: string) => {
    if (!file || !pdfBytes) return;
    setEmail(saveEmail);
    setIsSaving(true);
    setSaveDialogError(null);
    setStatusMessage(null);
    try {
      const payload = collectExportPayload();
      const pdfBase64 = arrayBufferToBase64(pdfBytes);

      if (documentId) {
        await updateStoredDocument(documentId, saveEmail, {
          name: file.name,
          annotations: payload.annotations,
          pdfTextEdits: payload.pdfTextEdits,
          pageDimensions: payload.pageDimensions,
        });
        setStatusMessage("Document saved.");
      } else {
        const stored = await createStoredDocument({
          email: saveEmail,
          name: file.name,
          pdfBase64,
          annotations: payload.annotations,
          pdfTextEdits: payload.pdfTextEdits,
          pageDimensions: payload.pageDimensions,
        });
        setDocumentId(stored._id);
        router.replace(`/pdfeditor?id=${stored._id}`);
        setStatusMessage("Document saved.");
      }

      const bytes = await exportLocally();
      setSavedBlob(bytes);
      setSaveDialogOpen(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes("MONGODB_URI")
          ? "Cloud save is not set up. Download your PDF instead."
          : error instanceof Error
            ? error.message
            : "Save failed";
      setSaveDialogError(message);
      try {
        const bytes = await exportLocally();
        setSavedBlob(bytes);
      } catch {
        // ignore local export failure
      }
    } finally {
      setIsSaving(false);
    }
  };

  const performDownload = async () => {
    if (!file || !pdf) return;
    setIsDownloading(true);
    setStatusMessage(null);
    try {
      const bytes = await exportLocally();
      const baseName = file.name.replace(/\.pdf$/i, "") || "document";
      downloadPdf(bytes, `${baseName}-edited.pdf`);
      setStatusMessage("Download started.");
      setFeedbackDialogOpen(false);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not export PDF. Try again.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownload = () => {
    if (!file || !pdf || isDownloading || savingFeedback) return;
    setFeedbackDialogOpen(true);
  };

  const handleFeedbackSubmit = async (rating: number, comment: string) => {
    if (!file) return;
    setSavingFeedback(true);
    try {
      await submitDownloadFeedback({
        rating,
        comment,
        documentId,
        fileName: file.name,
      });
    } catch {
      // Continue with download even if feedback storage fails.
    } finally {
      setSavingFeedback(false);
    }
    await performDownload();
  };

  const handleFeedbackSkip = () => {
    void performDownload();
  };

  useEffect(() => {
    setSavedBlob(null);
  }, [annotations, pdfTextEdits, scale]);

  useEffect(() => {
    if (hasAutoScaledRef.current) return;
    const dims = pageDimensions[0];
    if (!dims?.width) return;

    const padding = 24;
    const available = window.innerWidth - padding;
    if (dims.width > available) {
      setScale((prev) =>
        Math.min(3, Math.max(0.5, prev * (available / dims.width))),
      );
    }
    hasAutoScaledRef.current = true;
  }, [pageDimensions]);

  useEffect(() => {
    if (!selectedAnnotationId) return;
    const selected = annotations.find((a) => a.id === selectedAnnotationId);
    if (selected) {
      if (selected.pageIndex !== currentPage) {
        setCurrentPage(selected.pageIndex);
      }
      return;
    }
    if (newTextDraft?.id === selectedAnnotationId) {
      if (newTextDraft.pageIndex !== currentPage) {
        setCurrentPage(newTextDraft.pageIndex);
      }
      return;
    }
    if (editingTextId === selectedAnnotationId) return;
    setSelectedAnnotationId(null);
    setEditingTextId(null);
  }, [
    currentPage,
    selectedAnnotationId,
    annotations,
    newTextDraft,
    editingTextId,
  ]);

  useEffect(() => {
    if (!selectedAnnotationId) return;
    const selected =
      annotations.find((a) => a.id === selectedAnnotationId) ??
      (newTextDraft?.id === selectedAnnotationId ? newTextDraft : null);
    if (!selected) return;
    if (
      selected.type === "text" ||
      selected.type === "highlight" ||
      selected.type === "draw"
    ) {
      setColor(selected.color);
    }
    if (selected.type === "text") {
      setFontSize(selected.fontSize);
    }
  }, [selectedAnnotationId, annotations, newTextDraft]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedAnnotationId || editingTextId || isTyping) return;
      e.preventDefault();
      deleteSelectedAnnotation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedAnnotationId,
    editingTextId,
    deleteSelectedAnnotation,
    handleUndo,
    handleRedo,
  ]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!urlDocumentId || !emailReady || !emailValid) return;
    void loadStoredDocument(urlDocumentId);
  }, [urlDocumentId, emailReady, emailValid, loadStoredDocument]);

  if (!file || !pdf) {
    if (isLoadingDocument) {
      return (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500">
          Loading PDF from MongoDB…
        </div>
      );
    }
    return (
      <PdfUploader
        onFileSelect={loadFile}
        onOpenDocument={(id) => void loadStoredDocument(id)}
      />
    );
  }

  const pageCount = pdf.numPages;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-100">
      <EmailSaveDialog
        open={saveDialogOpen}
        initialEmail={email}
        saving={isSaving}
        error={saveDialogError}
        onClose={() => {
          if (!isSaving) setSaveDialogOpen(false);
        }}
        onConfirm={(saveEmail) => void performCloudSave(saveEmail)}
      />

      <DownloadFeedbackDialog
        open={feedbackDialogOpen}
        saving={savingFeedback}
        downloading={isDownloading}
        onClose={() => {
          if (!savingFeedback && !isDownloading) setFeedbackDialogOpen(false);
        }}
        onSubmit={(rating, comment) => void handleFeedbackSubmit(rating, comment)}
        onSkip={handleFeedbackSkip}
      />

      <PdfToolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={handleColorChange}
        fontSize={fontSize}
        onFontSizeChange={handleFontSizeChange}
        scale={scale}
        onScaleChange={setScale}
        pageCount={pageCount}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        fileName={file.name}
        onUploadNew={resetEditor}
        onSave={handleSave}
        onDownload={handleDownload}
        isSaving={isSaving}
        isDownloading={isDownloading}
        selectedAnnotation={selectedAnnotation ?? null}
        onEditSelectedText={handleEditSelectedText}
        onDeleteSelected={deleteSelectedAnnotation}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {statusMessage && (
        <div className="bg-emerald-600 px-4 py-2 text-center text-sm text-white">
          {statusMessage}
        </div>
      )}

      <main className="flex-1 overflow-auto py-3 sm:py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-2 sm:px-6 lg:px-12">
          {Array.from({ length: pageCount }, (_, i) => (
            <div key={i} className="w-full max-w-full overflow-x-auto">
              <PdfPageCanvas
              ref={(handle) => {
                pageCanvasRefs.current[i] = handle;
              }}
              pdf={pdf}
              pageIndex={i}
              scale={scale}
              tool={tool}
              color={color}
              fontSize={fontSize}
              annotations={annotations}
              onAnnotationsChange={setAnnotations}
              onDimensions={handleDimensions}
              isActive={i === currentPage}
              onActivatePage={() => setCurrentPage(i)}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={setSelectedAnnotationId}
              onUpdateAnnotation={updateAnnotation}
              editingTextId={editingTextId}
              onEditingTextIdChange={setEditingTextId}
              newTextDraft={newTextDraft}
              onNewTextDraftChange={setNewTextDraft}
              pdfTextEdits={pdfTextEdits}
              onPdfTextEdit={handlePdfTextEdit}
              editingPdfTextId={editingPdfTextId}
              onEditingPdfTextIdChange={setEditingPdfTextId}
              pageDimensions={pageDimensions[i]}
              onApplyTextStyle={handleApplyTextStyle}
              onHistoryCommit={commitHistory}
            />
            </div>
          ))}
        </div>
      </main>

      <footer className="hidden border-t border-zinc-200 bg-white px-4 py-2 text-center text-xs text-zinc-500 sm:block">
        <strong>Edit PDF</strong> tool: tap existing document text to change it.
        Download to save all changes.
      </footer>
    </div>
  );
}
