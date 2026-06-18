import { useCallback, useRef, useState } from "react";
import type { Annotation } from "@/types/annotations";
import type { PdfTextEdit } from "@/types/pdfText";

export const MAX_UNDO_STEPS = 10;

export interface EditorSnapshot {
  annotations: Annotation[];
  pdfTextEdits: PdfTextEdit[];
}

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as EditorSnapshot;
}

function snapshotsEqual(a: EditorSnapshot, b: EditorSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useEditorHistory() {
  const historyRef = useRef<EditorSnapshot[]>([
    { annotations: [], pdfTextEdits: [] },
  ]);
  const indexRef = useRef(0);
  const isRestoringRef = useRef(false);
  const [revision, setRevision] = useState(0);

  const sync = () => setRevision((value) => value + 1);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  const reset = useCallback((snapshot: EditorSnapshot) => {
    historyRef.current = [cloneSnapshot(snapshot)];
    indexRef.current = 0;
    sync();
  }, []);

  const push = useCallback((snapshot: EditorSnapshot) => {
    if (isRestoringRef.current) return;

    const cloned = cloneSnapshot(snapshot);
    const history = historyRef.current;
    const current = history[indexRef.current];
    if (current && snapshotsEqual(current, cloned)) return;

    const truncated = history.slice(0, indexRef.current + 1);
    truncated.push(cloned);
    while (truncated.length > MAX_UNDO_STEPS + 1) {
      truncated.shift();
    }

    historyRef.current = truncated;
    indexRef.current = truncated.length - 1;
    sync();
  }, []);

  const undo = useCallback((): EditorSnapshot | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current -= 1;
    sync();
    return cloneSnapshot(historyRef.current[indexRef.current]);
  }, []);

  const redo = useCallback((): EditorSnapshot | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    indexRef.current += 1;
    sync();
    return cloneSnapshot(historyRef.current[indexRef.current]);
  }, []);

  const beginRestore = useCallback(() => {
    isRestoringRef.current = true;
  }, []);

  const endRestore = useCallback(() => {
    isRestoringRef.current = false;
  }, []);

  return {
    revision,
    canUndo,
    canRedo,
    reset,
    push,
    undo,
    redo,
    beginRestore,
    endRestore,
  };
}
