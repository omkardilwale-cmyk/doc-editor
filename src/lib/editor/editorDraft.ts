import { getOrCreateClientId } from "@/lib/auth/clientId";
import {
  isValidUserEmail,
  normalizeUserEmail,
  readStoredUserEmail,
} from "@/lib/auth/userEmail";
import type { Annotation, EditTool, PageDimensions } from "@/types/annotations";
import type { PdfTextEdit } from "@/types/pdfText";

const DRAFT_VERSION = 1;
const DRAFT_PREFIX = "doc-editor-draft";
const ACTIVE_PREFIX = "doc-editor-active";

export interface EditorDraft {
  version: typeof DRAFT_VERSION;
  userKey: string;
  documentKey: string;
  documentId: string | null;
  fileName: string;
  fileHash: string | null;
  pdfBase64: string | null;
  annotations: Annotation[];
  pdfTextEdits: PdfTextEdit[];
  pageDimensions: PageDimensions[];
  currentPage: number;
  scale: number;
  tool: EditTool;
  color: string;
  fontSize: number;
  updatedAt: number;
}

export function resolveUserStorageKey(email?: string): string {
  const fromArg = email ? normalizeUserEmail(email) : "";
  const stored = fromArg || readStoredUserEmail();
  if (stored && isValidUserEmail(stored)) return stored;
  return `client:${getOrCreateClientId()}`;
}

export async function hashPdfBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export function documentKeyForCloud(documentId: string): string {
  return `cloud:${documentId}`;
}

export function documentKeyForUpload(fileHash: string): string {
  return `upload:${fileHash}`;
}

export function cloudDocumentIdFromKey(documentKey: string): string | null {
  return documentKey.startsWith("cloud:") ? documentKey.slice(6) : null;
}

function draftStorageKey(userKey: string, documentKey: string): string {
  return `${DRAFT_PREFIX}:${userKey}:${documentKey}`;
}

function activeDraftStorageKey(userKey: string): string {
  return `${ACTIVE_PREFIX}:${userKey}`;
}

function isEditorDraft(value: unknown): value is EditorDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as EditorDraft;
  return (
    draft.version === DRAFT_VERSION &&
    typeof draft.userKey === "string" &&
    typeof draft.documentKey === "string" &&
    typeof draft.fileName === "string" &&
    Array.isArray(draft.annotations) &&
    Array.isArray(draft.pdfTextEdits)
  );
}

export function readEditorDraft(
  userKey: string,
  documentKey: string,
): EditorDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(userKey, documentKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isEditorDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function findEditorDraft(
  userKey: string,
  documentKey: string,
): EditorDraft | null {
  const direct = readEditorDraft(userKey, documentKey);
  if (direct) return direct;

  const clientKey = resolveUserStorageKey();
  if (clientKey !== userKey) {
    return readEditorDraft(clientKey, documentKey);
  }
  return null;
}

export function writeEditorDraft(draft: EditorDraft): boolean {
  if (typeof window === "undefined") return false;

  const key = draftStorageKey(draft.userKey, draft.documentKey);
  const payload: EditorDraft = { ...draft, version: DRAFT_VERSION };

  try {
    localStorage.setItem(key, JSON.stringify(payload));
    localStorage.setItem(activeDraftStorageKey(draft.userKey), draft.documentKey);
    return true;
  } catch {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ ...payload, pdfBase64: null }),
      );
      localStorage.setItem(activeDraftStorageKey(draft.userKey), draft.documentKey);
      return true;
    } catch {
      return false;
    }
  }
}

export function clearEditorDraft(userKey: string, documentKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(draftStorageKey(userKey, documentKey));
  const active = readActiveDocumentKey(userKey);
  if (active === documentKey) {
    localStorage.removeItem(activeDraftStorageKey(userKey));
  }
}

export function clearActiveDocumentKey(userKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(activeDraftStorageKey(userKey));
}

export function dismissEditorDraft(userKey: string, documentKey: string | null): void {
  if (documentKey) {
    clearEditorDraft(userKey, documentKey);
  } else {
    clearActiveDocumentKey(userKey);
  }
}

export function readActiveDocumentKey(userKey: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(activeDraftStorageKey(userKey));
}

export function readActiveEditorDraft(userKey: string): EditorDraft | null {
  const documentKey = readActiveDocumentKey(userKey);
  if (!documentKey) return null;
  return findEditorDraft(userKey, documentKey);
}
