import mongoose, { Document, Schema } from "mongoose";

export interface IAdminTemplate extends Document {
  adminId: string;
  name: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminTemplateSchema = new Schema<IAdminTemplate>(
  {
    adminId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export default mongoose.models.AdminTemplate ||
  mongoose.model<IAdminTemplate>("AdminTemplate", AdminTemplateSchema);
