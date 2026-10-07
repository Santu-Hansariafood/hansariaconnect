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
  getTemplateVariableNames,
  renderMessageTemplate,
} from "@/lib/messageTemplates";
import { verifyTemplateAdminCredentials } from "@/lib/templateAdminAuth";
import {
  invalidateDirectMessages,
  invalidateUserConversations,
} from "@/lib/redis/redis";
import { emitDirectMessageReceived } from "@/lib/socketEmitter";

const MAX_RECIPIENTS = 100;
const messageTypes = ["image", "video", "voice", "pdf", "excel", "file"] as const;

const requestSchema = z.object({
  adminUserId: z.string().min(1),
  adminPassword: z.string().min(1),
  templateId: z.string().optional(),
  templateName: z.string().trim().min(1).max(100).optional(),
  template: z.string().optional(),
  text: z.string().optional(),
  recipients: z
    .array(
      z.object({
        toUserId: z.string().optional(),
        userId: z.string().optional(),
        variables: z
          .record(
            z.string(),
            z.union([z.string().max(10000), z.number(), z.boolean()]),
          )
          .optional()
          .default({}),
        attachment: z
          .object({
            type: z.enum(messageTypes),
            mediaUrl: z.string().min(1).max(2048),
            fileName: z.string().max(255).optional(),
            fileSize: z.string().max(32).optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(MAX_RECIPIENTS),
});

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

    const credentialsValid = await verifyTemplateAdminCredentials(
      String(authResult.apiKey.adminId),
      parsedBody.data.adminUserId,
      parsedBody.data.adminPassword,
    );
    if (!credentialsValid) {
      return NextResponse.json(
        { success: false, error: "Invalid admin credentials for this API key" },
        { status: 401 },
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

    if (parsedBody.data.templateId && parsedBody.data.templateName) {
      return NextResponse.json(
        { success: false, error: "Provide templateName or templateId, not both" },
        { status: 400 },
      );
    }

    const savedTemplate = parsedBody.data.templateName
      ? await AdminTemplate.findOne({
            name: parsedBody.data.templateName,
            adminId: String(authResult.apiKey.adminId),
          })
            .select("name body")
            .lean()
      : parsedBody.data.templateId
        ? Types.ObjectId.isValid(parsedBody.data.templateId)
          ? await AdminTemplate.findOne({
              _id: parsedBody.data.templateId,
              adminId: String(authResult.apiKey.adminId),
            })
              .select("name body")
              .lean()
          : null
        : undefined;
    if (
      (parsedBody.data.templateName || parsedBody.data.templateId) &&
      !savedTemplate
    ) {
      return NextResponse.json(
        { success: false, error: "Template not found for this API key" },
        { status: 404 },
      );
    }
    const templateText = savedTemplate?.body || parsedBody.data.template || parsedBody.data.text;
    const savedTemplateName = savedTemplate?.name;
    if (!templateText) {
      return NextResponse.json(
        {
          success: false,
          error: "Provide a saved templateName or template text",
        },
        { status: 400 },
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
    const templateVariables = getTemplateVariableNames(templateText);
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

      const { text, missingVariables } = renderMessageTemplate(
        templateText,
        recipient.variables,
      );
      if (missingVariables.length) {
        return NextResponse.json(
          {
            success: false,
            error: `Recipient ${toUserId} is missing template variables: ${missingVariables.join(", ")}`,
          },
          { status: 400 },
        );
      }
      if (text.length > 10000) {
        return NextResponse.json(
          { success: false, error: `Recipient ${toUserId}'s rendered message is too long` },
          { status: 400 },
        );
      }
      const attachment = recipient.attachment;
      if (!text.trim() && !attachment) continue;

      const attachmentValues = attachment
        ? [
            renderMessageTemplate(attachment.mediaUrl, recipient.variables),
            renderMessageTemplate(attachment.fileName || "", recipient.variables),
            renderMessageTemplate(attachment.fileSize || "", recipient.variables),
          ]
        : [];
      const missingAttachmentVariables = Array.from(
        new Set(attachmentValues.flatMap((value) => value.missingVariables)),
      );
      if (missingAttachmentVariables.length) {
        return NextResponse.json(
          {
            success: false,
            error: `Recipient ${toUserId} is missing attachment variables: ${missingAttachmentVariables.join(", ")}`,
          },
          { status: 400 },
        );
      }
      const [mediaUrl = "", fileName = "", fileSize = ""] =
        attachmentValues.map((value) => value.text);
      if (attachment && !isHttpsUrl(mediaUrl)) {
        return NextResponse.json(
          {
            success: false,
            error: `Recipient ${toUserId} has an invalid attachment URL; use HTTPS`,
          },
          { status: 400 },
        );
      }
      if (mediaUrl.length > 2048 || fileName.length > 255 || fileSize.length > 32) {
        return NextResponse.json(
          {
            success: false,
            error: `Recipient ${toUserId}'s rendered attachment details are too long`,
          },
          { status: 400 },
        );
      }

      preparedMessages.push({
        toUserId,
        text,
        type: attachment?.type || "text",
        mediaUrl,
        fileName,
        fileSize,
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
      template: savedTemplateName
        ? {
            name: savedTemplateName,
            variableCount: templateVariables.length,
            variables: templateVariables,
          }
        : undefined,
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
