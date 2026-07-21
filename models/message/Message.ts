import mongoose, { Schema, Document } from "mongoose"

export interface IMessage extends Document {
  from: mongoose.Types.ObjectId | string
  to: mongoose.Types.ObjectId | string
  type: "text" | "image" | "video" | "voice" | "pdf" | "excel" | "link"
  text?: string
  mediaUrl?: string
  fileName?: string
  fileSize?: string
  linkTitle?: string
  linkDescription?: string
  duration?: number
  status?: "sent" | "delivered" | "seen"
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    text: { type: String },
    mediaUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: String },
    linkTitle: { type: String },
    linkDescription: { type: String },
    duration: { type: Number },
    status: { type: String, default: "sent" },
  },
  { timestamps: true }
)

// Add indexes for faster querying
MessageSchema.index({ from: 1, to: 1, createdAt: -1 })
MessageSchema.index({ to: 1, createdAt: -1 })

export default mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema)