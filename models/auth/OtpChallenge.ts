import mongoose, { Schema } from "mongoose";

export type OtpChallengePurpose = "login" | "registration" | "admin";

export interface IOtpChallenge {
  challengeId: string;
  target: string;
  purpose: OtpChallengePurpose;
  hash: string;
  salt: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date;
}

const OtpChallengeSchema = new Schema<IOtpChallenge>(
  {
    challengeId: { type: String, required: true, unique: true },
    target: { type: String, required: true, index: true },
    purpose: {
      type: String,
      enum: ["login", "registration", "admin"],
      required: true,
    },
    hash: { type: String, required: true },
    salt: { type: String, required: true },
    attempts: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { versionKey: false, timestamps: true },
);

OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default
  mongoose.models.OtpChallenge ||
  mongoose.model<IOtpChallenge>("OtpChallenge", OtpChallengeSchema);
