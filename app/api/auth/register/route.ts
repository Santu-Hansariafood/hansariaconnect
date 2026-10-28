import { NextRequest, NextResponse, after } from "next/server";
import { buildOtpEmailTemplate } from "@/lib/emailTemplates";

export const runtime = "nodejs";
import { connectDB } from "@/lib/db/db";
import { mailFrom, sendMail } from "@/lib/mailer";
import User from "@/models/user/User";
import { signOtpSession, authOtpCookieOptions } from "@/lib/sessionAuth";
import {
  getAgeOnDateOfBirth,
  MINIMUM_REGISTRATION_AGE,
} from "@/lib/auth/ageEligibility";
import {
  isValidPersonName,
  normalizeEmailInput,
  normalizeNameInput,
} from "@/utils/validation/formInputs";
import { createOtpChallenge } from "@/lib/auth/otpChallenge";
import {
  consumeAuthRateLimits,
  getAuthRateLimitScopes,
} from "@/lib/auth/authRateLimit";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const ALLOWED_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|hansariafood\.com)$/i;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const rawName = normalizeNameInput(String(body?.name || "")).trim();
    const name = rawName;
    const email = normalizeEmailInput(String(body?.email || ""));
    const mobile = String(body?.mobile || "").trim();
    const { sex, dateOfBirth, termsAccepted } = body;

    if (
      !rawName ||
      !email ||
      !mobile ||
      !sex ||
      typeof dateOfBirth !== "string" ||
      termsAccepted !== true
    ) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 },
      );
    }

    const age = getAgeOnDateOfBirth(dateOfBirth);
    if (age === null) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid date of birth" },
        { status: 400 },
      );
    }
    if (age < MINIMUM_REGISTRATION_AGE) {
      return NextResponse.json(
        {
          success: false,
          error: `You must be at least ${MINIMUM_REGISTRATION_AGE} years old to register`,
        },
        { status: 403 },
      );
    }

    if (!INDIAN_MOBILE_REGEX.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Indian mobile number" },
        { status: 400 },
      );
    }

    if (!isValidPersonName(name)) {
      return NextResponse.json(
        {
          success: false,
          error: "Name must start with a capital letter and contain only letters, spaces, apostrophes, or hyphens",
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only Gmail, Outlook, and Hansaria Food email addresses are allowed",
        },
        { status: 400 },
      );
    }

    const scopes = getAuthRateLimitScopes(req, mobile);
    const rateLimit = await consumeAuthRateLimits("registration-otp", [
      { scope: scopes.target, limit: 3, windowSeconds: 60 * 60 },
      { scope: scopes.ip, limit: 20, windowSeconds: 60 * 60 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many registration code requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    await connectDB();

    const existingUser = await User.findOne({
      $or: [{ mobile }, { email }],
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "User with this mobile or email already exists",
        },
        { status: 400 },
      );
    }

    const { challengeId, otp } = await createOtpChallenge(
      mobile,
      "registration",
    );

    const template = buildOtpEmailTemplate(name, otp);

    const created = await User.create({
      name,
      email,
      mobile,
      sex,
      dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
      termsAccepted: true,
    });

    const response = NextResponse.json({
      success: true,
      message: "Registration successful, OTP sent to email",
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });

    response.cookies.set(
      "otp_session",
      await signOtpSession({
        challengeId,
        exp: Date.now() + 5 * 60 * 1000,
      }),
      authOtpCookieOptions,
    );

    // Reply first, then mail the code. If the mail server rejects it the account
    // is rolled back so the user can register again instead of being left with
    // an account they can never verify.
    after(async () => {
      try {
        await sendMail({
          from: mailFrom(),
          to: email,
          subject: template.subject,
          text: template.text,
          html: template.html,
        });
      } catch (emailError) {
        console.error(
          "[auth/register] OTP email could not be sent, rolling back the account:",
          emailError instanceof Error ? emailError.message : emailError,
        );
        try {
          await User.deleteOne({ _id: created._id });
        } catch (rollbackError) {
          console.error(
            "[auth/register] Rollback failed:",
            rollbackError instanceof Error ? rollbackError.message : rollbackError,
          );
        }
      }
    });

    return response;
  } catch (error: unknown) {
    console.error("Registration Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to register",
      },
      { status: 500 },
    );
  }
}
