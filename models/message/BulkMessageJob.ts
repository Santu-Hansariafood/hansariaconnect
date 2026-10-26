import mongoose, { Schema, type Document } from "mongoose";

export type BulkMessageRecipientStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed";

export interface IBulkMessageJob extends Document {
  apiKeyId: string;
  senderId: string;
  payload?: string;
  templateName?: string;
  status: "queued" | "processing" | "completed" | "partial" | "failed";
  leaseUntil?: Date;
  completedAt?: Date;
  recipients: Array<{
    recipient: string;
    toUserId: string;
    status: BulkMessageRecipientStatus;
    attempts: number;
    nextAttemptAt?: Date;
    error?: string;
    messageId?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const RecipientSchema = new Schema(
  {
    recipient: { type: String, required: true },
    toUserId: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date },
    error: { type: String },
    messageId: { type: String },
  },
  { _id: false },
);

const BulkMessageJobSchema = new Schema<IBulkMessageJob>(
  {
    apiKeyId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    payload: { type: String, required: true },
    templateName: { type: String },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "partial", "failed"],
      default: "queued",
      index: true,
    },
    leaseUntil: { type: Date, index: true },
    completedAt: { type: Date },
    recipients: { type: [RecipientSchema], required: true },
  },
  { timestamps: true },
);

BulkMessageJobSchema.index({ status: 1, createdAt: 1 });

export default
  mongoose.models.BulkMessageJob ||
  mongoose.model<IBulkMessageJob>("BulkMessageJob", BulkMessageJobSchema);
