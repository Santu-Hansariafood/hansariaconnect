import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";
import { encryptDirectMessageContent } from "@/lib/crypto";

const MAX_RECIPIENTS = 100;

const applyTemplate = (template: string, variables: Record<string, unknown>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(variables[key] ?? ""));

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateApiKey(req, "sendMessage");
    if ("error" in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const senderId = String(authResult.apiKey.senderUserId || "");
    const template = String(body?.template || body?.text || "");
    const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
    if (!Types.ObjectId.isValid(senderId)) {
      return NextResponse.json({ success: false, error: "This API key is not bound to a sender account" }, { status: 400 });
    }
    if (!template || !recipients.length || recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json({ success: false, error: `Provide a template and 1-${MAX_RECIPIENTS} recipients` }, { status: 400 });
    }
    await connectDB();
    const sender = await User.exists({ _id: senderId });
    if (!sender) return NextResponse.json({ success: false, error: "Sender account not found" }, { status: 400 });

    const recipientIds = recipients.map((item: any) => String(item?.toUserId || item?.userId || ""));
    if (recipientIds.some((id: string) => !Types.ObjectId.isValid(id))) {
      return NextResponse.json({ success: false, error: "Every recipient needs a valid toUserId" }, { status: 400 });
    }
    const existingRecipients = await User.countDocuments({ _id: { $in: recipientIds } });
    if (existingRecipients !== new Set(recipientIds).size) {
      return NextResponse.json({ success: false, error: "One or more recipients do not exist" }, { status: 400 });
    }

    const created: Array<{ id: string; toUserId: string; text: string }> = [];
    for (const item of recipients) {
      const toUserId = String(item.toUserId || item.userId);
      if (toUserId === senderId) continue;
      const text = applyTemplate(template, item.variables || {});
      if (!text.trim()) continue;
      const encryptedText = encryptDirectMessageContent(senderId, toUserId, text);
      const message = await Message.create({
        from: new Types.ObjectId(senderId),
        to: new Types.ObjectId(toUserId),
        type: "text",
        text: encryptedText,
        status: "sent",
      });
      const userA = senderId < toUserId ? new Types.ObjectId(senderId) : new Types.ObjectId(toUserId);
      const userB = senderId < toUserId ? new Types.ObjectId(toUserId) : new Types.ObjectId(senderId);
      await Conversation.findOneAndUpdate({ userA, userB }, { userA, userB, lastMessageAt: message.createdAt }, { upsert: true });
      created.push({ id: String(message._id), toUserId, text });
    }

    return NextResponse.json({ success: true, sent: created.length, messages: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Bulk send failed" }, { status: 500 });
  }
}