"use client";

import type { ReactNode } from "react";
import type { Annotation, EditTool } from "@/types/annotations";

const TOOLS: {
  id: EditTool;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "editPdf",
    label: "Edit PDF text",
    description: "Click text already in the PDF to change it",
    icon: "Aa",
  },
  {
    id: "select",
    label: "Select",
    description: "Select, move, or delete your annotations",
    icon: "↖",
  },
  {
    id: "text",
    label: "Add text",
    description: "Place text; copies size from nearby PDF text. Drag the grip to move.",
    icon: "T",
  },
  {
    id: "highlight",
    label: "Highlight",
    description: "Drag to highlight an area",
    icon: "▭",
  },
  {
    id: "draw",
    label: "Draw",
    description: "Freehand pen drawing",
    icon: "✎",
  },
  {
    id: "eraser",
    label: "Eraser",
    description: "Click annotations to remove them",
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
  return (
    <div className="group/tooltip relative">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-center opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-visible/tooltip:opacity-100"
      >
        <p className="text-xs font-medium text-white">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-300">
            {description}
          </p>
        ) : null}
        <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-zinc-900" />
      </div>
    </div>
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
  selectedAnnotation,
  onEditSelectedText,
  onDeleteSelected,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: PdfToolbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{fileName}</p>
          <p className="text-xs text-zinc-500">PDF Editor</p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          {TOOLS.map((t) => (
            <ToolbarTooltip key={t.id} label={t.label} description={t.description}>
              <button
                type="button"
                aria-label={t.label}
                onClick={() => onToolChange(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tool === t.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <span aria-hidden>{t.icon}</span>
              </button>
            </ToolbarTooltip>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          <ToolbarTooltip
            label="Undo"
            description="Undo last change (⌘Z / Ctrl+Z)"
          >
            <button
              type="button"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={onUndo}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↶
            </button>
          </ToolbarTooltip>
          <ToolbarTooltip
            label="Redo"
            description="Redo (⌘⇧Z / Ctrl+Shift+Z)"
          >
            <button
              type="button"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={onRedo}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↷
            </button>
          </ToolbarTooltip>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Color
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-zinc-200"
          />
        </label>

        {(tool === "text" ||
          (selectedAnnotation?.type === "text" && tool === "select")) && (
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            Size
            <input
              type="number"
              min={8}
              max={72}
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              className="w-16 rounded border border-zinc-200 px-2 py-1 text-sm"
            />
          </label>
        )}

        {selectedAnnotation && tool === "select" && (
          <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1">
            <span className="text-xs font-medium text-indigo-700">Selected</span>
            {selectedAnnotation.type === "text" && (
              <button
                type="button"
                onClick={onEditSelectedText}
                className="rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                Edit text
              </button>
            )}
            <button
              type="button"
              onClick={onDeleteSelected}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1">
          <button
            type="button"
            onClick={() => onScaleChange(Math.max(0.5, scale - 0.25))}
            className="rounded px-2 py-1 text-sm hover:bg-zinc-100"
          >
            −
          </button>
          <span className="w-12 text-center text-sm text-zinc-600">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onScaleChange(Math.min(3, scale + 0.25))}
            className="rounded px-2 py-1 text-sm hover:bg-zinc-100"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 0}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded border border-zinc-200 px-2 py-1 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-zinc-600">
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded border border-zinc-200 px-2 py-1 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onUploadNew}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            New file
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Download
          </button>
        </div>
      </div>
    </header>
  );
}
