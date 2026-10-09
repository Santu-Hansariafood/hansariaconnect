import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";
import Admin from "@/models/admin/Admin";
import AdminTemplate from "@/models/admin/AdminTemplate";
import { decryptDirectMessageContent, encryptDirectMessageContent } from "@/lib/crypto";
import {
  invalidateDirectMessages,
  invalidateUserConversations,
} from "@/lib/redis/redis";
import { emitDirectMessageReceived } from "@/lib/socketEmitter";
import {
  getTemplateVariableNames,
  joinTemplateParts,
  renderMessageTemplate,
} from "@/lib/messageTemplates";
import { verifyTemplateAdminCredentials } from "@/lib/templateAdminAuth";
import { getLocalizedTemplateText } from "@/lib/templateTranslations";
import type { TemplateActionButton } from "@/lib/templateActionButtons";
import { readJsonRequestBody } from "@/lib/apiRequestBody";
import {
  applyApiRateLimitHeaders,
  consumeApiRateLimit,
  RateLimitStoreUnavailableError,
} from "@/lib/apiRateLimit";

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
  adminUserId: z.string().min(1).max(100),
  adminPassword: z.string().min(1).max(256),
  fromUserId: z.string().optional(),
  toUserId: z.string(),
  templateId: z.string().optional(),
  language: z.string().trim().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i).optional(),
  templateName: z.string().trim().min(1).max(100).optional(),
  template: z.string().max(2000).optional(),
  variables: z
    .record(
      z.string(),
      z.union([z.string().max(10000), z.number(), z.boolean()]),
    )
    .optional()
    .default({})
    .refine((variables) => Object.keys(variables).length <= 100, {
      message: "A maximum of 100 template variables is allowed",
    }),
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

