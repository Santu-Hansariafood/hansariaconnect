import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReadReceipt extends Document {
  userId: Types.ObjectId;
  messageId?: Types.ObjectId;
  groupMessageId?: Types.ObjectId;
  conversationId?: Types.ObjectId;
  groupId?: Types.ObjectId;
  readAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReadReceiptSchema = new Schema<IReadReceipt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message" },
    groupMessageId: { type: Schema.Types.ObjectId, ref: "GroupMessage" },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", index: true },
    groupId: { type: Schema.Types.ObjectId, ref: "Group", index: true },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ReadReceiptSchema.index({ userId: 1, conversationId: 1 });
ReadReceiptSchema.index({ userId: 1, groupId: 1 });
ReadReceiptSchema.index({ messageId: 1 });
ReadReceiptSchema.index({ groupMessageId: 1 });

export default mongoose.models.ReadReceipt ||
  mongoose.model<IReadReceipt>("ReadReceipt", ReadReceiptSchema);

