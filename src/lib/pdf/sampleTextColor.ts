import type { PdfTextItem } from "@/types/pdfText";

const DEFAULT_TEXT_COLOR = "#111827";

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function aggregateForeground(samples: [number, number, number][]): string {
  if (samples.length === 0) return DEFAULT_TEXT_COLOR;

  const scored = samples.map(([r, g, b]) => ({
    r,
    g,
    b,
    score: Math.hypot(255 - r, 255 - g, 255 - b),
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.35)));
  const r = Math.round(best.reduce((sum, c) => sum + c.r, 0) / best.length);
  const g = Math.round(best.reduce((sum, c) => sum + c.g, 0) / best.length);
  const b = Math.round(best.reduce((sum, c) => sum + c.b, 0) / best.length);

  return toHex(r, g, b);
}

function isBackgroundPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 40) return true;
  return r > 235 && g > 235 && b > 235;
}

/** Fallback glyph color sampling from a rendered PDF canvas. */
export function sampleTextColorFromCanvas(
  ctx: CanvasRenderingContext2D,
  item: Pick<
    PdfTextItem,
    "x" | "y" | "width" | "height" | "fontSize" | "canvasBaselineY"
  >,
): string {
  const canvas = ctx.canvas;
  const startX = Math.max(0, Math.floor(item.x));
  const endX = Math.min(canvas.width - 1, Math.ceil(item.x + item.width));

  const baselineY =
    item.canvasBaselineY ?? item.y + item.height * 0.82;
  const rowTop = Math.max(
    0,
    Math.floor(baselineY - item.fontSize * 0.82),
  );
  const rowBottom = Math.min(
    canvas.height - 1,
    Math.ceil(baselineY - item.fontSize * 0.12),
  );

  if (endX <= startX || rowBottom <= rowTop) return DEFAULT_TEXT_COLOR;

  const samples: [number, number, number][] = [];
  const stepX = Math.max(1, Math.floor((endX - startX) / 16));

  for (let y = rowTop; y <= rowBottom; y += 1) {
    for (let x = startX; x <= endX; x += stepX) {
      try {
        const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
        if (isBackgroundPixel(r, g, b, a)) continue;
        samples.push([r, g, b]);
      } catch {
        return DEFAULT_TEXT_COLOR;
      }
    }
  }

  return aggregateForeground(samples);
}

export function resolvePdfTextColor(
  item: PdfTextItem,
  editColor?: string,
  cachedColor?: string,
): string {
  return editColor ?? item.color ?? cachedColor ?? DEFAULT_TEXT_COLOR;
}
