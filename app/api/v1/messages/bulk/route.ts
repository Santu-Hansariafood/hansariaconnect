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
import { encryptDirectMessageContent, decryptDirectMessageContent } from "@/lib/crypto";
import {
  getTemplateVariableNames,
  joinTemplateParts,
  renderMessageTemplate,
} from "@/lib/messageTemplates";
import { normalizeTemplateTranslations } from "@/lib/templateTranslations";
import { verifyTemplateAdminCredentials } from "@/lib/templateAdminAuth";
import {
  invalidateDirectMessages,
  invalidateUserConversations,
} from "@/lib/redis/redis";
import { emitDirectMessageReceived } from "@/lib/socketEmitter";
import { getLocalizedTemplateText } from "@/lib/templateTranslations";
import { readJsonRequestBody } from "@/lib/apiRequestBody";
import {
  applyApiRateLimitHeaders,
  consumeApiRateLimit,
  RateLimitStoreUnavailableError,
} from "@/lib/apiRateLimit";

const MAX_RECIPIENTS = 1000;
const messageTypes = ["image", "video", "voice", "pdf", "excel", "file"] as const;

const requestSchema = z.object({
  adminUserId: z.string().min(1).max(100),
  adminPassword: z.string().min(1).max(256),
  templateId: z.string().optional(),
  templateName: z.string().trim().min(1).max(100).optional(),
  template: z.string().max(2000).optional(),
  text: z.string().max(10000).optional(),
  recipients: z
    .array(
      z.object({
        toUserId: z.string().optional(),
        userId: z.string().optional(),
        language: z.string().trim().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i).optional(),
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

    let rateLimit = await consumeApiRateLimit(
      String(authResult.apiKey._id),
      0,
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
    const parsedBody = requestSchema.safeParse(bodyResult.body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: parsedBody.error.issues[0]?.message || "Invalid request" },
        { status: 400 },
      );
    }

    rateLimit = await consumeApiRateLimit(
      String(authResult.apiKey._id),
      parsedBody.data.recipients.length,
      false,
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
    const keyOwner = await Admin.findById(String(authResult.apiKey.adminId))
      .select("isSuperAdmin")
      .lean();
    const templateScope = keyOwner?.isSuperAdmin
      ? {}
      : { adminId: String(authResult.apiKey.adminId) };

    if (parsedBody.data.templateId && parsedBody.data.templateName) {
      return NextResponse.json(
        { success: false, error: "Provide templateName or templateId, not both" },
        { status: 400 },
      );
    }

    const matchingTemplates = parsedBody.data.templateName
      ? await AdminTemplate.find({
          name: parsedBody.data.templateName,
          ...templateScope,
        })
          .select("name body header footer translations buttons")
          .limit(keyOwner?.isSuperAdmin ? 2 : 1)
          .lean()
      : [];
    if (matchingTemplates.length > 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Template name is used by multiple workspaces; provide templateId instead",
        },
        { status: 409 },
      );
    }
    const savedTemplate = parsedBody.data.templateName
      ? matchingTemplates[0]
      : parsedBody.data.templateId
        ? Types.ObjectId.isValid(parsedBody.data.templateId)
          ? await AdminTemplate.findOne({
              _id: parsedBody.data.templateId,
              ...templateScope,
            })
              .select("name body header footer translations buttons")
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
    const templateText = savedTemplate
      ? joinTemplateParts(
          savedTemplate.header,
          savedTemplate.body,
          savedTemplate.footer,
        )
      : parsedBody.data.template || parsedBody.data.text;
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
    const savedTranslations = normalizeTemplateTranslations(
      savedTemplate?.translations,
    );
    const templateVariables = Array.from(
      new Set(
        [
          templateText,
          ...Object.values(savedTranslations).map((translation) =>
            joinTemplateParts(savedTemplate?.header, translation, savedTemplate?.footer),
          ),
        ].flatMap(getTemplateVariableNames),
      ),
    );
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
    const recipientProfiles = await User.find({
      _id: { $in: recipientIds },
    })
      .select("_id preferredLanguage")
      .lean();
    const recipientLanguages = new Map(
      recipientProfiles.map((profile) => [
        String(profile._id),
        profile.preferredLanguage || "en",
      ]),
    );

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

      const language =
        (recipient.language || recipientLanguages.get(toUserId) || "en").toLowerCase();
      const recipientTemplateText = savedTemplate
        ? joinTemplateParts(
            savedTemplate.header,
            getLocalizedTemplateText(
              savedTemplate.body,
              savedTemplate.translations,
              language,
            ),
            savedTemplate.footer,
          )
        : templateText;
      const { text, missingVariables } = renderMessageTemplate(
        recipientTemplateText,
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
        apiKeyId: String(authResult.apiKey._id),
        type: item.type,
        ...encrypted,
        buttons: savedTemplate?.buttons || [],
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
        buttons: savedTemplate?.buttons || [],
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

    const response = NextResponse.json({
      success: true,
      sent: created.length,
      messages: created,
      template: savedTemplateName
        ? {
            name: savedTemplateName,
            variableCount: templateVariables.length,
            variables: templateVariables,
            languages: Object.keys(savedTranslations),
          }
        : undefined,
    });
    applyApiRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error: unknown) {
    if (error instanceof RateLimitStoreUnavailableError) {
      return NextResponse.json(
        { success: false, error: "API rate limiting is temporarily unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/v1/messages/bulk] Failed to send messages:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send bulk messages",
      },
      { status: 500 },
    );
  }
}
