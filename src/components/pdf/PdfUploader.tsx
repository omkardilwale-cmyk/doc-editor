"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteStoredDocument,
  fetchDocumentSummaries,
} from "@/lib/api/documents";
import { useUserEmail } from "@/hooks/useUserEmail";
import type { StoredDocumentSummary } from "@/types/storedDocument";

interface PdfUploaderProps {
  onFileSelect: (file: File) => void;
  onOpenDocument: (id: string) => void;
}

export function PdfUploader({ onFileSelect, onOpenDocument }: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { email, ready, isValid } = useUserEmail();
  const [isDragging, setIsDragging] = useState(false);
  const [storageConfigured, setStorageConfigured] = useState(false);
  const [documents, setDocuments] = useState<StoredDocumentSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshDocuments = useCallback(async () => {
    if (!isValid) {
      setLoadingDocs(false);
      setDocuments([]);
      return;
    }
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const { configured, documents: list } = await fetchDocumentSummaries(email);
      setStorageConfigured(configured);
      setDocuments(list);
    } catch (error) {
      setStorageConfigured(false);
      setDocuments([]);
      setDocsError(
        error instanceof Error ? error.message : "Could not load saved PDFs",
      );
    } finally {
      setLoadingDocs(false);
    }
  }, [email, isValid]);

  useEffect(() => {
    if (!ready) return;
    void refreshDocuments();
  }, [ready, refreshDocuments]);

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

  const handleDelete = async (id: string) => {
    if (!isValid) return;
    if (!confirm("Delete this saved PDF?")) return;
    setDeletingId(id);
    try {
      await deleteStoredDocument(id, email);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="flex flex-1 flex-col items-center gap-8 p-8">
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
        className={`flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-12 py-16 text-center transition-colors ${
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
            highlights, and drawings — then download.
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

      {storageConfigured && (
        <section className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-zinc-900">Saved documents</h3>
              <p className="text-sm text-zinc-500">
                {isValid
                  ? `PDFs saved for ${email}.`
                  : "Save a PDF with your email to see your documents here."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshDocuments()}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Refresh
            </button>
          </div>

          {loadingDocs ? (
            <p className="mt-4 text-sm text-zinc-500">Loading saved PDFs…</p>
          ) : !isValid ? (
            <p className="mt-4 text-sm text-zinc-500">
              Save a PDF with your email to load your saved documents.
            </p>
          ) : docsError ? (
            <p className="mt-4 text-sm text-amber-700">{docsError}</p>
          ) : documents.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No saved PDFs yet. Upload a file and click Save.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100">
              {documents.map((doc) => (
                <li
                  key={doc._id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <button
                    type="button"
                    onClick={() => onOpenDocument(doc._id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-medium text-zinc-900 hover:text-indigo-600">
                      {doc.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Updated {formatDate(doc.updatedAt)}
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === doc._id}
                    onClick={() => void handleDelete(doc._id)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === doc._id ? "…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
