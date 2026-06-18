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

function readPlainText(el: HTMLElement): string {
  return (el.innerText ?? el.textContent ?? "").replace(/\n/g, "");
}

function restoreCaret(el: HTMLElement, offset: number) {
  const textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
  const range = document.createRange();
  const nextOffset = Math.min(offset, textNode.textContent?.length ?? 0);
  range.setStart(textNode, nextOffset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function normalizeEditorPlainText(el: HTMLDivElement): string {
  const text = readPlainText(el);
  if (el.textContent !== text || el.querySelector("*")) {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const offset =
      range && el.contains(range.startContainer) ? range.startOffset : text.length;
    el.textContent = text;
    restoreCaret(el, offset);
  }
  return text;
}

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
    if (Date.now() - mountTimeRef.current < 200) return;
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
    if (readPlainText(el) !== draft.text) {
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
    const el = editorRef.current;
    if (!el) return;
    el.style.fontFamily = htmlFont.fontFamily;
    el.style.fontWeight = String(htmlFont.fontWeight);
    el.style.fontStyle = htmlFont.fontStyle;
    el.style.color = draft.color;
    el.style.caretColor = draft.color;
    el.style.fontSize = `${matrixFontSize}px`;
    el.style.lineHeight = `${matrixFontSize}px`;
    el.style.webkitTextStroke = draft.fontBold ? "0.06px currentColor" : "";
  }, [
    draft.color,
    draft.fontBold,
    htmlFont.fontFamily,
    htmlFont.fontStyle,
    htmlFont.fontWeight,
    matrixFontSize,
  ]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (committedRef.current) return;
      if (Date.now() - mountTimeRef.current < 200) return;
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
      data-pdf-text-editor
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
        tabIndex={0}
        suppressContentEditableWarning
        onInput={(e) => {
          const text = normalizeEditorPlainText(e.currentTarget);
          updateDraft({ text });
        }}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, pasted);
        }}
        className="m-0 whitespace-pre border-0 p-0 outline-none"
        style={{
          minWidth: layoutWidth,
          height: matrixFontSize,
          fontSize: matrixFontSize,
          lineHeight: `${matrixFontSize}px`,
          color: draft.color,
          backgroundColor: "#ffffff",
          fontFamily: htmlFont.fontFamily,
          fontWeight: htmlFont.fontWeight,
          fontStyle: htmlFont.fontStyle,
          letterSpacing: 0,
          boxSizing: "content-box",
          padding: "0 1px",
          margin: 0,
          caretColor: draft.color,
          fontSynthesis: "none",
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
