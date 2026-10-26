import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { normalizeIndianMobile } from "@/lib/auth/normalizeIndianMobile";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import { encryptBulkMessageJobPayload } from "@/lib/crypto";
import BulkMessageJob from "@/models/message/BulkMessageJob";
import User from "@/models/user/User";
import Admin from "@/models/admin/Admin";
import AdminTemplate from "@/models/admin/AdminTemplate";
import { joinTemplateParts, renderMessageTemplate } from "@/lib/messageTemplates";
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
  fromUserId: z.string().optional(),
  adminId: z.string().optional(),
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

    const senderId = String(
      authResult.apiKey.senderUserId || parsedBody.data.fromUserId || "",
    );
    if (!Types.ObjectId.isValid(senderId)) {
      return NextResponse.json(
        { success: false, error: "This API key is not bound to a sender account" },
        { status: 400 },
      );
    }
    if (
      authResult.apiKey.senderUserId &&
      parsedBody.data.fromUserId &&
      String(authResult.apiKey.senderUserId) !== parsedBody.data.fromUserId
    ) {
      return NextResponse.json(
        { success: false, error: "fromUserId must match the sender bound to this API key" },
        { status: 403 },
      );
    }

    await connectDB();
    const keyOwner = await Admin.findById(String(authResult.apiKey.adminId))
      .select("isSuperAdmin")
      .lean();
    const requestedAdminId = parsedBody.data.adminId?.trim();
    if (requestedAdminId && !Types.ObjectId.isValid(requestedAdminId)) {
      return NextResponse.json(
        { success: false, error: "adminId must be a valid workspace ID" },
        { status: 400 },
      );
    }
    if (
      requestedAdminId &&
      !keyOwner?.isSuperAdmin &&
      requestedAdminId !== String(authResult.apiKey.adminId)
    ) {
      return NextResponse.json(
        { success: false, error: "This API key cannot access that admin workspace" },
        { status: 403 },
      );
    }
    if (
      requestedAdminId &&
      keyOwner?.isSuperAdmin &&
      !(await Admin.exists({ _id: requestedAdminId }))
    ) {
      return NextResponse.json(
        { success: false, error: "Admin workspace not found" },
        { status: 404 },
      );
    }
    const templateScope = keyOwner?.isSuperAdmin
      ? requestedAdminId
        ? { adminId: requestedAdminId }
        : {}
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
          .select("name body subject header footer translations buttons")
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
              .select("name body subject header footer translations buttons")
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
          savedTemplate.subject || savedTemplate.header,
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
        {
          success: false,
          error:
            "Sender account not found. Check the chat account ID bound to this API key; the account must still exist.",
        },
        { status: 400 },
      );
    }

    const recipients = parsedBody.data.recipients;
    const recipientTargets = recipients.map((recipient) => {
      const input = String(recipient.toUserId || recipient.userId || "").trim();
      if (Types.ObjectId.isValid(input)) {
        return { recipient, userId: input, mobile: null };
      }
      const mobile = normalizeIndianMobile(input);
      return mobile ? { recipient, userId: null, mobile } : null;
    });
    if (recipientTargets.some((target) => !target)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Every recipient needs a valid chat account ID or registered Indian mobile number",
        },
        { status: 400 },
      );
    }
    const validTargets = recipientTargets.filter(
      (target): target is NonNullable<typeof target> => target !== null,
    );
    const recipientIds = validTargets.flatMap((target) =>
      target.userId ? [target.userId] : [],
    );
    const recipientMobiles = validTargets.flatMap((target) =>
      target.mobile ? [target.mobile] : [],
    );
    const recipientProfiles = await User.find({
      $or: [
        ...(recipientIds.length ? [{ _id: { $in: recipientIds } }] : []),
        ...(recipientMobiles.length
          ? [{ mobile: { $in: recipientMobiles } }]
          : []),
      ],
    })
      .select("_id mobile preferredLanguage")
      .lean();
    const profilesById = new Map(
      recipientProfiles.map((profile) => [String(profile._id), profile]),
    );
    const profilesByMobile = new Map(
      recipientProfiles.map((profile) => [profile.mobile, profile]),
    );
    const resolvedRecipients = validTargets.map((target) => {
      const profile = target.userId
        ? profilesById.get(target.userId)
        : target.mobile
          ? profilesByMobile.get(target.mobile)
          : undefined;
      return profile
        ? {
            ...target.recipient,
            toUserId: String(profile._id),
            recipientInput: String(
              target.recipient.toUserId || target.recipient.userId || "",
            ),
          }
        : null;
    });
    if (resolvedRecipients.some((recipient) => !recipient)) {
      return NextResponse.json(
        { success: false, error: "One or more recipients do not exist" },
        { status: 400 },
      );
    }
    const validRecipients = resolvedRecipients.filter(
      (recipient): recipient is NonNullable<typeof recipient> =>
        recipient !== null,
    );
    const recipientLanguages = new Map(
      recipientProfiles.map((profile) => [
        String(profile._id),
        profile.preferredLanguage || "en",
      ]),
    );

    const preparedMessages: Array<{
      recipient: string;
      toUserId: string;
      text: string;
      type: "text" | (typeof messageTypes)[number];
      mediaUrl: string;
      fileName: string;
      fileSize: string;
    }> = [];

    for (const recipient of validRecipients) {
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
        recipient: String(recipient.recipientInput || toUserId),
        toUserId,
        text,
        type: attachment?.type || "text",
        mediaUrl,
        fileName,
        fileSize,
      });
    }

    if (!preparedMessages.length) {
      const response = NextResponse.json({
        success: true,
        sent: 0,
        template: savedTemplateName,
      });
      applyApiRateLimitHeaders(response.headers, rateLimit);
      return response;
    }

    const jobId = new Types.ObjectId();
    const jobPayload = JSON.stringify(
      preparedMessages.map((item) => ({
        toUserId: item.toUserId,
        text: item.text,
        mediaUrl: item.mediaUrl,
        fileName: item.fileName,
        fileSize: item.fileSize,
        type: item.type,
        buttons: savedTemplate?.buttons || [],
      })),
    );
    const job = await BulkMessageJob.create({
      _id: jobId,
      apiKeyId: String(authResult.apiKey._id),
      senderId,
      templateName: savedTemplateName,
      status: "queued",
      payload: encryptBulkMessageJobPayload(String(jobId), jobPayload),
      recipients: preparedMessages.map((item) => ({
        recipient: item.recipient,
        toUserId: item.toUserId,
        status: "pending",
        attempts: 0,
      })),
    });

    const response = NextResponse.json(
      {
        success: true,
        queued: preparedMessages.length,
        jobId: String(job._id),
        status: "queued",
        statusUrl: new URL(
          `/api/v1/messages/bulk/${String(job._id)}`,
          req.nextUrl.origin,
        ).toString(),
      },
      { status: 202 },
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
