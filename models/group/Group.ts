import mongoose, { Schema, Document, Types } from "mongoose"

export type GroupRole = "admin" | "member"

export interface IGroupMember {
  userId: Types.ObjectId
  mobile: string
  role: GroupRole
  addedBy?: Types.ObjectId
  joinedAt: Date
}

export interface IGroup extends Document {
  name: string
  avatar: string
  createdBy: Types.ObjectId
  members: IGroupMember[]
  lastMessage?: string
  lastMessageAt?: Date
  createdAt: Date
  updatedAt: Date
}

const GroupMemberSchema = new Schema<IGroupMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mobile: { type: String, required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    addedBy: { type: Schema.Types.ObjectId, ref: "User" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const GroupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [GroupMemberSchema], default: [] },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
)

GroupSchema.index({ "members.userId": 1 })

const Group = mongoose.models.Group || mongoose.model<IGroup>("Group", GroupSchema)

export default Group


