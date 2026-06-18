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

  const textWidth = measureCanvasTextWidth(value || " ", item.fontSize);
  const originalWidth = item.width;
  const inputWidth = Math.max(textWidth + 6, originalWidth, item.fontSize);

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
      className="absolute z-30 m-0 rounded-sm bg-white p-0 shadow-sm outline outline-2 outline-indigo-500"
      style={{
        left: item.x,
        top: item.y,
        width: inputWidth,
        height: item.height,
        fontSize: item.fontSize,
        lineHeight: `${item.fontSize}px`,
        color: "#111827",
        fontFamily: "sans-serif",
        boxSizing: "content-box",
        padding: 0,
        margin: 0,
        border: "none",
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
