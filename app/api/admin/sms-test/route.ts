import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import {
  consumeAuthRateLimits,
  getAuthRateLimitScopes,
} from "@/lib/auth/authRateLimit";

export const runtime = "nodejs";

const requestSchema = z.object({
  recipients: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
  consent: z.literal(true),
});

const TEST_MESSAGE =
  "HansariaConnect SMS test. If you received this, SMS sending is working.";

type SmsTestResult = {
  recipient: string;
  status: string;
  accepted: boolean;
  messageId?: string;
  error?: string;
};

function normalizePhoneNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (/^\d{10}$/.test(compact)) return `+91${compact}`;
  if (/^91\d{10}$/.test(compact)) return `+${compact}`;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

function getProviderError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message.slice(0, 240);
  }
  return "SMS provider rejected the request.";
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
    if (authResult.session.keyLogin) {
      return NextResponse.json(
        { error: "Sign in with an admin account to send test SMS." },
        { status: 403 },
      );
    }

    const parsed = requestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Provide 1 to 10 phone numbers and confirm that the recipients agreed to receive a test SMS.",
        },
        { status: 400 },
      );
    }

    const results: SmsTestResult[] = [];
    const recipients: string[] = [];
    const seen = new Set<string>();

    for (const input of parsed.data.recipients) {
      const recipient = normalizePhoneNumber(input);
      if (!recipient) {
        results.push({
          recipient: input,
          status: "invalid",
          accepted: false,
          error: "Use a 10-digit Indian mobile number or an E.164 number.",
        });
      } else if (seen.has(recipient)) {
        results.push({
          recipient,
          status: "duplicate",
          accepted: false,
          error: "Duplicate number skipped.",
        });
      } else {
        seen.add(recipient);
        recipients.push(recipient);
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({ completed: true, results });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !from) {
      return NextResponse.json(
        { error: "SMS provider is not configured on the server." },
        { status: 503 },
      );
    }

    const adminId = String(authResult.admin._id);
    const rateScopes = getAuthRateLimitScopes(req, `sms-test:${adminId}`);
    const rateLimit = await consumeAuthRateLimits("admin-sms-test", [
      { scope: rateScopes.ip, limit: 10, windowSeconds: 60 * 60 },
      { scope: rateScopes.target, limit: 3, windowSeconds: 60 * 60 },
      ...recipients.map((recipient) => ({
        scope: `sms-test:${adminId}:recipient:${recipient}`,
        limit: 1,
        windowSeconds: 60 * 60,
      })),
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "SMS test limit reached. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        },
      );
    }

    const client = twilio(accountSid, authToken);
    for (const recipient of recipients) {
      try {
        const message = await client.messages.create({
          body: TEST_MESSAGE,
          from,
          to: recipient,
        });
        results.push({
          recipient,
          status: message.status || "submitted",
          accepted: true,
          messageId: message.sid,
        });
      } catch (error: unknown) {
        results.push({
          recipient,
          status: "failed",
          accepted: false,
          error: getProviderError(error),
        });
      }
    }

    return NextResponse.json({ completed: true, results });
  } catch (error: unknown) {
    console.error(
      "[api/admin/sms-test] Failed to process SMS test request:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Could not process the SMS test request." },
      { status: 500 },
    );
  }
}
