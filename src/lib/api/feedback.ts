import { getOrCreateClientId } from "@/lib/auth/clientId";
import { isValidUserEmail, readStoredUserEmail } from "@/lib/auth/userEmail";
import type { FeedbackLocation, SubmitFeedbackBody } from "@/types/feedback";

async function tryGetLocation(): Promise<FeedbackLocation | undefined> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => resolve(undefined),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 300_000 },
    );
  });
}

export interface SubmitDownloadFeedbackInput {
  rating: number;
  comment?: string;
  documentId?: string | null;
  fileName?: string;
}

export async function submitDownloadFeedback(
  input: SubmitDownloadFeedbackInput,
): Promise<void> {
  const storedEmail = readStoredUserEmail();
  const email = isValidUserEmail(storedEmail) ? storedEmail : undefined;
  const clientId = getOrCreateClientId();
  const location = await tryGetLocation();

  const body: SubmitFeedbackBody = {
    rating: input.rating,
    comment: input.comment?.trim() || undefined,
    email,
    clientId,
    location,
    context: "pdf_download",
    documentId: input.documentId ?? undefined,
    fileName: input.fileName,
  };

  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not save feedback",
    );
  }
}
