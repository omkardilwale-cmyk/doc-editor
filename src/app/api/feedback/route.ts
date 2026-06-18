import { NextResponse } from "next/server";
import { createFeedback } from "@/lib/db/feedback";
import { isMongoConfigured } from "@/lib/db/mongodb";
import type { SubmitFeedbackBody } from "@/types/feedback";

export const runtime = "nodejs";

function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI in .env.local." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as SubmitFeedbackBody;
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer from 1 to 5" },
        { status: 400 },
      );
    }

    const comment =
      typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : undefined;

    const feedback = await createFeedback(
      {
        rating,
        comment,
        email: body.email,
        clientId: body.clientId,
        location: body.location,
        context: body.context,
        documentId: body.documentId,
        fileName: body.fileName,
      },
      getRequestIp(request),
    );

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error("Save feedback failed:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 },
    );
  }
}