const normalizeIndianMobile = (value: string): string | null => {
  if (!/^\+?[\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  const mobile =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(mobile) ? mobile : null;
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

    const rateLimit = await consumeApiRateLimit(
      String(authResult.apiKey._id),
      1,
    );
    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: "API rate limit exceeded",
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429 },
      );
      applyApiRateLimitHeaders(response.headers, rateLimit);
      return response;
    }

    const bodyResult = await readJsonRequestBody(req);
    if (!bodyResult.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            bodyResult.reason === "too_large"
              ? "Request body exceeds the 2 MB limit"
              : "Request body must be valid JSON",
        },
        { status: bodyResult.reason === "too_large" ? 413 : 400 },
      );
    }
    const parsed = requestSchema.safeParse(bodyResult.body);
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
    if (!Types.ObjectId.isValid(senderId)) {
      return NextResponse.json(
        { success: false, error: "A valid sender user ID is required" },
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
    await connectDB();
    const recipientPhone = normalizeIndianMobile(input.toUserId);
    if (!Types.ObjectId.isValid(input.toUserId) && !recipientPhone) {
      return NextResponse.json(
        {
          success: false,
          error:
            "toUserId must be a chat account ID or a valid registered Indian mobile number",
        },
        { status: 400 },
      );
    }
    const recipientProfile = await User.findOne(
      Types.ObjectId.isValid(input.toUserId)
        ? { _id: input.toUserId }
        : { mobile: recipientPhone },
    )
      .select("_id preferredLanguage")
      .lean();
    if (!recipientProfile) {
      return NextResponse.json(
        { success: false, error: "Recipient account not found" },
        { status: 404 },
      );
    }
    const recipientId = String(recipientProfile._id);
    if (senderId === recipientId) {
      return NextResponse.json(
        { success: false, error: "Sender and recipient must be different users" },
        { status: 400 },
      );
    }
    const language = input.language || recipientProfile?.preferredLanguage || "en";
    const keyOwner = await Admin.findById(String(authResult.apiKey.adminId))
      .select("isSuperAdmin")
      .lean();
    const templateScope = keyOwner?.isSuperAdmin
      ? {}
      : { adminId: String(authResult.apiKey.adminId) };

    let templateText = input.template || input.text || "";
    let savedTemplateName: string | undefined;
    let actionButtons: TemplateActionButton[] = [];
    if (input.templateId && input.templateName) {
      return NextResponse.json(
        { success: false, error: "Provide templateName or templateId, not both" },
        { status: 400 },
      );
    }
    if (input.templateName) {
      const matchingTemplates = await AdminTemplate.find({
        name: input.templateName,
        ...templateScope,
      })
        .select("name body header footer translations buttons")
        .limit(keyOwner?.isSuperAdmin ? 2 : 1)
        .lean();
      if (matchingTemplates.length > 1) {
          return NextResponse.json(
          {
            success: false,
            error: "Template name is used by multiple workspaces; provide templateId instead",
          },
          { status: 409 },
        );
      }
      const savedTemplate = matchingTemplates[0];
      if (!savedTemplate) {
        return NextResponse.json(
          { success: false, error: "Template not found for this API key" },
          { status: 404 },
        );
      }
      templateText = getLocalizedTemplateText(
        savedTemplate.body,
        savedTemplate.translations,
        language,
      );
      templateText = joinTemplateParts(
        savedTemplate.header,
        templateText,
        savedTemplate.footer,
      );
      savedTemplateName = savedTemplate.name;
      actionButtons = savedTemplate.buttons || [];
    } else if (input.templateId) {
      if (!Types.ObjectId.isValid(input.templateId)) {
        return NextResponse.json(
          { success: false, error: "Template not found for this API key" },
          { status: 404 },
        );
      }
      const savedTemplate = await AdminTemplate.findOne({
        _id: input.templateId,
        ...templateScope,
      })
      .select("name body header footer translations buttons")
        .lean();
      if (!savedTemplate) {
        return NextResponse.json(
          { success: false, error: "Template not found for this API key" },
          { status: 404 },
        );
      }
      templateText = getLocalizedTemplateText(
        savedTemplate.body,
        savedTemplate.translations,
        language,
      );
      templateText = joinTemplateParts(
        savedTemplate.header,
        templateText,
        savedTemplate.footer,
      );
      savedTemplateName = savedTemplate.name;
      actionButtons = savedTemplate.buttons || [];
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
    const recipientObjectId = new Types.ObjectId(recipientId);
    const sender = await User.exists({ _id: senderObjectId });
    if (!sender) {
      return NextResponse.json(
        { success: false, error: "Sender account not found" },
        { status: 400 },
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
      text: encryptDirectMessageContent(senderId, recipientId, templateText),
      mediaUrl: encryptDirectMessageContent(senderId, recipientId, renderedMediaUrl),
      fileName: encryptDirectMessageContent(senderId, recipientId, renderedFileName),
      fileSize: encryptDirectMessageContent(senderId, recipientId, renderedFileSize),
    };
    const message = await Message.create({
      from: senderObjectId,
      to: recipientObjectId,
      apiKeyId: String(authResult.apiKey._id),
      type,
      ...encrypted,
      buttons: actionButtons,
      status: "sent",
    });

    const userA = senderId < recipientId ? senderObjectId : recipientObjectId;
    const userB = senderId < recipientId ? recipientObjectId : senderObjectId;
    await Conversation.findOneAndUpdate(
      { userA, userB },
      { userA, userB, lastMessageAt: message.createdAt },
      { upsert: true },
    );

    const payload = {
      id: String(message._id),
      from: senderId,
      to: recipientId,
      type,
      text: decryptDirectMessageContent(senderId, recipientId, encrypted.text),
      mediaUrl: decryptDirectMessageContent(senderId, recipientId, encrypted.mediaUrl),
      fileName: decryptDirectMessageContent(senderId, recipientId, encrypted.fileName),
      fileSize: decryptDirectMessageContent(senderId, recipientId, encrypted.fileSize),
      buttons: actionButtons,
      timestamp: message.createdAt,
      status: message.status,
    };

    await Promise.all([
      invalidateDirectMessages(senderId, recipientId),
      invalidateUserConversations(senderId),
      invalidateUserConversations(recipientId),
    ]);
    await emitDirectMessageReceived(senderId, recipientId, payload);

    const response = NextResponse.json(
      {
        success: true,
        message: payload,
        template: savedTemplateName
          ? {
              name: savedTemplateName,
              variableCount: variableNames.length,
              variables: variableNames,
              language,
            }
          : undefined,
      },
      { status: 201 },
    );
    applyApiRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error: unknown) {
    if (error instanceof RateLimitStoreUnavailableError) {
      return NextResponse.json(
        { success: false, error: "API rate limiting is temporarily unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/v1/messages/send] Failed to send message:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send message",
      },
      { status: 500 },
    );
  }
}
