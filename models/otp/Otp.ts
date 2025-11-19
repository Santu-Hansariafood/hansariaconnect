import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
  mobile: string;
  otp: string;
  expiresAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    mobile: { type: String, required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Otp || mongoose.model("Otp", OtpSchema);
