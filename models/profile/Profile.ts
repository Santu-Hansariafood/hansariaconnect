import mongoose, { Schema, Document } from "mongoose";

export interface IProfile extends Document {
  userId: mongoose.Types.ObjectId | string;
  name: string;
  about: string;
  photo: string;

  theme: {
    wallpaper: string;
    primary: string;
    textSize?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    name: { type: String, required: true },
    about: {
      type: String,
      default: "Hey there! I am using HansariaConnect",
    },
    photo: { type: String, default: "" },

    theme: {
      wallpaper: { type: String, default: "" },
      primary: { type: String, default: "#10b981" },
      textSize: { type: String, default: "text-base" },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Profile ||
  mongoose.model<IProfile>("Profile", ProfileSchema);
