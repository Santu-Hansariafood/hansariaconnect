import mongoose, { Document, Schema } from "mongoose";
import type { TemplateActionButton } from "@/lib/templateActionButtons";

export interface IAdminTemplate extends Document {
  adminId: string;
  name: string;
  body: string;
  header: string;
  footer: string;
  defaultLanguage: string;
  folder: string;
  translations: Record<string, string>;
  buttons: TemplateActionButton[];
  createdAt: Date;
  updatedAt: Date;
}

const AdminTemplateSchema = new Schema<IAdminTemplate>(
  {
    adminId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    header: { type: String, default: "", trim: true, maxlength: 2000 },
    footer: { type: String, default: "", trim: true, maxlength: 2000 },
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
    buttons: {
      type: [
        new Schema(
          {
            type: { type: String, enum: ["call", "reply", "confirm"], required: true },
            label: { type: String, required: true, trim: true, maxlength: 30 },
            phoneNumber: { type: String, trim: true },
            replyText: { type: String, maxlength: 500 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export default mongoose.models.AdminTemplate ||
  mongoose.model<IAdminTemplate>("AdminTemplate", AdminTemplateSchema);
