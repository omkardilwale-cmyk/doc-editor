"use client";

import { useEffect, useRef, useState } from "react";
import { measureCanvasTextWidth } from "@/lib/pdf/extractPdfText";
import { getPdfTextItemCoverBounds } from "@/lib/pdf/drawPdfTextEdits";
import { inputTopFromBaseline, resolveHtmlFontStyle } from "@/lib/pdf/pdfTextFont";
import type { PdfTextItem } from "@/types/pdfText";

interface PdfNativeTextInputProps {
  item: PdfTextItem;
  text: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
  onCoverWidthChange?: (width: number) => void;
}

export function PdfNativeTextInput({
  item,
  text,
  onCommit,
  onCancel,
  onCoverWidthChange,
}: PdfNativeTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const focusedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const [value, setValue] = useState(text);

  const fontMetrics = {
    fontFamily: item.fontFamily,
    fontBold: item.fontBold,
    fontItalic: item.fontItalic,
  };
  const fontSize =
    Number.isFinite(item.fontSize) && item.fontSize > 0 ? item.fontSize : 12;
  const baselineY = Number.isFinite(item.canvasBaselineY)
    ? item.canvasBaselineY
    : item.y + fontSize;
  const posX = Number.isFinite(item.x) ? item.x : 0;
  const posY = inputTopFromBaseline(baselineY, fontSize);
  const cover = getPdfTextItemCoverBounds(item);
  const textWidth = measureCanvasTextWidth(value || " ", fontSize, fontMetrics);
  const inputWidth = Math.max(textWidth + 4, item.width, fontSize);
  const textColor = item.color ?? "#111827";
  const htmlFont = resolveHtmlFontStyle(fontMetrics);

  useEffect(() => {
    onCoverWidthChange?.(inputWidth);
  }, [inputWidth, onCoverWidthChange]);

  useEffect(() => {
    setValue(text);
  }, [text]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const timer = window.setTimeout(() => {
      input.focus({ preventScroll: true });
      input.select();
      focusedRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    if (!focusedRef.current) return;
    if (Date.now() - mountTimeRef.current < 200) return;
    committedRef.current = true;
    onCommit(value);
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  return (
    <div
      className="absolute z-40 bg-white shadow-[0_0_0_2px_rgb(99_102_241)]"
      style={{
        left: cover.x,
        top: cover.top,
        width: Math.max(cover.width, inputWidth + (posX - cover.x) + 4),
        height: cover.height,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="absolute m-0 border-0 bg-transparent p-0"
        style={{
          left: posX - cover.x,
          top: posY - cover.top,
          width: inputWidth,
          height: fontSize,
          fontSize,
          lineHeight: `${fontSize}px`,
          color: textColor,
          fontFamily: htmlFont.fontFamily,
          fontWeight: htmlFont.fontWeight,
          fontStyle: htmlFont.fontStyle,
          letterSpacing: 0,
          boxSizing: "border-box",
          padding: 0,
          margin: 0,
        }}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onFocus={() => {
          focusedRef.current = true;
        }}
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
    </div>
  );
}
