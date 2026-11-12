import mongoose, { Document, Schema } from "mongoose";

export const WEBHOOK_EVENTS = [
  "message.created",
  "message.status_changed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface IWebhookConfig extends Document {
  adminId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookConfigSchema = new Schema<IWebhookConfig>(
  {
    adminId: { type: String, required: true, unique: true },
    url: { type: String, required: true, maxlength: 2048 },
    secret: { type: String, required: true },
    events: {
      type: [String],
      enum: WEBHOOK_EVENTS,
      default: ["message.created", "message.status_changed"],
    },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.WebhookConfig ||
  mongoose.model<IWebhookConfig>("WebhookConfig", WebhookConfigSchema);
