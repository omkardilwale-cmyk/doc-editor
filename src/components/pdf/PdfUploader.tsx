"use client";

import { useCallback, useRef, useState } from "react";

interface PdfUploaderProps {
  onFileSelect: (file: File) => void;
}

export function PdfUploader({ onFileSelect }: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (file.type !== "application/pdf") {
        alert("Please upload a PDF file.");
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect],
  );

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex max-w-lg cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-12 py-16 text-center transition-colors ${
          isDragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-zinc-300 bg-white hover:border-indigo-400 hover:bg-zinc-50"
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-3xl text-indigo-600">
          PDF
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">
            Upload a PDF to start editing
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Drag and drop your file here, or click to browse. Add text,
            highlights, and drawings — then save or download.
          </p>
        </div>
        <span className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white">
          Choose PDF
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
