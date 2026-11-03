import mongoose, { Schema, type Document } from "mongoose";

export interface IAuthEmailJob extends Document {
  payload?: string;
  challengeId: string;
  target: string;
  status: "queued" | "processing" | "sent" | "failed";
  attempts: number;
  availableAt: Date;
  leaseUntil?: Date;
  expiresAt: Date;
  createdAt: Date;
}

const AuthEmailJobSchema = new Schema<IAuthEmailJob>(
  {
    challengeId: { type: String, required: true, index: true },
    target: { type: String, required: true },
    payload: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, required: true, default: 0 },
    availableAt: { type: Date, required: true, index: true },
    leaseUntil: { type: Date, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

AuthEmailJobSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
AuthEmailJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default
  mongoose.models.AuthEmailJob ||
  mongoose.model<IAuthEmailJob>("AuthEmailJob", AuthEmailJobSchema);
