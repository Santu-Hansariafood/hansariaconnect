import mongoose, { Schema } from "mongoose";

export interface IApiRateLimit {
  _id: string;
  requests: number;
  messages: number;
  expiresAt: Date;
}

const ApiRateLimitSchema = new Schema<IApiRateLimit>(
  {
    _id: { type: String, required: true },
    requests: { type: Number, required: true, default: 0 },
    messages: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

ApiRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ApiRateLimit ||
  mongoose.model<IApiRateLimit>("ApiRateLimit", ApiRateLimitSchema);
