import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPushSubscription extends Document {
  userId: Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // One row per browser/device endpoint; re-subscribing the same device
    // updates the existing row instead of piling up duplicates.
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, maxlength: 400 },
  },
  { timestamps: true },
);

PushSubscriptionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
