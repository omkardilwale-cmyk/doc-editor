"use client";

import type { TextAnnotation } from "@/types/annotations";
import type { PdfTextItem } from "@/types/pdfText";

export type TextPropertiesSelection =
  | { kind: "pdf"; item: PdfTextItem }
  | { kind: "annotation"; annotation: TextAnnotation };

interface PdfTextPropertiesPanelProps {
  selection: TextPropertiesSelection;
  onClose: () => void;
}

function PropertyRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-zinc-100 py-2 text-sm last:border-0">
      <dt className="font-medium text-zinc-500">{label}</dt>
      <dd className="break-all text-zinc-900">
        {children ?? value ?? "—"}
      </dd>
    </div>
  );
}

function formatNum(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export function PdfTextPropertiesPanel({
  selection,
  onClose,
}: PdfTextPropertiesPanelProps) {
  const isPdf = selection.kind === "pdf";
  const item = isPdf ? selection.item : null;
  const annotation = !isPdf ? selection.annotation : null;

  const title = isPdf ? "PDF text properties" : "Annotation properties";
  const textContent = isPdf ? item!.text : annotation!.text;
  const pageLabel = isPdf
    ? String(item!.pageIndex + 1)
    : String(annotation!.pageIndex + 1);

  return (
    <aside
      className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:bottom-4 sm:left-auto sm:right-4 sm:max-h-[calc(100vh-6rem)] sm:w-80 sm:rounded-xl"
      role="dialog"
      aria-label={title}
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <dl className="px-4 pb-4">
        <PropertyRow label="Text" value={textContent || "(empty)"} />

        {isPdf && item && (
          <>
            <PropertyRow label="Source" value={item.sourceText} />
            <PropertyRow label="Font" value={item.fontFamily} />
            <PropertyRow
              label="Size"
              value={`${formatNum(item.fontSize)} px (canvas) · ${formatNum(item.pdfFontSize)} pt (PDF)`}
            />
            <PropertyRow
              label="Matrix size"
              value={`${formatNum(item.matrixFontSize)} px`}
            />
            <PropertyRow
              label="Style"
              value={[
                item.fontBold ? "Bold" : null,
                item.fontItalic ? "Italic" : null,
              ]
                .filter(Boolean)
                .join(", ") || "Regular"}
            />
            <PropertyRow label="Color">
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded border border-zinc-200"
                  style={{ backgroundColor: item.color ?? "#111827" }}
                />
                {item.color ?? "—"}
              </span>
            </PropertyRow>
            <PropertyRow label="Page" value={pageLabel} />
            <PropertyRow
              label="Position"
              value={`x ${formatNum(item.x)}, y ${formatNum(item.y)}`}
            />
            <PropertyRow
              label="PDF position"
              value={`x ${formatNum(item.pdfX)}, baseline ${formatNum(item.pdfBaselineY)}`}
            />
            <PropertyRow
              label="Size (box)"
              value={`${formatNum(item.width)} × ${formatNum(item.height)} px`}
            />
            <PropertyRow
              label="Baseline Y"
              value={formatNum(item.canvasBaselineY)}
            />
          </>
        )}

        {!isPdf && annotation && (
          <>
            <PropertyRow label="Font size" value={`${annotation.fontSize} px`} />
            <PropertyRow label="Color">
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded border border-zinc-200"
                  style={{ backgroundColor: annotation.color }}
                />
                {annotation.color}
              </span>
            </PropertyRow>
            <PropertyRow label="Page" value={pageLabel} />
            <PropertyRow
              label="Position"
              value={`x ${formatNum(annotation.x)}, y ${formatNum(annotation.y)}`}
            />
            <PropertyRow
              label="Width"
              value={`${formatNum(annotation.width)} px`}
            />
          </>
        )}
      </dl>
    </aside>
  );
}
