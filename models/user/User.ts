import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  mobile: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    mobile: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
