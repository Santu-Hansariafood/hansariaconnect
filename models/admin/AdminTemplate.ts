import mongoose, { Document, Schema } from "mongoose";

export interface IAdminTemplate extends Document {
  adminId: string;
  name: string;
  body: string;
  defaultLanguage: string;
  folder: string;
  translations: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const AdminTemplateSchema = new Schema<IAdminTemplate>(
  {
    adminId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    defaultLanguage: {
      type: String,
      default: "en",
      match: /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i,
    },
    folder: { type: String, default: "General", trim: true, maxlength: 80 },
    translations: {
      type: Map,
      of: { type: String, maxlength: 2000 },
      default: {},
    },
  },
  { timestamps: true },
);

export default mongoose.models.AdminTemplate ||
  mongoose.model<IAdminTemplate>("AdminTemplate", AdminTemplateSchema);
