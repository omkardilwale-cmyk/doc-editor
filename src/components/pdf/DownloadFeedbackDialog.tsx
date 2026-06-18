"use client";

import { useEffect, useState } from "react";

interface DownloadFeedbackDialogProps {
  open: boolean;
  saving?: boolean;
  downloading?: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  onSkip: () => void;
}

const STAR_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];

export function DownloadFeedbackDialog({
  open,
  saving = false,
  downloading = false,
  onClose,
  onSubmit,
  onSkip,
}: DownloadFeedbackDialogProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const busy = saving || downloading;

  useEffect(() => {
    if (open) {
      setRating(0);
      setHovered(0);
      setComment("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const active = hovered || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-feedback-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="download-feedback-title"
          className="text-lg font-semibold text-zinc-900"
        >
          How was your experience?
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Rate the app before your download. Your feedback helps us improve.
        </p>

        <div className="mt-5 flex flex-col items-center gap-2">
          <div
            className="flex items-center gap-1"
            onMouseLeave={() => setHovered(0)}
            role="radiogroup"
            aria-label="Star rating"
          >
            {STAR_LABELS.map((label, index) => {
              const value = index + 1;
              const filled = value <= active;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"} — ${label}`}
                  disabled={busy}
                  onMouseEnter={() => setHovered(value)}
                  onClick={() => setRating(value)}
                  className="rounded p-1 text-3xl leading-none transition-transform hover:scale-110 disabled:opacity-50 sm:text-4xl"
                >
                  <span className={filled ? "text-amber-400" : "text-zinc-300"}>
                    ★
                  </span>
                </button>
              );
            })}
          </div>
          <p className="h-5 text-sm font-medium text-zinc-600">
            {active > 0 ? STAR_LABELS[active - 1] : "Tap a star to rate"}
          </p>
        </div>

        <label htmlFor="download-feedback-comment" className="mt-4 block">
          <span className="text-sm font-medium text-zinc-700">
            Comments <span className="font-normal text-zinc-400">(optional)</span>
          </span>
          <textarea
            id="download-feedback-comment"
            name="download-feedback-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={busy}
            placeholder="Tell us what worked well or what we can improve…"
            rows={3}
            maxLength={2000}
            className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-60"
          />
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={rating < 1 || busy}
            onClick={() => onSubmit(rating, comment)}
            className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2.5"
          >
            {downloading ? "Preparing download…" : saving ? "Saving feedback…" : "Rate & download"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="flex-1 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 sm:py-2"
            >
              Skip & download
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 sm:py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
