import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  mobile: string;
  name?: string;
  email?: string;
  sex?: "male" | "female" | "other";
  dateOfBirth?: Date;
  termsAccepted?: boolean;
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
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
