import type {
  Annotation,
  HighlightAnnotation,
  TextAnnotation,
} from "@/types/annotations";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function measureTextWidth(text: string, fontSize: number): number {
  return Math.max(text.length * fontSize * 0.6, fontSize);
}

export function getAnnotationBounds(annotation: Annotation): Bounds {
  switch (annotation.type) {
    case "text": {
      const height = annotation.fontSize * 1.2;
      const width =
        annotation.width ||
        measureTextWidth(annotation.text, annotation.fontSize);
      return { x: annotation.x, y: annotation.y, width, height };
    }
    case "highlight":
      return {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
      };
    case "draw": {
      if (annotation.points.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of annotation.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const pad = annotation.strokeWidth + 4;
      return {
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      };
    }
  }
}

export function moveAnnotation(
  annotation: Annotation,
  dx: number,
  dy: number,
): Annotation {
  switch (annotation.type) {
    case "text":
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy };
    case "highlight":
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy };
    case "draw":
      return {
        ...annotation,
        points: annotation.points.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        })),
      };
  }
}

export function resizeHighlightFromCorner(
  annotation: HighlightAnnotation,
  pointerX: number,
  pointerY: number,
): HighlightAnnotation {
  const width = Math.max(8, pointerX - annotation.x);
  const height = Math.max(8, pointerY - annotation.y);
  return { ...annotation, width, height };
}

export function updateTextContent(
  annotation: TextAnnotation,
  text: string,
): TextAnnotation {
  const trimmed = text.trim();
  return {
    ...annotation,
    text: trimmed,
    width: measureTextWidth(trimmed, annotation.fontSize),
  };
}

export function isPointInResizeHandle(
  bounds: Bounds,
  x: number,
  y: number,
  handleSize = 10,
): boolean {
  const handleX = bounds.x + bounds.width;
  const handleY = bounds.y + bounds.height;
  return (
    x >= handleX - handleSize &&
    x <= handleX + handleSize &&
    y >= handleY - handleSize &&
    y <= handleY + handleSize
  );
}
