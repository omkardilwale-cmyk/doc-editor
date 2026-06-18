import type { Annotation } from "@/types/annotations";
import { getAnnotationBounds } from "@/lib/pdf/annotationUtils";

export { getAnnotationBounds, measureTextWidth } from "@/lib/pdf/annotationUtils";

export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
) {
  const pad = 3;
  ctx.save();
  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(
    bounds.x - pad,
    bounds.y - pad,
    bounds.width + pad * 2,
    bounds.height + pad * 2,
  );
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawResizeHandle(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
) {
  const size = 8;
  const x = bounds.x + bounds.width - size / 2;
  const y = bounds.y + bounds.height - size / 2;
  ctx.save();
  ctx.fillStyle = "#4f46e5";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, y, size, size);
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
}

export function drawAnnotationsOnCanvas(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  pageIndex: number,
  selectedId?: string | null,
  hiddenTextId?: string | null,
) {
  for (const annotation of annotations) {
    if (annotation.pageIndex !== pageIndex) continue;

    switch (annotation.type) {
      case "text": {
        if (annotation.id === hiddenTextId) break;
        ctx.font = `${annotation.fontSize}px sans-serif`;
        ctx.fillStyle = annotation.color;
        ctx.fillText(annotation.text, annotation.x, annotation.y + annotation.fontSize);
        break;
      }
      case "highlight": {
        ctx.fillStyle = annotation.color;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height,
        );
        ctx.globalAlpha = 1;
        break;
      }
      case "draw": {
        if (annotation.points.length < 2) break;
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = annotation.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
        for (let i = 1; i < annotation.points.length; i++) {
          ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
        }
        ctx.stroke();
        break;
      }
    }
  }

  if (selectedId) {
    const selected = annotations.find((a) => a.id === selectedId);
    if (selected && selected.pageIndex === pageIndex) {
      const bounds = getAnnotationBounds(selected);
      drawSelectionBox(ctx, bounds);
      if (selected.type === "highlight") {
        drawResizeHandle(ctx, bounds);
      }
    }
  }
}

export function hitTestAnnotation(
  annotations: Annotation[],
  pageIndex: number,
  x: number,
  y: number,
): Annotation | null {
  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex);

  for (let i = pageAnnotations.length - 1; i >= 0; i--) {
    const a = pageAnnotations[i];
    const bounds = getAnnotationBounds(a);
    if (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    ) {
      return a;
    }
  }

  return null;
}
