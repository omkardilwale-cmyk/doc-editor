import { ObjectId, type Collection } from "mongodb";
import { normalizeUserEmail, isValidUserEmail } from "@/lib/auth/userEmail";
import { getDb } from "@/lib/db/mongodb";
import type {
  FeedbackIdentityType,
  FeedbackLocation,
  FeedbackRecord,
  SubmitFeedbackBody,
} from "@/types/feedback";

const COLLECTION = "app_feedback";

interface FeedbackDoc {
  _id?: ObjectId;
  rating: number;
  comment?: string;
  identityType: FeedbackIdentityType;
  email?: string;
  clientId?: string;
  ip?: string;
  location?: FeedbackLocation;
  context: string;
  documentId?: string;
  fileName?: string;
  createdAt: Date;
}

async function collection(): Promise<Collection<FeedbackDoc>> {
  const db = await getDb();
  return db.collection<FeedbackDoc>(COLLECTION);
}

function resolveIdentity(
  body: SubmitFeedbackBody,
  ip: string | null,
): Pick<FeedbackDoc, "identityType" | "email" | "clientId" | "ip"> {
  if (body.email && isValidUserEmail(body.email)) {
    return {
      identityType: "email",
      email: normalizeUserEmail(body.email),
      clientId: body.clientId?.trim() || undefined,
      ip: ip ?? undefined,
    };
  }

  if (body.clientId?.trim()) {
    return {
      identityType: "client",
      clientId: body.clientId.trim(),
      ip: ip ?? undefined,
    };
  }

  if (ip) {
    return { identityType: "ip", ip };
  }

  return { identityType: "anonymous" };
}

function toRecord(doc: FeedbackDoc & { _id: ObjectId }): FeedbackRecord {
  return {
    _id: doc._id.toString(),
    rating: doc.rating,
    comment: doc.comment,
    identityType: doc.identityType,
    email: doc.email,
    clientId: doc.clientId,
    ip: doc.ip,
    location: doc.location,
    context: doc.context,
    documentId: doc.documentId,
    fileName: doc.fileName,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createFeedback(
  body: SubmitFeedbackBody,
  ip: string | null,
): Promise<FeedbackRecord> {
  const col = await collection();
  const identity = resolveIdentity(body, ip);
  const now = new Date();

  const result = await col.insertOne({
    rating: body.rating,
    comment: body.comment?.trim() || undefined,
    ...identity,
    location: body.location,
    context: body.context?.trim() || "pdf_download",
    documentId: body.documentId,
    fileName: body.fileName?.trim(),
    createdAt: now,
  });

  const inserted = await col.findOne({ _id: result.insertedId });
  if (!inserted) throw new Error("Failed to save feedback");
  return toRecord(inserted as FeedbackDoc & { _id: ObjectId });
}
