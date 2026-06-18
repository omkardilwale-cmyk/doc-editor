import { ObjectId, type Collection } from "mongodb";
import { normalizeUserEmail } from "@/lib/auth/userEmail";
import { getDb } from "@/lib/db/mongodb";
import type {
  CreateDocumentBody,
  StoredDocumentEditorState,
  StoredDocumentRecord,
  StoredDocumentSummary,
  UpdateDocumentBody,
} from "@/types/storedDocument";

const COLLECTION = "pdf_documents";

interface PdfDocumentDoc {
  _id?: ObjectId;
  email: string;
  name: string;
  pdfBase64: string;
  annotations: StoredDocumentEditorState["annotations"];
  pdfTextEdits: StoredDocumentEditorState["pdfTextEdits"];
  pageDimensions?: StoredDocumentEditorState["pageDimensions"];
  createdAt: Date;
  updatedAt: Date;
}

async function collection(): Promise<Collection<PdfDocumentDoc>> {
  const db = await getDb();
  return db.collection<PdfDocumentDoc>(COLLECTION);
}

function toRecord(doc: PdfDocumentDoc & { _id: ObjectId }): StoredDocumentRecord {
  return {
    _id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    pdfBase64: doc.pdfBase64,
    annotations: doc.annotations ?? [],
    pdfTextEdits: doc.pdfTextEdits ?? [],
    pageDimensions: doc.pageDimensions,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toSummary(doc: PdfDocumentDoc & { _id: ObjectId }): StoredDocumentSummary {
  return {
    _id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listDocuments(
  email: string,
): Promise<StoredDocumentSummary[]> {
  const col = await collection();
  const ownerEmail = normalizeUserEmail(email);
  const docs = await col
    .find({ email: ownerEmail }, { projection: { pdfBase64: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((doc) => toSummary(doc as PdfDocumentDoc & { _id: ObjectId }));
}

export async function getDocumentById(
  id: string,
  email: string,
): Promise<StoredDocumentRecord | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await collection();
  const ownerEmail = normalizeUserEmail(email);
  const doc = await col.findOne({ _id: new ObjectId(id), email: ownerEmail });
  if (!doc) return null;
  return toRecord(doc as PdfDocumentDoc & { _id: ObjectId });
}

export async function createDocument(
  body: CreateDocumentBody,
): Promise<StoredDocumentRecord> {
  const now = new Date();
  const col = await collection();
  const ownerEmail = normalizeUserEmail(body.email);
  const result = await col.insertOne({
    email: ownerEmail,
    name: body.name,
    pdfBase64: body.pdfBase64,
    annotations: body.annotations ?? [],
    pdfTextEdits: body.pdfTextEdits ?? [],
    pageDimensions: body.pageDimensions,
    createdAt: now,
    updatedAt: now,
  });
  const inserted = await col.findOne({ _id: result.insertedId });
  if (!inserted) throw new Error("Failed to create document");
  return toRecord(inserted as PdfDocumentDoc & { _id: ObjectId });
}

export async function updateDocument(
  id: string,
  email: string,
  body: UpdateDocumentBody,
): Promise<StoredDocumentRecord | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await collection();
  const ownerEmail = normalizeUserEmail(email);
  const updates: Partial<PdfDocumentDoc> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.pdfBase64 !== undefined) updates.pdfBase64 = body.pdfBase64;
  if (body.annotations !== undefined) updates.annotations = body.annotations;
  if (body.pdfTextEdits !== undefined) updates.pdfTextEdits = body.pdfTextEdits;
  if (body.pageDimensions !== undefined) updates.pageDimensions = body.pageDimensions;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), email: ownerEmail },
    { $set: updates },
    { returnDocument: "after" },
  );
  if (!result) return null;
  return toRecord(result as PdfDocumentDoc & { _id: ObjectId });
}

export async function deleteDocument(id: string, email: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await collection();
  const ownerEmail = normalizeUserEmail(email);
  const result = await col.deleteOne({ _id: new ObjectId(id), email: ownerEmail });
  return result.deletedCount === 1;
}
