"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { v4 as uuid } from "uuid";
import { renderPageToCanvas } from "@/lib/pdf/pdfjs";
import { isRenderCancelled, cancelRenderTask } from "@/lib/pdf/renderTask";
import {
  getAnnotationBounds,
  isPointInResizeHandle,
  moveAnnotation,
  resizeHighlightFromCorner,
  updateTextContent,
} from "@/lib/pdf/annotationUtils";
import { drawAnnotationsOnCanvas, hitTestAnnotation } from "@/lib/pdf/drawAnnotations";
import {
  drawPdfTextHover,
  paintPdfTextEditsOnCanvas,
} from "@/lib/pdf/drawPdfTextEdits";
import {
  extractPageTextItems,
  hitTestPdfTextItem,
  measureCanvasTextWidth,
} from "@/lib/pdf/extractPdfText";
import { inheritTextPlacementFromPdf } from "@/lib/pdf/textStyle";
import { TextAnnotationOverlay } from "./TextAnnotationOverlay";
import { PdfNativeTextInput } from "./PdfNativeTextInput";
import type { PdfTextEdit, PdfTextItem } from "@/types/pdfText";
import type {
  Annotation,
  DrawAnnotation,
  EditTool,
  HighlightAnnotation,
  PageDimensions,
  Point,
  TextAnnotation,
} from "@/types/annotations";

type DragKind = "move" | "resize";

interface DragState {
  kind: DragKind;
  annotationId: string;
  startPoint: Point;
  snapshot: Annotation;
}

interface PdfPageCanvasProps {
  pdf: PDFDocumentProxy;
  pageIndex: number;
  scale: number;
  tool: EditTool;
  color: string;
  fontSize: number;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onDimensions: (pageIndex: number, dims: PageDimensions) => void;
  isActive: boolean;
  onActivatePage: () => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (id: string, annotation: Annotation) => void;
  editingTextId: string | null;
  onEditingTextIdChange: (id: string | null) => void;
  newTextDraft: TextAnnotation | null;
  onNewTextDraftChange: (draft: TextAnnotation | null) => void;
  pdfTextEdits: PdfTextEdit[];
  onPdfTextEdit: (edit: PdfTextEdit) => void;
  editingPdfTextId: string | null;
  onEditingPdfTextIdChange: (id: string | null) => void;
  pageDimensions: PageDimensions | undefined;
  onApplyTextStyle: (style: { fontSize: number; color: string }) => void;
}

