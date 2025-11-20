import mongoose, { Schema, models, model } from "mongoose"

const ConversationSchema = new Schema(
  {
    userA: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userB: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

ConversationSchema.index({ userA: 1, userB: 1 }, { unique: true })

const Conversation = models.Conversation || model("Conversation", ConversationSchema)
export default Conversation