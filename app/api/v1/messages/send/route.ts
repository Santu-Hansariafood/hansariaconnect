import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";
import AdminTemplate from "@/models/admin/AdminTemplate";
import { decryptDirectMessageContent, encryptDirectMessageContent } from "@/lib/crypto";
import {
  invalidateDirectMessages,
  invalidateUserConversations,
} from "@/lib/redis/redis";
import { emitDirectMessageReceived } from "@/lib/socketEmitter";
import {
  getTemplateVariableNames,
  renderMessageTemplate,
} from "@/lib/messageTemplates";
import { verifyTemplateAdminCredentials } from "@/lib/templateAdminAuth";

const messageTypes = [
  "text",
  "image",
  "video",
  "voice",
  "pdf",
  "excel",
  "link",
  "file",
] as const;

const requestSchema = z.object({
  adminUserId: z.string().min(1),
  adminPassword: z.string().min(1),
  fromUserId: z.string().optional(),
  toUserId: z.string(),
  templateId: z.string().optional(),
  templateName: z.string().trim().min(1).max(100).optional(),
  template: z.string().max(2000).optional(),
  variables: z
    .record(
      z.string(),
      z.union([z.string().max(10000), z.number(), z.boolean()]),
    )
    .optional()
    .default({}),
  type: z.enum(messageTypes).optional().default("text"),
  text: z.string().max(10000).optional(),
  mediaUrl: z.string().max(2048).optional().or(z.literal("")),
  fileName: z.string().max(255).optional().or(z.literal("")),
  fileSize: z.string().max(32).optional().or(z.literal("")),
  attachment: z
    .object({
      type: z.enum(messageTypes).exclude(["text", "link"]),
      mediaUrl: z.string().min(1).max(2048),
      fileName: z.string().max(255).optional(),
      fileSize: z.string().max(32).optional(),
    })
    .optional(),
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
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid request",
        },
        { status: 400 },
      );
    }
    const input = parsed.data;
    const credentialsValid = await verifyTemplateAdminCredentials(
      String(authResult.apiKey.adminId),
      input.adminUserId,
      input.adminPassword,
    );
    if (!credentialsValid) {
      return NextResponse.json(
        { success: false, error: "Invalid admin credentials for this API key" },
        { status: 401 },
      );
    }
    const senderId = String(authResult.apiKey.senderUserId || input.fromUserId || "");
    if (!Types.ObjectId.isValid(senderId) || !Types.ObjectId.isValid(input.toUserId)) {
      return NextResponse.json(
        { success: false, error: "A valid sender and recipient user ID are required" },
        { status: 400 },
      );
    }
    if (
      authResult.apiKey.senderUserId &&
      input.fromUserId &&
      String(authResult.apiKey.senderUserId) !== input.fromUserId
    ) {
      return NextResponse.json(
        { success: false, error: "fromUserId must match the sender bound to this API key" },
        { status: 403 },
      );
    }
    if (senderId === input.toUserId) {
      return NextResponse.json(
        { success: false, error: "Sender and recipient must be different users" },
        { status: 400 },
      );
    }

    await connectDB();

    let templateText = input.template || input.text || "";
    let savedTemplateName: string | undefined;
    if (input.templateId && input.templateName) {
      return NextResponse.json(
        { success: false, error: "Provide templateName or templateId, not both" },
        { status: 400 },
      );
    }
    if (input.templateName) {
      const savedTemplate = await AdminTemplate.findOne({
        name: input.templateName,
        adminId: String(authResult.apiKey.adminId),
      })
        .select("name body")
        .lean();
      if (!savedTemplate) {
        return NextResponse.json(
          { success: false, error: "Template not found for this API key" },
          { status: 404 },
        );
      }
      templateText = savedTemplate.body;
      savedTemplateName = savedTemplate.name;
    } else if (input.templateId) {
      if (!Types.ObjectId.isValid(input.templateId)) {
        return NextResponse.json(
          { success: false, error: "Template not found for this API key" },
          { status: 404 },
        );
      }
      const savedTemplate = await AdminTemplate.findOne({
        _id: input.templateId,
        adminId: String(authResult.apiKey.adminId),
      })
      .select("name body")
        .lean();
      if (!savedTemplate) {
        return NextResponse.json(
          { success: false, error: "Template not found for this API key" },
          { status: 404 },
        );
      }
      templateText = savedTemplate.body;
      savedTemplateName = savedTemplate.name;
    }

    const variableNames = getTemplateVariableNames(templateText);
    const shouldRenderTemplate = Boolean(
      input.templateId || input.templateName || input.template,
    );
    if (shouldRenderTemplate) {
      const rendered = renderMessageTemplate(templateText, input.variables);
      if (rendered.missingVariables.length) {
        return NextResponse.json(
          {
            success: false,
            error: `Provide values for template variables: ${rendered.missingVariables.join(", ")}`,
            missingVariables: rendered.missingVariables,
          },
          { status: 400 },
        );
      }
      templateText = rendered.text;
    }
    if (templateText.length > 10000) {
      return NextResponse.json(
        { success: false, error: "Rendered message is too long" },
        { status: 400 },
      );
    }

    const attachment = input.attachment;
    const mediaUrl = attachment?.mediaUrl || input.mediaUrl || "";
    const fileName = attachment?.fileName || input.fileName || "";
    const fileSize = attachment?.fileSize || input.fileSize || "";
    const type = attachment?.type || input.type;

    if (attachment) {
      const renderedUrl = renderMessageTemplate(mediaUrl, input.variables);
      const renderedName = renderMessageTemplate(fileName, input.variables);
      const renderedSize = renderMessageTemplate(fileSize, input.variables);
      const missingVariables = Array.from(
        new Set([
          ...renderedUrl.missingVariables,
          ...renderedName.missingVariables,
          ...renderedSize.missingVariables,
        ]),
      );
      if (missingVariables.length) {
        return NextResponse.json(
          {
            success: false,
            error: `Provide values for attachment variables: ${missingVariables.join(", ")}`,
            missingVariables,
          },
          { status: 400 },
        );
      }
      if (!isHttpsUrl(renderedUrl.text)) {
        return NextResponse.json(
          { success: false, error: "Attachment URL must use HTTPS" },
          { status: 400 },
        );
      }
      if (
        renderedUrl.text.length > 2048 ||
        renderedName.text.length > 255 ||
        renderedSize.text.length > 32
      ) {
        return NextResponse.json(
          { success: false, error: "Rendered attachment details are too long" },
          { status: 400 },
        );
      }
    }

    if (type === "text" && !templateText.trim()) {
      return NextResponse.json(
        { success: false, error: "Text or a saved message template is required" },
        { status: 400 },
      );
    }
    if (type !== "text" && !mediaUrl) {
      return NextResponse.json(
        { success: false, error: "mediaUrl is required for attachment messages" },
        { status: 400 },
      );
    }

    const senderObjectId = new Types.ObjectId(senderId);
    const recipientObjectId = new Types.ObjectId(input.toUserId);
    const [sender, recipient] = await Promise.all([
      User.exists({ _id: senderObjectId }),
      User.exists({ _id: recipientObjectId }),
    ]);
    if (!sender) {
      return NextResponse.json(
        { success: false, error: "Sender account not found" },
        { status: 400 },
      );
    }
    if (!recipient) {
      return NextResponse.json(
        { success: false, error: "Recipient account not found" },
        { status: 404 },
      );
    }

    const renderedMediaUrl = attachment
      ? renderMessageTemplate(mediaUrl, input.variables).text
      : mediaUrl;
    const renderedFileName = attachment
      ? renderMessageTemplate(fileName, input.variables).text
      : fileName;
    const renderedFileSize = attachment
      ? renderMessageTemplate(fileSize, input.variables).text
      : fileSize;
    const encrypted = {
      text: encryptDirectMessageContent(senderId, input.toUserId, templateText),
      mediaUrl: encryptDirectMessageContent(senderId, input.toUserId, renderedMediaUrl),
      fileName: encryptDirectMessageContent(senderId, input.toUserId, renderedFileName),
      fileSize: encryptDirectMessageContent(senderId, input.toUserId, renderedFileSize),
    };
    const message = await Message.create({
      from: senderObjectId,
      to: recipientObjectId,
      type,
      ...encrypted,
      status: "sent",
    });

    const userA = senderId < input.toUserId ? senderObjectId : recipientObjectId;
    const userB = senderId < input.toUserId ? recipientObjectId : senderObjectId;
    await Conversation.findOneAndUpdate(
      { userA, userB },
      { userA, userB, lastMessageAt: message.createdAt },
      { upsert: true },
    );

    const payload = {
      id: String(message._id),
      from: senderId,
      to: input.toUserId,
      type,
      text: decryptDirectMessageContent(senderId, input.toUserId, encrypted.text),
      mediaUrl: decryptDirectMessageContent(senderId, input.toUserId, encrypted.mediaUrl),
      fileName: decryptDirectMessageContent(senderId, input.toUserId, encrypted.fileName),
      fileSize: decryptDirectMessageContent(senderId, input.toUserId, encrypted.fileSize),
      timestamp: message.createdAt,
      status: message.status,
    };

    await Promise.all([
      invalidateDirectMessages(senderId, input.toUserId),
      invalidateUserConversations(senderId),
      invalidateUserConversations(input.toUserId),
    ]);
    await emitDirectMessageReceived(senderId, input.toUserId, payload);

    return NextResponse.json(
      {
        success: true,
        message: payload,
        template: savedTemplateName
          ? {
              name: savedTemplateName,
              variableCount: variableNames.length,
              variables: variableNames,
            }
          : undefined,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("[api/v1/messages/send] Failed to send message:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
