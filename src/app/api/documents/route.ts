import { NextResponse } from "next/server";
import { isValidUserEmail, normalizeUserEmail } from "@/lib/auth/userEmail";
import {
  createDocument,
  listDocuments,
} from "@/lib/db/documents";
import { isMongoConfigured } from "@/lib/db/mongodb";
import type { CreateDocumentBody } from "@/types/storedDocument";

export const runtime = "nodejs";

function emailFromUrl(url: URL): string | null {
  const raw = url.searchParams.get("email");
  if (!raw) return null;
  const email = normalizeUserEmail(raw);
  return isValidUserEmail(email) ? email : null;
}

export async function GET(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json({ configured: false, documents: [] });
  }

  const email = emailFromUrl(new URL(request.url));
  if (!email) {
    return NextResponse.json({ configured: true, documents: [] });
  }

  try {
    const documents = await listDocuments(email);
    return NextResponse.json({ configured: true, documents });
  } catch (error) {
    console.error("List documents failed:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI in .env.local." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as CreateDocumentBody;
    if (!body.email?.trim() || !isValidUserEmail(body.email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!body.pdfBase64?.trim()) {
      return NextResponse.json(
        { error: "pdfBase64 is required" },
        { status: 400 },
      );
    }

    const document = await createDocument({
      email: normalizeUserEmail(body.email),
      name: body.name.trim(),
      pdfBase64: body.pdfBase64,
      annotations: body.annotations ?? [],
      pdfTextEdits: body.pdfTextEdits ?? [],
      pageDimensions: body.pageDimensions,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Create document failed:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 },
    );
  }
}
