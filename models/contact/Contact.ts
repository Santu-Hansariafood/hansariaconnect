import mongoose, { Schema, Document } from "mongoose"

export interface IContact extends Document {
  userId: mongoose.Types.ObjectId | string
  name: string
  mobiles: string[]
  email?: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

const ContactSchema = new Schema<IContact>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    mobiles: {
      type: [String],
      validate: {
        validator: (arr: string[]) => Array.isArray(arr) && arr.length > 0,
        message: "At least one mobile number is required",
      },
    },
    email: { type: String, default: "" },
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
)

export default mongoose.models.Contact || mongoose.model<IContact>("Contact", ContactSchema)