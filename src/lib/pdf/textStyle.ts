import type { PdfTextItem } from "@/types/pdfText";
import { hitTestPdfTextItem } from "@/lib/pdf/extractPdfText";

export interface InheritedTextStyle {
  fontSize: number;
  color: string;
}

export interface InheritedTextPlacement extends InheritedTextStyle {
  x: number;
  y: number;
}

const DEFAULT_TEXT_STYLE: InheritedTextStyle = {
  fontSize: 12,
  color: "#111827",
};

function safeMin(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  return Math.min(...finite);
}

function resolveNearestPdfTextLine(
  items: PdfTextItem[],
  x: number,
  y: number,
): { y: number; fontSize: number } | null {
  if (items.length === 0) return null;

  const hit = hitTestPdfTextItem(items, x, y);
  if (hit && Number.isFinite(hit.y) && Number.isFinite(hit.fontSize)) {
    return { y: hit.y, fontSize: hit.fontSize };
  }

  const lines = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    if (!Number.isFinite(item.canvasBaselineY)) continue;
    const key = Math.round(item.canvasBaselineY * 10);
    const group = lines.get(key) ?? [];
    group.push(item);
    lines.set(key, group);
  }

  let bestGroup: PdfTextItem[] | null = null;
  let bestDist = Infinity;

  for (const group of lines.values()) {
    const lineTop = safeMin(group.map((i) => i.y));
    const lineBottom = Math.max(
      ...group.map((i) => i.y + i.height).filter((v) => Number.isFinite(v)),
    );
    if (lineTop === null || !Number.isFinite(lineBottom)) continue;

    const dist =
      y < lineTop ? lineTop - y : y > lineBottom ? y - lineBottom : 0;

    if (dist < bestDist) {
      bestDist = dist;
      bestGroup = group;
    } else if (dist === bestDist && bestGroup) {
      const leftMost = Math.min(...group.map((i) => i.x));
      const bestLeft = Math.min(...bestGroup.map((i) => i.x));
      if (leftMost <= x && leftMost > bestLeft) {
        bestGroup = group;
      }
    }
  }

  if (!bestGroup) return null;

  const snapThreshold = Math.max(48, (bestGroup[0].fontSize || 12) * 2.5);
  if (bestDist > snapThreshold) return null;

  const yTop = safeMin(bestGroup.map((i) => i.y));
  if (yTop === null) return null;

  const fontSize =
    bestGroup.reduce((sum, i) => sum + (i.fontSize || 12), 0) /
    bestGroup.length;

  return { y: yTop, fontSize };
}

/** Copy style and snap Y to the nearest PDF text line; keep X at the click. */
export function inheritTextPlacementFromPdf(
  items: PdfTextItem[],
  clickX: number,
  clickY: number,
): InheritedTextPlacement {
  const line = resolveNearestPdfTextLine(items, clickX, clickY);

  if (line && Number.isFinite(line.y) && Number.isFinite(line.fontSize)) {
    return {
      x: clickX,
      y: line.y,
      fontSize: line.fontSize,
      color: "#111827",
    };
  }

  return {
    x: clickX,
    y: clickY,
    fontSize: DEFAULT_TEXT_STYLE.fontSize,
    color: DEFAULT_TEXT_STYLE.color,
  };
}

/** @deprecated Use inheritTextPlacementFromPdf for new text placement. */
export function inheritTextStyleFromPdf(
  items: PdfTextItem[],
  x: number,
  y: number,
): InheritedTextStyle {
  const placement = inheritTextPlacementFromPdf(items, x, y);
  return { fontSize: placement.fontSize, color: placement.color };
}
