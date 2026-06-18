"use client";

import { useEffect, useRef, useState } from "react";
import { measureCanvasTextWidth } from "@/lib/pdf/extractPdfText";
import type { PdfTextItem } from "@/types/pdfText";

interface PdfNativeTextInputProps {
  item: PdfTextItem;
  text: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function PdfNativeTextInput({
  item,
  text,
  onCommit,
  onCancel,
}: PdfNativeTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const [value, setValue] = useState(text);

  const fontMetrics = {
    fontFamily: item.fontFamily,
    fontBold: item.fontBold,
    fontItalic: item.fontItalic,
  };
  const textWidth = measureCanvasTextWidth(value || " ", item.fontSize, fontMetrics);
  const inputWidth = Math.max(textWidth + 6, item.width, item.fontSize);
  const lineHeight = item.fontSize * (item.ascent - item.descent);
  const textColor = item.color ?? "#111827";

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const timer = window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    if (Date.now() - mountTimeRef.current < 150) return;
    committedRef.current = true;
    onCommit(value);
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="absolute z-30 m-0 rounded-sm bg-transparent p-0 caret-current outline outline-1 outline-indigo-400/70 focus:outline-2 focus:outline-indigo-500"
      style={{
        left: item.x,
        top: item.y,
        width: inputWidth,
        height: item.height,
        fontSize: item.fontSize,
        lineHeight: `${lineHeight}px`,
        color: textColor,
        fontFamily: item.fontFamily,
        fontWeight: item.fontBold ? "bold" : "normal",
        fontStyle: item.fontItalic ? "italic" : "normal",
        boxSizing: "content-box",
        padding: 0,
        margin: 0,
        border: "none",
        background: "transparent",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => commit()}
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
  );
}
