import { NextRequest, NextResponse, after } from "next/server";
import { digestHex, randomBytesHex } from "@/lib/crypto";
import { buildOtpEmailTemplate } from "@/lib/emailTemplates";

export const runtime = "nodejs";
import { connectDB } from "@/lib/db/db";
import { mailFrom, sendMail } from "@/lib/mailer";
import User from "@/models/user/User";
import { signOtpSession, authOtpCookieOptions } from "@/lib/sessionAuth";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const ALLOWED_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|hansariafood\.com)$/i;

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const rawName = String(body?.name || "").trim();
    const name = rawName;
    const email = String(body?.email || "").trim().toLowerCase();
    const mobile = String(body?.mobile || "").trim();
    const { sex, dateOfBirth, termsAccepted } = body;

    if (!rawName || !email || !mobile || !sex || !dateOfBirth || !termsAccepted) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 },
      );
    }

    if (!INDIAN_MOBILE_REGEX.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Indian mobile number" },
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

    const otp = generateOtp();

    const template = buildOtpEmailTemplate(name, otp);

    const created = await User.create({
      name: rawName,
      email,
      mobile,
      sex,
      dateOfBirth: new Date(dateOfBirth),
      termsAccepted,
    });

    const salt = await randomBytesHex(16);
    const hash = await digestHex("SHA-256", otp + salt);

    const payload = {
      mobile,
      hash,
      salt,
      exp: Date.now() + 5 * 60 * 1000,
    };

    const response = NextResponse.json({
      success: true,
      message: "Registration successful, OTP sent to email",
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });

    response.cookies.set(
      "otp_session",
      await signOtpSession(payload),
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
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
