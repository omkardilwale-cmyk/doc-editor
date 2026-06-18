"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { measureCanvasTextWidth } from "@/lib/pdf/extractPdfText";
import type { TextAnnotation } from "@/types/annotations";

export interface TextAnnotationOverlayHandle {
  getValue: () => string;
  commit: () => void;
}

interface TextAnnotationOverlayProps {
  annotation: TextAnnotation;
  /** Show inline text field (new or editing). */
  isEditing?: boolean;
  isNew?: boolean;
  onCommit?: (text: string) => void;
  onCancel?: () => void;
  onPositionChange: (x: number, y: number) => void;
  onPositionCommit?: () => void;
}

export const TextAnnotationOverlay = forwardRef<
  TextAnnotationOverlayHandle,
  TextAnnotationOverlayProps
>(function TextAnnotationOverlay(
  {
    annotation,
    isEditing = false,
    isNew = false,
    onCommit,
    onCancel,
    onPositionChange,
    onPositionCommit,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [value, setValue] = useState(annotation.text);
  const fontSize = annotation.fontSize;
  const posX = annotation.x;
  const posY = annotation.y;

  useEffect(() => {
    setValue(annotation.text);
  }, [annotation.text]);

  useEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;
    const timer = window.setTimeout(() => {
      input.focus();
      if (!isNew) input.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isEditing, isNew]);

  const commit = () => {
    if (!onCommit) return;
    if (committedRef.current) return;
    if (Date.now() - mountTimeRef.current < 150) return;
    committedRef.current = true;
    onCommit(value);
  };

  const cancel = () => {
    if (!onCancel) return;
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    commit,
  }), [commit, value]);

  const handleDragPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: posX,
      originY: posY,
    };
  };

  const handleDragPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    onPositionChange(
      dragRef.current.originX + dx,
      dragRef.current.originY + dy,
    );
  };

  const handleDragPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const moved =
      Math.hypot(
        e.clientX - dragRef.current.startX,
        e.clientY - dragRef.current.startY,
      ) > 2;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (moved) onPositionCommit?.();
  };

  const textWidth = measureCanvasTextWidth(
    value || (isNew ? " " : annotation.text),
    fontSize,
  );
  const inputWidth = Math.max(textWidth + 12, annotation.width, fontSize * 3);
  const boxHeight = fontSize * 1.2;

  return (
    <div
      className="absolute z-30"
      style={{
        left: posX,
        top: posY,
        height: boxHeight,
      }}
    >
      <div className="relative flex h-full items-start">
        <button
          type="button"
          title="Drag to move text"
          aria-label="Drag to move text"
          className={`absolute right-full top-0 flex h-full w-7 shrink-0 cursor-grab items-center justify-center border border-indigo-400 bg-indigo-50 text-indigo-700 active:cursor-grabbing hover:bg-indigo-100 ${
            isEditing ? "rounded-l-md border-r-0" : "rounded-md shadow-sm"
          }`}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </button>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isNew ? "Type here…" : undefined}
            className="m-0 rounded-sm bg-white p-0 shadow-sm outline outline-2 outline-indigo-500"
            style={{
              width: inputWidth,
              height: boxHeight,
              fontSize,
              lineHeight: `${fontSize}px`,
              color: annotation.color,
              fontFamily: "sans-serif",
              boxSizing: "content-box",
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
        ) : null}
      </div>
    </div>
  );
});
