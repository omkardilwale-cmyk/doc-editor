export type FeedbackIdentityType = "email" | "client" | "ip" | "anonymous";

export interface FeedbackLocation {
  lat: number;
  lng: number;
}

export interface SubmitFeedbackBody {
  rating: number;
  comment?: string;
  email?: string;
  clientId?: string;
  location?: FeedbackLocation;
  context?: string;
  documentId?: string;
  fileName?: string;
}

export interface FeedbackRecord {
  _id: string;
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
  createdAt: string;
}
