"use client";

import { useCallback, useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfUploader } from "./PdfUploader";
import { PdfToolbar } from "./PdfToolbar";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { loadPdfDocument } from "@/lib/pdf/pdfjs";
import { downloadPdf, exportPdfWithAnnotations } from "@/lib/pdf/exportPdf";
import type {
  Annotation,
  EditTool,
  PageDimensions,
  TextAnnotation,
} from "@/types/annotations";
import type { PdfTextEdit } from "@/types/pdfText";

export function PdfEditor() {
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
  const [savedBlob, setSavedBlob] = useState<Uint8Array | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null,
  );
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingPdfTextId, setEditingPdfTextId] = useState<string | null>(null);
  const [newTextDraft, setNewTextDraft] = useState<TextAnnotation | null>(null);
  const [pdfTextEdits, setPdfTextEdits] = useState<PdfTextEdit[]>([]);

  const selectedAnnotation =
    annotations.find((a) => a.id === selectedAnnotationId) ??
    (newTextDraft?.id === selectedAnnotationId ? newTextDraft : undefined);

  const loadFile = useCallback(async (selected: File) => {
    const bytes = await selected.arrayBuffer();
    const doc = await loadPdfDocument(bytes.slice(0));
    setFile(selected);
    setPdfBytes(bytes);
    setPdf(doc);
    setAnnotations([]);
    setPageDimensions([]);
    setCurrentPage(0);
    setSelectedAnnotationId(null);
    setEditingTextId(null);
    setEditingPdfTextId(null);
    setNewTextDraft(null);
    setPdfTextEdits([]);
    setSavedBlob(null);
    setStatusMessage(null);
  }, []);

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
  }, [selectedAnnotationId]);

  const resetEditor = () => {
    setFile(null);
    setPdfBytes(null);
    setPdf(null);
    setAnnotations([]);
    setPageDimensions([]);
    setCurrentPage(0);
    setSelectedAnnotationId(null);
    setEditingTextId(null);
    setEditingPdfTextId(null);
    setNewTextDraft(null);
    setPdfTextEdits([]);
    setSavedBlob(null);
    setStatusMessage(null);
  };

  const handlePdfTextEdit = useCallback((edit: PdfTextEdit) => {
    setPdfTextEdits((prev) => {
      const without = prev.filter((e) => e.itemId !== edit.itemId);
      return edit.newText === edit.originalText ? without : [...without, edit];
    });
  }, []);

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

  const exportLocally = async (): Promise<Uint8Array> => {
    if (!pdfBytes) throw new Error("No PDF loaded");
    return exportPdfWithAnnotations(pdfBytes, buildExportPayload());
  };

  const handleSave = async () => {
    if (!file || !pdfBytes) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("annotations", JSON.stringify(buildExportPayload()));

      const response = await fetch("/api/pdf/export", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }

      const buffer = await response.arrayBuffer();
      setSavedBlob(new Uint8Array(buffer));
      setStatusMessage("Changes saved. Download when ready.");
    } catch {
      const bytes = await exportLocally();
      setSavedBlob(bytes);
      setStatusMessage("Saved locally (server unavailable).");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!file || !pdfBytes) return;
    try {
      const bytes = await exportLocally();
      const baseName = file.name.replace(/\.pdf$/i, "") || "document";
      downloadPdf(bytes, `${baseName}-edited.pdf`);
      setStatusMessage("Download started.");
    } catch {
      setStatusMessage("Could not export PDF. Try again.");
    }
  };

  useEffect(() => {
    setSavedBlob(null);
  }, [annotations, pdfTextEdits, scale]);

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

      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedAnnotationId || editingTextId || isTyping) return;
      e.preventDefault();
      deleteSelectedAnnotation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedAnnotationId, editingTextId, deleteSelectedAnnotation]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  if (!file || !pdf) {
    return <PdfUploader onFileSelect={loadFile} />;
  }

  const pageCount = pdf.numPages;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100">
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
        selectedAnnotation={selectedAnnotation ?? null}
        onEditSelectedText={handleEditSelectedText}
        onDeleteSelected={deleteSelectedAnnotation}
      />

      {statusMessage && (
        <div className="bg-emerald-600 px-4 py-2 text-center text-sm text-white">
          {statusMessage}
        </div>
      )}

      <main className="flex-1 overflow-auto py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-12">
          {Array.from({ length: pageCount }, (_, i) => (
            <PdfPageCanvas
              key={i}
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
            />
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-4 py-2 text-center text-xs text-zinc-500">
        <strong>Edit PDF</strong> tool: click existing document text to change it.
        Download to save all changes.
      </footer>
    </div>
  );
}
