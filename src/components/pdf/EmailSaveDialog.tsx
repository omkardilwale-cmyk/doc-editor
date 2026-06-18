"use client";

import { useEffect, useRef, useState } from "react";
import { isValidUserEmail } from "@/lib/auth/userEmail";

interface EmailSaveDialogProps {
  open: boolean;
  initialEmail?: string;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (email: string) => void;
}

export function EmailSaveDialog({
  open,
  initialEmail = "",
  saving = false,
  error = null,
  onClose,
  onConfirm,
}: EmailSaveDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);

  useEffect(() => {
    if (open) {
      setEmail(initialEmail);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open, initialEmail]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  const valid = isValidUserEmail(email);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-email-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="save-email-title" className="text-lg font-semibold text-zinc-900">
          Save to cloud
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your email to save this PDF. You can open it later from saved
          documents.
        </p>

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid || saving) return;
            onConfirm(email.trim());
          }}
        >
          <label htmlFor="save-email" className="sr-only">
            Email
          </label>
          <input
            ref={inputRef}
            id="save-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="your@email.com"
            disabled={saving}
            autoComplete="email"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-60"
          />

          {error && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
