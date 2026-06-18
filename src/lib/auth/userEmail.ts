const STORAGE_KEY = "doc-editor-user-email";

export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidUserEmail(email: string): boolean {
  const normalized = normalizeUserEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function readStoredUserEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function writeStoredUserEmail(email: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, normalizeUserEmail(email));
}

export function clearStoredUserEmail(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
