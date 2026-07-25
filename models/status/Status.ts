import mongoose, { Schema, Document, Types } from "mongoose";

export interface IStatus extends Document {
  userId: Types.ObjectId;
  media: string;
  type: "image" | "video";
  views: Types.ObjectId[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StatusSchema = new Schema<IStatus>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    media: { type: String, required: true },
    type: { type: String, enum: ["image", "video"], required: true },
    views: [{ type: Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date, required: true, index: true, expires: 0 },
  },
  { timestamps: true }
);

StatusSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Status ||
  mongoose.model<IStatus>("Status", StatusSchema);

