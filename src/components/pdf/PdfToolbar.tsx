"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Annotation, EditTool } from "@/types/annotations";

const TOOLS: {
  id: EditTool;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "editPdf",
    label: "Edit PDF text",
    shortLabel: "Edit",
    description: "Click text already in the PDF to change it",
    icon: "Aa",
  },
  {
    id: "select",
    label: "Select",
    shortLabel: "Select",
    description: "Select, move, or delete your annotations",
    icon: "↖",
  },
  {
    id: "text",
    label: "Add text",
    shortLabel: "Text",
    description: "Place text; copies size from nearby PDF text",
    icon: "T",
  },
  {
    id: "highlight",
    label: "Highlight",
    shortLabel: "Mark",
    description: "Drag to highlight an area",
    icon: "▭",
  },
  {
    id: "draw",
    label: "Draw",
    shortLabel: "Draw",
    description: "Freehand pen drawing",
    icon: "✎",
  },
  {
    id: "eraser",
    label: "Eraser",
    shortLabel: "Erase",
    description: "Tap annotations to remove them",
    icon: "⌫",
  },
];

function ToolbarTooltip({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const updateCoords = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }, []);

  const show = () => updateCoords();
  const hide = () => setCoords(null);

  useEffect(() => {
    if (!coords) return;

    const dismiss = () => setCoords(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [coords]);

  return (
    <>
      <div
        ref={anchorRef}
        className="relative"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </div>
      {coords &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-lg bg-zinc-900 px-2.5 py-1.5 text-center shadow-lg"
            style={{ left: coords.x, top: coords.y }}
          >
            <p className="text-xs font-medium text-white">{label}</p>
            {description ? (
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-300">
                {description}
              </p>
            ) : null}
            <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-zinc-900" />
          </div>,
          document.body,
        )}
    </>
  );
}

interface PdfToolbarProps {
  tool: EditTool;
  onToolChange: (tool: EditTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  fileName: string;
  onUploadNew: () => void;
  onSave: () => void;
  onDownload: () => void;
  isSaving: boolean;
  isDownloading?: boolean;
  selectedAnnotation: Annotation | null;
  onEditSelectedText: () => void;
  onDeleteSelected: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function PdfToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  fontSize,
  onFontSizeChange,
  scale,
  onScaleChange,
  pageCount,
  currentPage,
  onPageChange,
  fileName,
  onUploadNew,
  onSave,
  onDownload,
  isSaving,
  isDownloading = false,
  selectedAnnotation,
  onEditSelectedText,
  onDeleteSelected,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: PdfToolbarProps) {
  const showAnnotationFontSize =
    tool === "text" ||
    (selectedAnnotation?.type === "text" && tool === "select");

  return (
    <header className="sticky top-0 z-30 overflow-visible border-b border-zinc-200 bg-white/95 backdrop-blur">
      {/* File name + primary actions */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{fileName}</p>
          <p className="text-xs text-zinc-500">
            Page {currentPage + 1} of {pageCount}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onUploadNew}
            className="hidden rounded-lg border border-zinc-200 px-2.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:inline-flex"
          >
            New file
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {isSaving ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {isDownloading ? "…" : "Get PDF"}
          </button>
        </div>
      </div>

      {/* Scrollable tools + controls */}
      <div className="overflow-x-auto border-t border-zinc-100 overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:border-t-0 [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full items-center gap-2 px-3 py-2 sm:w-auto sm:flex-wrap sm:px-4 sm:pb-3">
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            {TOOLS.map((t) => (
              <ToolbarTooltip key={t.id} label={t.label} description={t.description}>
                <button
                  type="button"
                  aria-label={t.label}
                  onClick={() => onToolChange(t.id)}
                className={`flex h-10 min-w-10 flex-col items-center justify-center rounded-md px-2 text-sm font-medium transition-colors sm:h-auto sm:min-w-0 sm:flex-row sm:px-3 sm:py-1.5 ${
                  tool === t.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <span aria-hidden>{t.icon}</span>
                <span className="mt-0.5 text-[9px] leading-none sm:hidden">
                  {t.shortLabel}
                </span>
              </button>
              </ToolbarTooltip>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            <ToolbarTooltip label="Undo" description="Undo last change">
              <button
                type="button"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={onUndo}
              className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5"
            >
              ↶
            </button>
            </ToolbarTooltip>
            <ToolbarTooltip label="Redo" description="Redo">
              <button
                type="button"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={onRedo}
              className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5"
            >
              ↷
            </button>
            </ToolbarTooltip>
          </div>

          <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-600 sm:text-sm">
            <span className="hidden sm:inline">Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-9 w-9 cursor-pointer rounded border border-zinc-200 sm:h-8 sm:w-10"
              aria-label="Color"
            />
          </label>

          {showAnnotationFontSize && (
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600 sm:text-sm">
              <span>Size</span>
              <input
                type="number"
                min={8}
                max={72}
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className="w-14 rounded border border-zinc-200 px-2 py-1.5 text-sm sm:w-16"
              />
            </label>
          )}

          {selectedAnnotation && tool === "select" && (
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1">
              {selectedAnnotation.type === "text" && (
                <button
                  type="button"
                  onClick={onEditSelectedText}
                  className="rounded px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={onDeleteSelected}
                className="rounded px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-1 py-1">
            <button
              type="button"
              onClick={() => onScaleChange(Math.max(0.5, scale - 0.25))}
              className="flex h-9 w-9 items-center justify-center rounded text-lg hover:bg-zinc-100"
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </button>
            <span className="w-10 text-center text-xs text-zinc-600 sm:w-12 sm:text-sm">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => onScaleChange(Math.min(3, scale + 0.25))}
              className="flex h-9 w-9 items-center justify-center rounded text-lg hover:bg-zinc-100"
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={currentPage <= 0}
              onClick={() => onPageChange(currentPage - 1)}
              className="rounded border border-zinc-200 px-2.5 py-1.5 text-sm disabled:opacity-40"
              aria-label="Previous page"
              title="Previous page"
            >
              ‹
            </button>
            <span className="text-xs text-zinc-600 sm:text-sm">
              {currentPage + 1}/{pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => onPageChange(currentPage + 1)}
              className="rounded border border-zinc-200 px-2.5 py-1.5 text-sm disabled:opacity-40"
              aria-label="Next page"
              title="Next page"
            >
              ›
            </button>
          </div>

          <button
            type="button"
            onClick={onUploadNew}
            className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 sm:hidden"
          >
            New file
          </button>
        </div>
      </div>
    </header>
  );
}
