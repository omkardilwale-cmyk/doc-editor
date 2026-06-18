import type { PdfTextItem } from "@/types/pdfText";

const DEFAULT_TEXT_COLOR = "#111827";

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function isBackgroundPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 40) return true;
  return r > 235 && g > 235 && b > 235;
}

/** Sample glyph color from a freshly rendered PDF canvas (before overlays). */
export function sampleTextColorFromCanvas(
  ctx: CanvasRenderingContext2D,
  item: Pick<PdfTextItem, "x" | "y" | "width" | "height" | "fontSize">,
): string {
  const canvas = ctx.canvas;
  const startX = Math.max(0, Math.floor(item.x));
  const endX = Math.min(canvas.width - 1, Math.ceil(item.x + item.width));
  const startY = Math.max(0, Math.floor(item.y));
  const endY = Math.min(canvas.height - 1, Math.ceil(item.y + item.height));

  if (endX <= startX || endY <= startY) return DEFAULT_TEXT_COLOR;

  const samples: [number, number, number][] = [];
  const stepX = Math.max(1, Math.floor((endX - startX) / 10));
  const stepY = Math.max(1, Math.floor((endY - startY) / 4));

  for (let y = startY; y <= endY; y += stepY) {
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

  if (samples.length === 0) return DEFAULT_TEXT_COLOR;

  const r = Math.round(samples.reduce((sum, c) => sum + c[0], 0) / samples.length);
  const g = Math.round(samples.reduce((sum, c) => sum + c[1], 0) / samples.length);
  const b = Math.round(samples.reduce((sum, c) => sum + c[2], 0) / samples.length);

  return toHex(r, g, b);
}

export function resolvePdfTextColor(
  item: PdfTextItem,
  editColor?: string,
  cachedColor?: string,
): string {
  return editColor ?? item.color ?? cachedColor ?? DEFAULT_TEXT_COLOR;
}