export function PdfPageCanvas({
  pdf,
  pageIndex,
  scale,
  tool,
  color,
  fontSize,
  annotations,
  onAnnotationsChange,
  onDimensions,
  isActive,
  onActivatePage,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
  editingTextId,
  onEditingTextIdChange,
  newTextDraft,
  onNewTextDraftChange,
  pdfTextEdits,
  onPdfTextEdit,
  editingPdfTextId,
  onEditingPdfTextIdChange,
  pageDimensions,
  onApplyTextStyle,
}: PdfPageCanvasProps) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [highlightStart, setHighlightStart] = useState<Point | null>(null);
  const [highlightDraft, setHighlightDraft] = useState<HighlightAnnotation | null>(
    null,
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const textDragPendingRef = useRef<{
    hit: TextAnnotation;
    start: Point;
  } | null>(null);
  const pdfTextClickPendingRef = useRef<PdfTextItem | null>(null);
  const currentDrawId = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderGenerationRef = useRef(0);
  const [isVisible, setIsVisible] = useState(false);
  const [pdfTextItems, setPdfTextItems] = useState<PdfTextItem[]>([]);
  const [hoveredPdfTextId, setHoveredPdfTextId] = useState<string | null>(null);

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex);
  const canInteract = isVisible;

  const editingAnnotation = useMemo(() => {
    if (!editingTextId) return null;
    if (newTextDraft?.id === editingTextId && newTextDraft.pageIndex === pageIndex) {
      return newTextDraft;
    }
    const found = annotations.find(
      (a): a is TextAnnotation =>
        a.id === editingTextId && a.type === "text" && a.pageIndex === pageIndex,
    );
    return found ?? null;
  }, [editingTextId, newTextDraft, annotations, pageIndex]);

  const editingPdfItem = useMemo(() => {
    if (!editingPdfTextId) return null;
    return pdfTextItems.find((item) => item.id === editingPdfTextId) ?? null;
  }, [editingPdfTextId, pdfTextItems]);

  const editingPdfDisplayText = useMemo(() => {
    if (!editingPdfItem) return "";
    const existingEdit = pdfTextEdits.find((e) => e.itemId === editingPdfItem.id);
    return existingEdit?.newText ?? editingPdfItem.text;
  }, [editingPdfItem, pdfTextEdits]);

  const selectedTextAnnotation = useMemo(() => {
    if (!selectedAnnotationId || editingTextId) return null;
    const ann = annotations.find(
      (a): a is TextAnnotation =>
        a.id === selectedAnnotationId &&
        a.type === "text" &&
        a.pageIndex === pageIndex,
    );
    if (!ann || tool !== "select") return null;
    return ann;
  }, [selectedAnnotationId, editingTextId, annotations, pageIndex, tool]);

  const updateTextPosition = (id: string, x: number, y: number) => {
    if (newTextDraft?.id === id) {
      onNewTextDraftChange({ ...newTextDraft, x, y });
      return;
    }
    const ann = annotations.find((a) => a.id === id);
    if (ann?.type === "text") {
      onUpdateAnnotation(id, { ...ann, x, y });
    }
  };

  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (tool === "editPdf" && hoveredPdfTextId && !editingPdfTextId) {
      const hovered = pdfTextItems.find((item) => item.id === hoveredPdfTextId);
      if (hovered) drawPdfTextHover(ctx, hovered);
    }

    drawAnnotationsOnCanvas(
      ctx,
      annotations,
      pageIndex,
      isActive ? selectedAnnotationId : null,
      editingTextId,
    );
    if (highlightDraft) {
      drawAnnotationsOnCanvas(ctx, [highlightDraft], pageIndex);
    }
    if (draftPoints.length >= 2) {
      const draft: DrawAnnotation = {
        id: "draft",
        type: "draw",
        pageIndex,
        points: draftPoints,
        color,
        strokeWidth: 2,
      };
      drawAnnotationsOnCanvas(ctx, [draft], pageIndex);
    }
  }, [
    annotations,
    pageIndex,
    highlightDraft,
    draftPoints,
    color,
    selectedAnnotationId,
    editingTextId,
    isActive,
    tool,
    hoveredPdfTextId,
    editingPdfTextId,
    pdfTextItems,
  ]);

  const addAnnotation = (annotation: Annotation) => {
    onAnnotationsChange([...annotations, annotation]);
  };

  const removeAnnotation = (id: string) => {
    onAnnotationsChange(annotations.filter((a) => a.id !== id));
  };

  const startTextEdit = (annotation: TextAnnotation) => {
    onActivatePage();
    onSelectAnnotation(annotation.id);
    onEditingTextIdChange(annotation.id);
  };

  const commitTextEdit = (text: string) => {
    const id = editingTextId;
    if (!id) return;

    const trimmed = text.trim();
    const existing = annotations.find((a) => a.id === id);

    if (!trimmed) {
      if (existing) {
        removeAnnotation(id);
        onSelectAnnotation(null);
      }
      onEditingTextIdChange(null);
      onNewTextDraftChange(null);
      return;
    }

    if (existing?.type === "text") {
      onUpdateAnnotation(id, updateTextContent(existing, trimmed));
    } else if (newTextDraft?.id === id) {
      addAnnotation(updateTextContent(newTextDraft, trimmed));
      onNewTextDraftChange(null);
    }

    onEditingTextIdChange(null);
  };

  const cancelTextEdit = () => {
    onEditingTextIdChange(null);
    onNewTextDraftChange(null);
  };

  const refreshPdfPageWithEdits = useCallback(
    async (edits: PdfTextEdit[]) => {
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      try {
        const dims = await renderPageToCanvas(
          pdf,
          pageIndex,
          canvas,
          scale,
          renderTaskRef,
        );
        onDimensions(pageIndex, dims);
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.width = dims.width;
          overlay.height = dims.height;
        }
        paintPdfTextEditsOnCanvas(canvas, edits, pageIndex, dims);
        redrawOverlay();
      } catch (error) {
        if (!isRenderCancelled(error)) throw error;
      }
    },
    [pdf, pageIndex, scale, onDimensions, redrawOverlay],
  );

  const startPdfTextEdit = (item: PdfTextItem) => {
    onActivatePage();
    onEditingPdfTextIdChange(item.id);
    onSelectAnnotation(null);
    onEditingTextIdChange(null);
  };

  const commitPdfTextEdit = (text: string) => {
    if (!editingPdfItem) {
      onEditingPdfTextIdChange(null);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      onEditingPdfTextIdChange(null);
      return;
    }

    const existingEdit = pdfTextEdits.find((e) => e.itemId === editingPdfItem.id);
    const coverWidth = Math.max(
      editingPdfItem.sourceWidth,
      measureCanvasTextWidth(trimmed, editingPdfItem.fontSize),
      existingEdit?.canvasCoverWidth ?? 0,
    );
    const pdfCoverWidth = Math.max(
      editingPdfItem.pdfWidth,
      measureCanvasTextWidth(trimmed, editingPdfItem.pdfFontSize),
      existingEdit?.pdfCoverWidth ?? editingPdfItem.pdfWidth,
    );

    const edit: PdfTextEdit = {
      itemId: editingPdfItem.id,
      pageIndex,
      originalText: editingPdfItem.sourceText,
      newText: trimmed,
      pdfX: editingPdfItem.pdfX,
      pdfBaselineY: editingPdfItem.pdfBaselineY,
      pdfFontSize: editingPdfItem.pdfFontSize,
      pdfWidth: editingPdfItem.pdfWidth,
      pdfHeight: editingPdfItem.pdfHeight,
      canvasX: editingPdfItem.x,
      canvasY: editingPdfItem.y,
      canvasWidth: editingPdfItem.sourceWidth,
      canvasHeight: editingPdfItem.height,
      canvasFontSize: editingPdfItem.fontSize,
      canvasBaselineY: editingPdfItem.canvasBaselineY,
      canvasViewportWidth: pageDimensions?.width ?? editingPdfItem.width,
      canvasCoverWidth: coverWidth,
      pdfCoverWidth,
    };

    const nextEdits =
      edit.newText === edit.originalText
        ? pdfTextEdits.filter((e) => e.itemId !== edit.itemId)
        : [...pdfTextEdits.filter((e) => e.itemId !== edit.itemId), edit];

    onPdfTextEdit(edit);

    setPdfTextItems((prev) =>
      prev.map((item) => {
        if (item.id !== edit.itemId) return item;
        if (trimmed === item.sourceText) {
          return {
            ...item,
            text: item.sourceText,
            width: item.sourceWidth,
          };
        }
        return {
          ...item,
          text: trimmed,
          width: Math.max(
            item.sourceWidth,
            measureCanvasTextWidth(trimmed, item.fontSize),
          ),
        };
      }),
    );

    void refreshPdfPageWithEdits(nextEdits);

    onEditingPdfTextIdChange(null);
    requestAnimationFrame(() => redrawOverlay());
  };

  const cancelPdfTextEdit = () => {
    onEditingPdfTextIdChange(null);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "240px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const shouldRenderPdf = isVisible || isActive;

  useEffect(() => {
    if (!shouldRenderPdf) return;

    const generation = ++renderGenerationRef.current;
    let cancelled = false;
    const activeTaskRef = renderTaskRef;

    async function render() {
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      try {
        const dims = await renderPageToCanvas(
          pdf,
          pageIndex,
          canvas,
          scale,
          activeTaskRef,
        );
        if (cancelled || generation !== renderGenerationRef.current) return;

        onDimensions(pageIndex, dims);
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.width = dims.width;
          overlay.height = dims.height;
        }

        const textItems = await extractPageTextItems(pdf, pageIndex, scale);
        if (cancelled || generation !== renderGenerationRef.current) return;

        const mergedItems = textItems.map((item) => {
          const edit = pdfTextEdits.find((e) => e.itemId === item.id);
          if (!edit) return item;
          return {
            ...item,
            text: edit.newText,
            width: Math.max(
              item.sourceWidth,
              measureCanvasTextWidth(edit.newText, item.fontSize),
            ),
          };
        });
        setPdfTextItems(mergedItems);

        paintPdfTextEditsOnCanvas(canvas, pdfTextEdits, pageIndex, dims);
        redrawOverlay();
      } catch (error) {
        if (isRenderCancelled(error)) return;
        throw error;
      }
    }

    void render();

    return () => {
      cancelled = true;
      void cancelRenderTask(activeTaskRef.current);
      activeTaskRef.current = null;
    };
  }, [shouldRenderPdf, pdf, pageIndex, scale, onDimensions, pdfTextEdits]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleSelectPointerDown = (point: Point, hit: Annotation | null) => {
    onActivatePage();

    if (!hit) {
      onSelectAnnotation(null);
      onEditingTextIdChange(null);
      return;
    }

    onSelectAnnotation(hit.id);

    if (hit.type === "text") {
      textDragPendingRef.current = { hit, start: point };
      return;
    }

    const bounds = getAnnotationBounds(hit);
    const isResize =
      hit.type === "highlight" &&
      isPointInResizeHandle(bounds, point.x, point.y);

    setDragState({
      kind: isResize ? "resize" : "move",
      annotationId: hit.id,
      startPoint: point,
      snapshot: hit,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canInteract) return;
    onActivatePage();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getPoint(e);

    if (tool === "eraser") {
      const hit = hitTestAnnotation(annotations, pageIndex, point.x, point.y);
      if (hit) {
        removeAnnotation(hit.id);
        if (selectedAnnotationId === hit.id) onSelectAnnotation(null);
        if (editingTextId === hit.id) onEditingTextIdChange(null);
      }
      return;
    }

    if (tool === "editPdf") {
      const hit = hitTestPdfTextItem(pdfTextItems, point.x, point.y);
      pdfTextClickPendingRef.current = hit;
      return;
    }

    if (tool === "select") {
      const hit = hitTestAnnotation(annotations, pageIndex, point.x, point.y);
      handleSelectPointerDown(point, hit);
      return;
    }

    if (tool === "text") {
      const hit = hitTestAnnotation(annotations, pageIndex, point.x, point.y);
      if (hit?.type === "text") {
        startTextEdit(hit);
        return;
      }

      const placement = inheritTextPlacementFromPdf(
        pdfTextItems,
        point.x,
        point.y,
      );
      onApplyTextStyle(placement);

      const draft: TextAnnotation = {
        id: uuid(),
        type: "text",
        pageIndex,
        x: placement.x,
        y: placement.y,
        text: "",
        fontSize: placement.fontSize,
        color: placement.color,
        width: Math.max(
          placement.fontSize * 4,
          measureCanvasTextWidth(" ", placement.fontSize) + 8,
        ),
      };
      onNewTextDraftChange(draft);
      onEditingTextIdChange(draft.id);
      onSelectAnnotation(draft.id);
      return;
    }

    if (tool === "highlight") {
      setHighlightStart(point);
      setIsDrawing(true);
      return;
    }

    if (tool === "draw") {
      setIsDrawing(true);
      setDraftPoints([point]);
      currentDrawId.current = uuid();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canInteract) return;
    const point = getPoint(e);

    if (tool === "editPdf") {
      const hit = hitTestPdfTextItem(pdfTextItems, point.x, point.y);
      setHoveredPdfTextId(hit?.id ?? null);
      return;
    }

    if (textDragPendingRef.current) {
      const { start, hit } = textDragPendingRef.current;
      if (Math.hypot(point.x - start.x, point.y - start.y) > 6) {
        setDragState({
          kind: "move",
          annotationId: hit.id,
          startPoint: start,
          snapshot: hit,
        });
        textDragPendingRef.current = null;
        onEditingTextIdChange(null);
      }
    }

    if (tool === "select" && dragState) {
      const dx = point.x - dragState.startPoint.x;
      const dy = point.y - dragState.startPoint.y;

      if (
        dragState.kind === "resize" &&
        dragState.snapshot.type === "highlight"
      ) {
        onUpdateAnnotation(
          dragState.annotationId,
          resizeHighlightFromCorner(dragState.snapshot, point.x, point.y),
        );
        return;
      }

      onUpdateAnnotation(
        dragState.annotationId,
        moveAnnotation(dragState.snapshot, dx, dy),
      );
      return;
    }

    if (!isDrawing) return;

    if (tool === "highlight" && highlightStart) {
      const x = Math.min(highlightStart.x, point.x);
      const y = Math.min(highlightStart.y, point.y);
      setHighlightDraft({
        id: "draft",
        type: "highlight",
        pageIndex,
        x,
        y,
        width: Math.abs(point.x - highlightStart.x),
        height: Math.abs(point.y - highlightStart.y),
        color: color === "#000000" ? "#facc15" : color,
      });
      return;
    }

    if (tool === "draw") {
      setDraftPoints((prev) => [...prev, point]);
    }
  };

  const handlePointerUp = () => {
    if (tool === "editPdf" && pdfTextClickPendingRef.current) {
      startPdfTextEdit(pdfTextClickPendingRef.current);
      pdfTextClickPendingRef.current = null;
      return;
    }

    if (textDragPendingRef.current) {
      startTextEdit(textDragPendingRef.current.hit);
      textDragPendingRef.current = null;
      return;
    }

    if (dragState) {
      setDragState(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "highlight" && highlightDraft && highlightDraft.width > 4) {
      const annotation = { ...highlightDraft, id: uuid() };
      addAnnotation(annotation);
      onSelectAnnotation(annotation.id);
    }
    setHighlightStart(null);
    setHighlightDraft(null);

    if (tool === "draw" && draftPoints.length >= 2 && currentDrawId.current) {
      addAnnotation({
        id: currentDrawId.current,
        type: "draw",
        pageIndex,
        points: draftPoints,
        color,
        strokeWidth: 2,
      });
      onSelectAnnotation(currentDrawId.current);
    }
    setDraftPoints([]);
    currentDrawId.current = null;
  };

  const handlePointerLeave = () => {
    setHoveredPdfTextId(null);
    pdfTextClickPendingRef.current = null;
    handlePointerUp();
  };

  const pointerHandlers = canInteract
    ? {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerLeave,
      }
    : {};

  const cursor =
    tool === "editPdf"
      ? hoveredPdfTextId
        ? "text"
        : "cell"
      : tool === "text"
      ? "text"
      : tool === "draw" || tool === "highlight"
        ? "crosshair"
        : tool === "eraser"
          ? "not-allowed"
          : tool === "select" && dragState
            ? dragState.kind === "resize"
              ? "nwse-resize"
              : "grabbing"
            : "default";

  return (
    <div
      ref={containerRef}
      className={`relative mb-8 shadow-lg ${isActive ? "ring-2 ring-indigo-400" : ""}`}
      style={{ width: "fit-content", minHeight: shouldRenderPdf ? undefined : 320 }}
    >
      {!shouldRenderPdf && (
        <div className="flex h-80 w-[595px] max-w-full items-center justify-center rounded bg-white text-sm text-zinc-400">
          Page {pageIndex + 1} — scroll to load
        </div>
      )}
      <div className={shouldRenderPdf ? "relative" : "hidden"}>
        <canvas ref={pdfCanvasRef} className="block bg-white" />
        <canvas
          ref={overlayRef}
          className="absolute left-0 top-0 touch-none"
          style={{ cursor }}
          {...pointerHandlers}
        />
        {editingPdfItem && (
          <PdfNativeTextInput
            key={editingPdfItem.id}
            item={editingPdfItem}
            text={editingPdfDisplayText}
            onCommit={commitPdfTextEdit}
            onCancel={cancelPdfTextEdit}
          />
        )}
        {editingAnnotation && !editingPdfTextId && (
          <TextAnnotationOverlay
            key={editingAnnotation.id}
            annotation={editingAnnotation}
            isEditing
            isNew={newTextDraft?.id === editingAnnotation.id}
            onCommit={commitTextEdit}
            onCancel={cancelTextEdit}
            onPositionChange={(x, y) =>
              updateTextPosition(editingAnnotation.id, x, y)
            }
          />
        )}
        {selectedTextAnnotation && (
          <TextAnnotationOverlay
            key={`drag-${selectedTextAnnotation.id}`}
            annotation={selectedTextAnnotation}
            onPositionChange={(x, y) =>
              updateTextPosition(selectedTextAnnotation.id, x, y)
            }
          />
        )}
        <div className="pointer-events-none absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-white">
          {pageIndex + 1}
        </div>
        {pageAnnotations.length > 0 && (
          <p className="pointer-events-none absolute -right-2 -top-6 text-xs text-zinc-400">
            {pageAnnotations.length} edit{pageAnnotations.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}
