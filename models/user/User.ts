import mongoose, { Schema, Document } from "mongoose";

export interface IUserSessionRecord {
  sessionId: string;
  createdAt: number;
  userAgent?: string;
  ip?: string;
}

export interface IUser extends Document {
  createdByAdminId?: string;
  mobile: string;
  name?: string;
  email?: string;
  sex?: "male" | "female" | "other";
  dateOfBirth?: Date;
  termsAccepted?: boolean;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: number;
  lastLoginIp?: string;
  lastLoginAt?: Date;
  lastSeenAt?: Date;
  sessions?: IUserSessionRecord[];
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    createdByAdminId: { type: String, index: true },
    mobile: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String, unique: true, sparse: true },
    sex: { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: { type: Date },
    termsAccepted: { type: Boolean, default: false },
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
    googleTokenExpiry: { type: Number },
    lastLoginIp: { type: String },
    lastLoginAt: { type: Date },
    lastSeenAt: { type: Date, index: true },
    sessions: [
      {
        sessionId: { type: String, required: true },
        createdAt: { type: Number, required: true },
        userAgent: { type: String },
        ip: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
