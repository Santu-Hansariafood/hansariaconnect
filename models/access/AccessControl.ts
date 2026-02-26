import mongoose, { Schema, Document, Types } from "mongoose"

export interface IAccessControl extends Document {
  userId: Types.ObjectId
  permissions: {
    contacts: boolean
    groups: boolean
    status: boolean
    attachments: boolean
  }
  createdAt: Date
  updatedAt: Date
}

const AccessControlSchema = new Schema<IAccessControl>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    permissions: {
      contacts: { type: Boolean, default: true },
      groups: { type: Boolean, default: false },
      status: { type: Boolean, default: false },
      attachments: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
)

export default mongoose.models.AccessControl ||
  mongoose.model<IAccessControl>("AccessControl", AccessControlSchema)

