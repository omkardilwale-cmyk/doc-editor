import type {
  CreateDocumentBody,
  StoredDocumentRecord,
  StoredDocumentSummary,
  UpdateDocumentBody,
} from "@/types/storedDocument";

async function parseError(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return typeof data.error === "string" ? data.error : "Request failed";
}

function emailQuery(email: string): string {
  return `email=${encodeURIComponent(email)}`;
}

export interface DocumentListResponse {
  configured: boolean;
  documents: StoredDocumentSummary[];
}

export async function fetchDocumentSummaries(
  email: string,
): Promise<DocumentListResponse> {
  const query = email ? `?${emailQuery(email)}` : "";
  const response = await fetch(`/api/documents${query}`);
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as DocumentListResponse;
}

export async function fetchDocumentById(
  id: string,
  email: string,
): Promise<StoredDocumentRecord> {
  const response = await fetch(`/api/documents/${id}?${emailQuery(email)}`);
  if (!response.ok) throw new Error(await parseError(response));
  const data = (await response.json()) as { document: StoredDocumentRecord };
  return data.document;
}

export async function createStoredDocument(
  body: CreateDocumentBody,
): Promise<StoredDocumentRecord> {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const data = (await response.json()) as { document: StoredDocumentRecord };
  return data.document;
}

export async function updateStoredDocument(
  id: string,
  email: string,
  body: UpdateDocumentBody,
): Promise<StoredDocumentRecord> {
  const response = await fetch(`/api/documents/${id}?${emailQuery(email)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const data = (await response.json()) as { document: StoredDocumentRecord };
  return data.document;
}

export async function deleteStoredDocument(
  id: string,
  email: string,
): Promise<void> {
  const response = await fetch(`/api/documents/${id}?${emailQuery(email)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await parseError(response));
}
