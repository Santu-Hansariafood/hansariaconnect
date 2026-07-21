import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  mobile: string;
  name?: string;
  email?: string;
  sex?: "male" | "female" | "other";
  dateOfBirth?: Date;
  termsAccepted?: boolean;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: number;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    mobile: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String, unique: true, sparse: true },
    sex: { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: { type: Date },
    termsAccepted: { type: Boolean, default: false },
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
    googleTokenExpiry: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
