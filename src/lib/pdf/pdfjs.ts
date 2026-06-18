import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { PageDimensions } from "@/types/annotations";
import { cancelRenderTask } from "@/lib/pdf/renderTask";

let workerInitialized = false;

export async function loadPdfDocument(
  data: ArrayBuffer,
): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");

  if (!workerInitialized && typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerInitialized = true;
  }

  const loadingTask = pdfjs.getDocument({ data });
  return loadingTask.promise;
}

export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  displayCanvas: HTMLCanvasElement,
  scale: number,
  activeTaskRef?: { current: RenderTask | null },
): Promise<PageDimensions> {
  await cancelRenderTask(activeTaskRef?.current ?? null);
  if (activeTaskRef) activeTaskRef.current = null;

  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const pdfViewport = page.getViewport({ scale: 1 });

  // pdf.js binds one render per canvas — use a disposable offscreen canvas.
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = viewport.width;
  renderCanvas.height = viewport.height;

  const renderContext = renderCanvas.getContext("2d");
  if (!renderContext) {
    throw new Error("Could not get offscreen canvas context");
  }

  const renderTask = page.render({
    canvasContext: renderContext,
    viewport,
    canvas: renderCanvas,
  });

  if (activeTaskRef) activeTaskRef.current = renderTask;

  try {
    await renderTask.promise;
  } finally {
    if (activeTaskRef?.current === renderTask) {
      activeTaskRef.current = null;
    }
  }

  displayCanvas.width = viewport.width;
  displayCanvas.height = viewport.height;

  const displayContext = displayCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!displayContext) {
    throw new Error("Could not get display canvas context");
  }

  displayContext.drawImage(renderCanvas, 0, 0);

  return {
    width: viewport.width,
    height: viewport.height,
    pdfWidth: pdfViewport.width,
    pdfHeight: pdfViewport.height,
  };
}
