import type { RenderTask } from "pdfjs-dist";

export function isRenderCancelled(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "RenderingCancelledException" ||
      error.message.includes("Rendering cancelled"))
  );
}

/** Cancel a pdf.js render and wait until the canvas is released. */
export async function cancelRenderTask(
  task: RenderTask | null | undefined,
): Promise<void> {
  if (!task) return;

  task.cancel();
  try {
    await task.promise;
  } catch (error) {
    if (!isRenderCancelled(error)) {
      throw error;
    }
  }
}
