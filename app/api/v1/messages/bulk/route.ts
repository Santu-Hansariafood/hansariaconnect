import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";
import AdminTemplate from "@/models/admin/AdminTemplate";
import { encryptDirectMessageContent, decryptDirectMessageContent } from "@/lib/crypto";
import {
  invalidateDirectMessages,
  invalidateUserConversations,
} from "@/lib/redis/redis";
import { emitDirectMessageReceived } from "@/lib/socketEmitter";

const MAX_RECIPIENTS = 100;
const messageTypes = ["image", "video", "voice", "pdf", "excel", "file"] as const;

const requestSchema = z.object({
  templateId: z.string().optional(),
  template: z.string().optional(),
  text: z.string().optional(),
  recipients: z
    .array(
      z.object({
        toUserId: z.string().optional(),
        userId: z.string().optional(),
        variables: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .default({}),
        attachment: z
          .object({
            type: z.enum(messageTypes),
            mediaUrl: z.string().url().max(2048),
            fileName: z.string().max(255).optional(),
            fileSize: z.string().max(32).optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(MAX_RECIPIENTS),
});

const applyTemplate = (
  template: string,
  variables: Record<string, string | number | boolean>,
) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    String(variables[key] ?? ""),
  );

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateApiKey(req, "sendMessage");
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }
    const parsedBody = requestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: parsedBody.error.issues[0]?.message || "Invalid request" },
        { status: 400 },
      );
    }

    const senderId = String(authResult.apiKey.senderUserId || "");
    if (!Types.ObjectId.isValid(senderId)) {
      return NextResponse.json(
        { success: false, error: "This API key is not bound to a sender account" },
        { status: 400 },
      );
    }

    await connectDB();

    const templateText = parsedBody.data.templateId
      ? Types.ObjectId.isValid(parsedBody.data.templateId)
        ? (
            await AdminTemplate.findOne({
              _id: parsedBody.data.templateId,
              adminId: String(authResult.apiKey.adminId),
            }).lean()
          )?.body
        : undefined
      : parsedBody.data.template || parsedBody.data.text;
    if (!templateText) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.data.templateId
            ? "Template not found for this API key"
            : "Provide a saved templateId or template text",
        },
        { status: parsedBody.data.templateId ? 404 : 400 },
      );
    }

    const sender = await User.exists({ _id: senderId });
    if (!sender) {
      return NextResponse.json(
        { success: false, error: "Sender account not found" },
        { status: 400 },
      );
    }

    const recipients = parsedBody.data.recipients;
    const recipientIds = recipients.map((recipient) =>
      String(recipient.toUserId || recipient.userId || ""),
    );
    if (recipientIds.some((id) => !Types.ObjectId.isValid(id))) {
      return NextResponse.json(
        { success: false, error: "Every recipient needs a valid toUserId" },
        { status: 400 },
      );
    }
    const existingRecipientCount = await User.countDocuments({
      _id: { $in: recipientIds },
    });
    if (existingRecipientCount !== new Set(recipientIds).size) {
      return NextResponse.json(
        { success: false, error: "One or more recipients do not exist" },
        { status: 400 },
      );
    }

    const preparedMessages: Array<{
      toUserId: string;
      text: string;
      type: "text" | (typeof messageTypes)[number];
      mediaUrl: string;
      fileName: string;
      fileSize: string;
    }> = [];

    for (const recipient of recipients) {
      const toUserId = String(recipient.toUserId || recipient.userId);
      if (toUserId === senderId) continue;

      const text = applyTemplate(templateText, recipient.variables);
      const attachment = recipient.attachment;
      if (!text.trim() && !attachment) continue;

      const mediaUrl = attachment
        ? applyTemplate(attachment.mediaUrl, recipient.variables)
        : "";
      if (attachment && !isHttpsUrl(mediaUrl)) {
        return NextResponse.json(
          {
            success: false,
            error: `Recipient ${toUserId} has an invalid attachment URL; use HTTPS`,
          },
          { status: 400 },
        );
      }

      preparedMessages.push({
        toUserId,
        text,
        type: attachment?.type || "text",
        mediaUrl,
        fileName: attachment
          ? applyTemplate(attachment.fileName || "", recipient.variables)
          : "",
        fileSize: attachment
          ? applyTemplate(attachment.fileSize || "", recipient.variables)
          : "",
      });
    }

    const created: Array<{ id: string; toUserId: string; text: string; type: string }> = [];
    for (const item of preparedMessages) {
      const encrypted = {
        text: encryptDirectMessageContent(senderId, item.toUserId, item.text),
        mediaUrl: encryptDirectMessageContent(senderId, item.toUserId, item.mediaUrl),
        fileName: encryptDirectMessageContent(senderId, item.toUserId, item.fileName),
        fileSize: encryptDirectMessageContent(senderId, item.toUserId, item.fileSize),
      };
      const message = await Message.create({
        from: new Types.ObjectId(senderId),
        to: new Types.ObjectId(item.toUserId),
        type: item.type,
        ...encrypted,
        status: "sent",
      });

      const senderObjectId = new Types.ObjectId(senderId);
      const recipientObjectId = new Types.ObjectId(item.toUserId);
      const userA =
        senderId < item.toUserId ? senderObjectId : recipientObjectId;
      const userB =
        senderId < item.toUserId ? recipientObjectId : senderObjectId;
      await Conversation.findOneAndUpdate(
        { userA, userB },
        { userA, userB, lastMessageAt: message.createdAt },
        { upsert: true },
      );

      const payload = {
        id: String(message._id),
        from: senderId,
        to: item.toUserId,
        type: item.type,
        text: decryptDirectMessageContent(senderId, item.toUserId, encrypted.text),
        mediaUrl: decryptDirectMessageContent(senderId, item.toUserId, encrypted.mediaUrl),
        fileName: decryptDirectMessageContent(senderId, item.toUserId, encrypted.fileName),
        fileSize: decryptDirectMessageContent(senderId, item.toUserId, encrypted.fileSize),
        timestamp: message.createdAt,
        status: "sent",
      };

      void invalidateDirectMessages(senderId, item.toUserId);
      void invalidateUserConversations(senderId);
      void invalidateUserConversations(item.toUserId);
      void emitDirectMessageReceived(senderId, item.toUserId, payload);
      created.push({
        id: String(message._id),
        toUserId: item.toUserId,
        text: item.text,
        type: item.type,
      });
    }

    return NextResponse.json({
      success: true,
      sent: created.length,
      messages: created,
    });
  } catch (error: unknown) {
    console.error("[api/v1/messages/bulk] Failed to send messages:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bulk send failed",
      },
      { status: 500 },
    );
  }
}
