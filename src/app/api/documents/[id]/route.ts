import { NextResponse } from "next/server";
import { isValidUserEmail, normalizeUserEmail } from "@/lib/auth/userEmail";
import {
  deleteDocument,
  getDocumentById,
  updateDocument,
} from "@/lib/db/documents";
import { isMongoConfigured } from "@/lib/db/mongodb";
import type { UpdateDocumentBody } from "@/types/storedDocument";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function emailFromUrl(url: URL): string | null {
  const raw = url.searchParams.get("email");
  if (!raw) return null;
  const email = normalizeUserEmail(raw);
  return isValidUserEmail(email) ? email : null;
}

export async function GET(request: Request, context: RouteContext) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI in .env.local." },
      { status: 503 },
    );
  }

  const email = emailFromUrl(new URL(request.url));
  if (!email) {
    return NextResponse.json(
      { error: "A valid email query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const document = await getDocumentById(id, email);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    console.error("Get document failed:", error);
    return NextResponse.json(
      { error: "Failed to get document" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI in .env.local." },
      { status: 503 },
    );
  }

  const email = emailFromUrl(new URL(request.url));
  if (!email) {
    return NextResponse.json(
      { error: "A valid email query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateDocumentBody;
    const document = await updateDocument(id, email, body);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    console.error("Update document failed:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI in .env.local." },
      { status: 503 },
    );
  }

  const email = emailFromUrl(new URL(request.url));
  if (!email) {
    return NextResponse.json(
      { error: "A valid email query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const deleted = await deleteDocument(id, email);
    if (!deleted) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete document failed:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
