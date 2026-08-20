import mongoose, { Schema, Document, Types } from "mongoose"

export interface IGroupMessage extends Document {
  groupId: Types.ObjectId
  from: Types.ObjectId
  type: "text" | "image" | "video" | "voice" | "pdf" | "excel" | "link"
  text?: string
  mediaUrl?: string
  fileName?: string
  fileSize?: string
  duration?: number
  reactions?: Map<string, number>
  linkTitle?: string
  linkDescription?: string
  createdAt: Date
  updatedAt: Date
}

const GroupMessageSchema = new Schema<IGroupMessage>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    text: { type: String },
    mediaUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: String },
    duration: { type: Number },
    reactions: { type: Map, of: Number, default: {} },
    linkTitle: { type: String },
    linkDescription: { type: String },
  },
  { timestamps: true }
)

GroupMessageSchema.index({ groupId: 1, createdAt: -1 })

const GroupMessage =
  mongoose.models.GroupMessage || mongoose.model<IGroupMessage>("GroupMessage", GroupMessageSchema)

export default GroupMessage


