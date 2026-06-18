"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
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
  paintPdfTextItemEditCoverOnContext,
} from "@/lib/pdf/drawPdfTextEdits";
import {
  extractPageTextItems,
  hitTestPdfTextItem,
  measureCanvasTextWidth,
} from "@/lib/pdf/extractPdfText";
import { createPdfTextEdit } from "@/lib/pdf/createPdfTextEdit";
import type { PageExportFlush } from "@/lib/pdf/mergeExportPayload";
import { editStyleFromItem } from "@/lib/pdf/pdfTextStyle";
import { inputTopFromBaseline } from "@/lib/pdf/pdfTextFont";
import { sampleTextColorFromCanvas } from "@/lib/pdf/sampleTextColor";
import { inheritTextPlacementFromPdf } from "@/lib/pdf/textStyle";
import { TextAnnotationOverlay, type TextAnnotationOverlayHandle } from "./TextAnnotationOverlay";
import {
  PdfNativeTextInput,
  type PdfNativeTextInputHandle,
} from "./PdfNativeTextInput";
import type { PdfNativeTextDraft } from "@/types/pdfNativeTextEdit";
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
  onHistoryCommit: () => void;
}

export interface PdfPageCanvasHandle {
  flushPendingEdits: () => PageExportFlush;
}

export const PdfPageCanvas = forwardRef<PdfPageCanvasHandle, PdfPageCanvasProps>(
  function PdfPageCanvas(
  {
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
    onHistoryCommit,
  },
  ref,
) {
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
  const [isVisible, setIsVisible] = useState(isActive);
  const [pdfTextItems, setPdfTextItems] = useState<PdfTextItem[]>([]);
  const pdfTextItemsRef = useRef<PdfTextItem[]>([]);
  const textColorByIdRef = useRef<Map<string, string>>(new Map());
  const [activePdfTextEditItem, setActivePdfTextEditItem] =
    useState<PdfTextItem | null>(null);
  const pdfTextEditRef = useRef<PdfNativeTextInputHandle>(null);
  const textOverlayRef = useRef<TextAnnotationOverlayHandle>(null);
  const pdfTextEditSessionRef = useRef<{
    canvasFontSize: number;
    pdfFontSize: number;
    previewCoverWidth: number;
  } | null>(null);
  const [hoveredPdfTextId, setHoveredPdfTextId] = useState<string | null>(null);

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex);
  const canInteract = isVisible || isActive;

  useEffect(() => {
    pdfTextItemsRef.current = pdfTextItems;
  }, [pdfTextItems]);

  const hitTestPdfTextAt = useCallback((x: number, y: number) => {
    return hitTestPdfTextItem(pdfTextItemsRef.current, x, y);
  }, []);

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
    if (activePdfTextEditItem) return activePdfTextEditItem;
    if (!editingPdfTextId) return null;
    return pdfTextItems.find((item) => item.id === editingPdfTextId) ?? null;
  }, [activePdfTextEditItem, editingPdfTextId, pdfTextItems]);

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
      onHistoryCommit();
      return;
    }

    if (existing?.type === "text") {
      onUpdateAnnotation(id, updateTextContent(existing, trimmed));
    } else if (newTextDraft?.id === id) {
      addAnnotation(updateTextContent(newTextDraft, trimmed));
      onNewTextDraftChange(null);
    }

    onEditingTextIdChange(null);
    onHistoryCommit();
  };

  const cancelTextEdit = () => {
    onEditingTextIdChange(null);
    onNewTextDraftChange(null);
  };

  const paintEditingPdfTextCover = useCallback(
    (widthOverride?: number) => {
      const item = activePdfTextEditItem;
      const canvas = pdfCanvasRef.current;
      if (!item || !canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const draft = pdfTextEditRef.current?.getDraft();
      const fontMetrics = {
        fontFamily: item.fontFamily,
        fontBold: draft?.fontBold ?? item.fontBold,
        fontItalic: draft?.fontItalic ?? item.fontItalic,
      };
      const fontSize = draft?.fontSize ?? item.fontSize;
      const measuredWidth = measureCanvasTextWidth(
        draft?.text || item.text || " ",
        fontSize,
        fontMetrics,
      );
      const session = pdfTextEditSessionRef.current;
      const nextWidth = Math.max(
        item.sourceWidth,
        item.width,
        measuredWidth,
        widthOverride ?? 0,
      );
      if (session) {
        session.previewCoverWidth = Math.max(session.previewCoverWidth, nextWidth);
      }
      paintPdfTextItemEditCoverOnContext(ctx, {
        ...item,
        fontSize,
        width: session?.previewCoverWidth ?? nextWidth,
      });
    },
    [activePdfTextEditItem],
  );

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
        const ctx = canvas.getContext("2d");
        paintPdfTextEditsOnCanvas(
          canvas,
          edits,
          pageIndex,
          dims,
          activePdfTextEditItem?.pageIndex === pageIndex
            ? activePdfTextEditItem.id
            : null,
        );
        redrawOverlay();
      } catch (error) {
        if (!isRenderCancelled(error)) throw error;
      }
    },
    [pdf, pageIndex, scale, onDimensions, redrawOverlay, activePdfTextEditItem],
  );

  const startPdfTextEdit = (item: PdfTextItem) => {
    const existingEdit = pdfTextEdits.find((e) => e.itemId === item.id);
    const style = editStyleFromItem(item, existingEdit);

    const canvas = pdfCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const sampledColor =
      ctx && typeof ImageData !== "undefined"
        ? sampleTextColorFromCanvas(ctx, item)
        : style.color;
    const resolvedColor = sampledColor || style.color || "#111827";

    const enriched = { ...item, ...style, color: resolvedColor };

    textColorByIdRef.current.set(item.id, resolvedColor);
    pdfTextEditSessionRef.current = {
      canvasFontSize: enriched.fontSize,
      pdfFontSize: enriched.pdfFontSize,
      previewCoverWidth: Math.max(enriched.sourceWidth, enriched.width),
    };
    setActivePdfTextEditItem(enriched);
    if (ctx) {
      paintPdfTextItemEditCoverOnContext(ctx, enriched);
    }
    setPdfTextItems((prev) => {
      const next = prev.map((entry) =>
        entry.id === item.id ? enriched : entry,
      );
      pdfTextItemsRef.current = next;
      return next;
    });

    onActivatePage();
    onEditingPdfTextIdChange(item.id);
    onSelectAnnotation(null);
    onEditingTextIdChange(null);
  };

  const commitActivePdfTextEdit = useCallback(() => {
    pdfTextEditRef.current?.commit();
  }, []);

  const flushPendingEdits = useCallback((): PageExportFlush => {
    const result: PageExportFlush = {
      pdfTextEdits: [],
      annotations: [],
      removedAnnotationIds: [],
    };

    if (editingPdfItem && editingPdfTextId && pdfTextEditRef.current) {
      const built = createPdfTextEdit(
        editingPdfItem,
        pdfTextEditRef.current.getDraft(),
        pageIndex,
        pageDimensions,
        pdfTextEdits,
        pdfTextEditSessionRef.current,
      );
      pdfTextEditRef.current.commit();
      if (built && !built.isUnchanged) {
        result.pdfTextEdits.push(built.edit);
      }
    }

    if (editingAnnotation && editingTextId && !editingPdfTextId && textOverlayRef.current) {
      const text = textOverlayRef.current.getValue();
      textOverlayRef.current.commit();
      const trimmed = text.trim();
      const existing = annotations.find((a) => a.id === editingTextId);

      if (!trimmed) {
        if (existing) result.removedAnnotationIds.push(editingTextId);
      } else if (existing?.type === "text") {
        result.annotations.push(updateTextContent(existing, trimmed));
      } else if (newTextDraft?.id === editingTextId) {
        result.annotations.push(updateTextContent(newTextDraft, trimmed));
      }
    }

    return result;
  }, [
    annotations,
    editingAnnotation,
    editingPdfItem,
    editingPdfTextId,
    editingTextId,
    newTextDraft,
    pageDimensions,
    pageIndex,
    pdfTextEdits,
  ]);

  useImperativeHandle(ref, () => ({ flushPendingEdits }), [flushPendingEdits]);

  const handlePdfTextDraftChange = useCallback(
    (draft: PdfNativeTextDraft) => {
      setActivePdfTextEditItem((prev) => {
        if (!prev) return prev;
        const fontMetrics = {
          fontFamily: prev.fontFamily,
          fontBold: draft.fontBold,
          fontItalic: draft.fontItalic,
        };
        const nextFontSize = draft.fontSize;
        const fontScale = nextFontSize / prev.fontSize;
        return {
          ...prev,
          text: draft.text,
          color: draft.color,
          fontSize: nextFontSize,
          fontBold: draft.fontBold,
          fontItalic: draft.fontItalic,
          pdfFontSize: prev.pdfFontSize * fontScale,
          width: Math.max(
            prev.sourceWidth,
            measureCanvasTextWidth(draft.text || " ", nextFontSize, fontMetrics),
          ),
        };
      });
      requestAnimationFrame(() => paintEditingPdfTextCover());
    },
    [paintEditingPdfTextCover],
  );

  const commitPdfTextEdit = (draft: PdfNativeTextDraft) => {
    if (!editingPdfItem) {
      setActivePdfTextEditItem(null);
      pdfTextEditSessionRef.current = null;
      onEditingPdfTextIdChange(null);
      return;
    }

    const trimmed = draft.text.trim();
    if (!trimmed) {
      setActivePdfTextEditItem(null);
      pdfTextEditSessionRef.current = null;
      onEditingPdfTextIdChange(null);
      void refreshPdfPageWithEdits(pdfTextEdits);
      return;
    }

    const built = createPdfTextEdit(
      editingPdfItem,
      draft,
      pageIndex,
      pageDimensions,
      pdfTextEdits,
      pdfTextEditSessionRef.current,
    );
    if (!built) {
      setActivePdfTextEditItem(null);
      pdfTextEditSessionRef.current = null;
      onEditingPdfTextIdChange(null);
      return;
    }

    const { edit, isUnchanged } = built;
    const fontMetrics = {
      fontFamily: editingPdfItem.fontFamily,
      fontBold: draft.fontBold,
      fontItalic: draft.fontItalic,
    };

    const nextEdits = isUnchanged
      ? pdfTextEdits.filter((e) => e.itemId !== edit.itemId)
      : [...pdfTextEdits.filter((e) => e.itemId !== edit.itemId), edit];

    onPdfTextEdit(edit);

    setPdfTextItems((prev) =>
      prev.map((item) => {
        if (item.id !== edit.itemId) return item;
        if (isUnchanged) {
          return {
            ...item,
            text: item.sourceText,
            width: item.sourceWidth,
          };
        }
        return {
          ...item,
          text: trimmed,
          color: draft.color,
          fontBold: draft.fontBold,
          fontItalic: draft.fontItalic,
          fontSize: draft.fontSize,
          pdfFontSize: edit.pdfFontSize,
          height: (editingPdfItem.matrixFontSize ?? draft.fontSize) * 1.05,
          y: editingPdfItem.y,
          width: Math.max(
            item.sourceWidth,
            measureCanvasTextWidth(trimmed, draft.fontSize, fontMetrics),
          ),
        };
      }),
    );

    void refreshPdfPageWithEdits(nextEdits);

    setActivePdfTextEditItem(null);
    pdfTextEditSessionRef.current = null;
    onEditingPdfTextIdChange(null);
    requestAnimationFrame(() => redrawOverlay());
  };

  const cancelPdfTextEdit = () => {
    setActivePdfTextEditItem(null);
    pdfTextEditSessionRef.current = null;
    onEditingPdfTextIdChange(null);
    void refreshPdfPageWithEdits(pdfTextEdits);
  };

  const handleCoverWidthChange = useCallback(
    (width: number) => {
      requestAnimationFrame(() => paintEditingPdfTextCover(width));
    },
    [paintEditingPdfTextCover],
  );

  useEffect(() => {
    if (!editingPdfItem) return;
    requestAnimationFrame(() => paintEditingPdfTextCover());
  }, [editingPdfItem, paintEditingPdfTextCover]);

  useEffect(() => {
    if (isActive) setIsVisible(true);
  }, [isActive]);

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

        const ctx = canvas.getContext("2d");
        const coloredItems =
          ctx && typeof ImageData !== "undefined"
            ? textItems.map((item) => {
                const cached = textColorByIdRef.current.get(item.id);
                const edit = pdfTextEdits.find((e) => e.itemId === item.id);
                if (edit?.color) {
                  textColorByIdRef.current.set(item.id, edit.color);
                  return { ...item, color: edit.color };
                }
                if (item.color) {
                  textColorByIdRef.current.set(item.id, item.color);
                  return item;
                }
                if (cached) return { ...item, color: cached };
                const sampled = sampleTextColorFromCanvas(ctx, item);
                textColorByIdRef.current.set(item.id, sampled);
                return { ...item, color: sampled };
              })
            : textItems;

        const mergedItems = coloredItems.map((item) => {
          const edit = pdfTextEdits.find((e) => e.itemId === item.id);
          if (!edit) return item;
          const style = editStyleFromItem(item, edit);
          textColorByIdRef.current.set(item.id, style.color!);
          return {
            ...item,
            text: edit.newText,
            ...style,
            width: Math.max(
              item.sourceWidth,
              measureCanvasTextWidth(edit.newText, item.fontSize, {
                fontFamily: style.fontFamily!,
                fontBold: style.fontBold!,
                fontItalic: style.fontItalic!,
              }),
            ),
          };
        });
        pdfTextItemsRef.current = mergedItems;
        setPdfTextItems(mergedItems);

        paintPdfTextEditsOnCanvas(
          canvas,
          pdfTextEdits,
          pageIndex,
          dims,
          activePdfTextEditItem?.pageIndex === pageIndex
            ? activePdfTextEditItem.id
            : null,
        );
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
  }, [shouldRenderPdf, pdf, pageIndex, scale, onDimensions, pdfTextEdits, activePdfTextEditItem]);

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
    const point = getPoint(e);

    if (tool === "editPdf") {
      const hit = hitTestPdfTextAt(point.x, point.y);
      if (!hit) {
        if (editingPdfTextId) commitActivePdfTextEdit();
        pdfTextClickPendingRef.current = null;
        return;
      }
      if (editingPdfTextId === hit.id) return;
      if (editingPdfTextId) commitActivePdfTextEdit();
      startPdfTextEdit(hit);
      pdfTextClickPendingRef.current = null;
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (editingPdfTextId) {
      commitActivePdfTextEdit();
    }

    if (tool === "eraser") {
      const hit = hitTestAnnotation(annotations, pageIndex, point.x, point.y);
      if (hit) {
        removeAnnotation(hit.id);
        if (selectedAnnotationId === hit.id) onSelectAnnotation(null);
        if (editingTextId === hit.id) onEditingTextIdChange(null);
        onHistoryCommit();
      }
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
      const hit = hitTestPdfTextAt(point.x, point.y);
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

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === "editPdf") {
      if (e?.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
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
      onHistoryCommit();
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "highlight" && highlightDraft && highlightDraft.width > 4) {
      const annotation = { ...highlightDraft, id: uuid() };
      addAnnotation(annotation);
      onSelectAnnotation(annotation.id);
      onHistoryCommit();
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
      onHistoryCommit();
    }
    setDraftPoints([]);
    currentDrawId.current = null;
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setHoveredPdfTextId(null);
    if (tool !== "editPdf" || !e.currentTarget.hasPointerCapture(e.pointerId)) {
      pdfTextClickPendingRef.current = null;
    }
    handlePointerUp(e);
  };

  const handleEditLayerPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (tool !== "editPdf" || !editingPdfItem) return;
    if ((e.target as HTMLElement).closest("[data-pdf-text-editor]")) return;

    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    const hit = hitTestPdfTextAt(point.x, point.y);
    if (hit) {
      if (editingPdfTextId !== hit.id) {
        if (editingPdfTextId) commitActivePdfTextEdit();
        startPdfTextEdit(hit);
      }
      return;
    }
    commitActivePdfTextEdit();
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
      className={`relative mb-6 max-w-[calc(100vw-1rem)] shadow-lg sm:mb-8 ${isActive ? "ring-2 ring-indigo-400" : ""}`}
      style={{ width: "fit-content", minHeight: shouldRenderPdf ? undefined : 320 }}
    >
      {!shouldRenderPdf && (
        <div className="flex h-64 w-full min-w-[280px] max-w-full items-center justify-center rounded bg-white text-sm text-zinc-400 sm:h-80 sm:w-[595px]">
          Page {pageIndex + 1} — scroll to load
        </div>
      )}
      <div
        className={shouldRenderPdf ? "relative" : "hidden"}
        onPointerDown={editingPdfItem ? handleEditLayerPointerDown : undefined}
      >
        <canvas ref={pdfCanvasRef} className="block max-w-full bg-white" />
        <canvas
          ref={overlayRef}
          className="absolute left-0 top-0 max-w-full touch-none"
          style={{
            cursor,
            pointerEvents: editingPdfItem ? "none" : "auto",
          }}
          {...pointerHandlers}
        />
        {editingPdfItem && (
          <PdfNativeTextInput
            ref={pdfTextEditRef}
            key={editingPdfItem.id}
            item={editingPdfItem}
            text={editingPdfDisplayText}
            onCommit={commitPdfTextEdit}
            onCancel={cancelPdfTextEdit}
            onCoverWidthChange={handleCoverWidthChange}
            onDraftChange={handlePdfTextDraftChange}
          />
        )}
        {editingAnnotation && !editingPdfTextId && (
          <TextAnnotationOverlay
            ref={textOverlayRef}
            key={editingAnnotation.id}
            annotation={editingAnnotation}
            isEditing
            isNew={newTextDraft?.id === editingAnnotation.id}
            onCommit={commitTextEdit}
            onCancel={cancelTextEdit}
            onPositionChange={(x, y) =>
              updateTextPosition(editingAnnotation.id, x, y)
            }
            onPositionCommit={onHistoryCommit}
          />
        )}
        {selectedTextAnnotation && (
          <TextAnnotationOverlay
            key={`drag-${selectedTextAnnotation.id}`}
            annotation={selectedTextAnnotation}
            onPositionChange={(x, y) =>
              updateTextPosition(selectedTextAnnotation.id, x, y)
            }
            onPositionCommit={onHistoryCommit}
          />
        )}
        <div className="pointer-events-none absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-white">
          {pageIndex + 1}
        </div>
        {pageAnnotations.length > 0 && (
          <p className="pointer-events-none absolute right-2 top-2 text-xs text-zinc-400 sm:-right-2 sm:-top-6">
            {pageAnnotations.length} edit{pageAnnotations.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
});
