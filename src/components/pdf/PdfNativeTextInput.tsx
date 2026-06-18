"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { measureCanvasTextWidth } from "@/lib/pdf/extractPdfText";
import { resolveHtmlFontStyle } from "@/lib/pdf/pdfTextFont";
import type { PdfNativeTextDraft } from "@/types/pdfNativeTextEdit";
import type { PdfTextItem } from "@/types/pdfText";
import { PdfNativeTextFormatBar } from "./PdfNativeTextFormatBar";

export interface PdfNativeTextInputHandle {
  commit: () => void;
  cancel: () => void;
  getDraft: () => PdfNativeTextDraft;
}

interface PdfNativeTextInputProps {
  item: PdfTextItem;
  text: string;
  onCommit: (draft: PdfNativeTextDraft) => void;
  onCancel: () => void;
  onCoverWidthChange?: (width: number) => void;
  onDraftChange?: (draft: PdfNativeTextDraft) => void;
}

const TOOLBAR_GAP = 6;

export const PdfNativeTextInput = forwardRef<
  PdfNativeTextInputHandle,
  PdfNativeTextInputProps
>(function PdfNativeTextInput(
  {
    item,
    text,
    onCommit,
    onCancel,
    onCoverWidthChange,
    onDraftChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());

  const [draft, setDraft] = useState<PdfNativeTextDraft>(() => ({
    text,
    color: item.color ?? "#111827",
    fontSize:
      Number.isFinite(item.fontSize) && item.fontSize > 0 ? item.fontSize : 12,
    fontBold: item.fontBold,
    fontItalic: item.fontItalic,
  }));

  const matrixFontSize = item.matrixFontSize ?? draft.fontSize;
  const displayScale = draft.fontSize / matrixFontSize;
  const fontMetrics = {
    fontFamily: item.fontFamily,
    fontBold: draft.fontBold,
    fontItalic: draft.fontItalic,
  };
  const posX = Number.isFinite(item.x) ? item.x : 0;
  const posY = Number.isFinite(item.y) ? item.y : 0;
  const textWidth = measureCanvasTextWidth(
    draft.text || " ",
    draft.fontSize,
    fontMetrics,
  );
  const editorWidth = Math.max(textWidth + 4, item.width, draft.fontSize);
  const layoutWidth = editorWidth / displayScale;
  const htmlFont = resolveHtmlFontStyle(fontMetrics);

  const updateDraft = useCallback(
    (patch: Partial<PdfNativeTextDraft>) => {
      setDraft((prev) => {
        const next = { ...prev, ...patch };
        queueMicrotask(() => onDraftChange?.(next));
        return next;
      });
    },
    [onDraftChange],
  );

  const commit = useCallback(() => {
    if (committedRef.current) return;
    if (Date.now() - mountTimeRef.current < 80) return;
    committedRef.current = true;
    onCommit(draft);
  }, [draft, onCommit]);

  const cancel = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  }, [onCancel]);

  useImperativeHandle(ref, () => ({
    commit,
    cancel,
    getDraft: () => draft,
  }), [commit, cancel, draft]);

  useEffect(() => {
    onCoverWidthChange?.(editorWidth);
  }, [editorWidth, onCoverWidthChange]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.textContent !== draft.text) {
      el.textContent = draft.text;
    }
    const timer = window.setTimeout(() => {
      el.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (committedRef.current) return;
      const root = containerRef.current;
      if (!root || root.contains(event.target as Node)) return;
      commit();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [commit]);

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const related = event.relatedTarget as Node | null;
    if (containerRef.current?.contains(related)) return;
    commit();
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-40"
      style={{ left: posX, top: posY }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="pointer-events-auto absolute left-0 w-max"
        style={{ bottom: "100%", marginBottom: TOOLBAR_GAP }}
      >
        <PdfNativeTextFormatBar
          color={draft.color}
          fontSize={draft.fontSize}
          fontBold={draft.fontBold}
          fontItalic={draft.fontItalic}
          onColorChange={(color) => updateDraft({ color })}
          onFontSizeChange={(fontSize) => updateDraft({ fontSize })}
          onFontBoldChange={(fontBold) => updateDraft({ fontBold })}
          onFontItalicChange={(fontItalic) => updateDraft({ fontItalic })}
        />
      </div>
      <div
        ref={editorRef}
        role="textbox"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) =>
          updateDraft({ text: e.currentTarget.textContent ?? "" })
        }
        onPaste={(e) => {
          e.preventDefault();
          const pasted = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, pasted);
        }}
        className="m-0 whitespace-pre border-0 bg-transparent p-0 outline-none"
        style={{
          minWidth: layoutWidth,
          height: matrixFontSize,
          fontSize: matrixFontSize,
          lineHeight: `${matrixFontSize}px`,
          color: draft.color,
          fontFamily: htmlFont.fontFamily,
          fontWeight: htmlFont.fontWeight,
          fontStyle: htmlFont.fontStyle,
          letterSpacing: 0,
          boxSizing: "content-box",
          padding: 0,
          margin: 0,
          caretColor: draft.color,
          WebkitTextStroke: draft.fontBold ? "0.06px currentColor" : undefined,
          transform: displayScale !== 1 ? `scale(${displayScale})` : undefined,
          transformOrigin: "0% 100%",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
    </div>
  );
});
