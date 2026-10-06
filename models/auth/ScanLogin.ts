import mongoose, { Schema, type Document } from "mongoose";

export interface IScanLogin extends Document {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  mobile?: string;
  used: boolean;
}

const ScanLoginSchema = new Schema<IScanLogin>(
  {
    token: { type: String, required: true, unique: true },
    createdAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    mobile: { type: String },
    used: { type: Boolean, required: true, default: false },
  },
  { versionKey: false },
);

ScanLoginSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default
  mongoose.models.ScanLogin ||
  mongoose.model<IScanLogin>("ScanLogin", ScanLoginSchema);
