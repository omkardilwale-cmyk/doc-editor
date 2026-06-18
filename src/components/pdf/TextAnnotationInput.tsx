"use client";

import { useEffect, useRef } from "react";
import type { TextAnnotation } from "@/types/annotations";

interface TextAnnotationInputProps {
  annotation: TextAnnotation;
  isNew?: boolean;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function TextAnnotationInput({
  annotation,
  isNew = false,
  onCommit,
  onCancel,
}: TextAnnotationInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const focusInput = () => {
      input.focus();
      input.select();
    };

    // Delay focus so the opening click does not immediately blur the field.
    const timer = window.setTimeout(focusInput, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    if (Date.now() - mountTimeRef.current < 150) return;
    committedRef.current = true;
    onCommit(inputRef.current?.value ?? "");
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
      defaultValue={annotation.text}
      placeholder={isNew ? "Type here…" : undefined}
      className="absolute z-30 min-w-[120px] rounded border-2 border-indigo-500 bg-white px-1 shadow-md outline-none"
      style={{
        left: annotation.x,
        top: annotation.y,
        fontSize: annotation.fontSize,
        color: annotation.color,
        fontFamily: "sans-serif",
        lineHeight: 1.2,
        width: Math.max(annotation.width, 140),
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
