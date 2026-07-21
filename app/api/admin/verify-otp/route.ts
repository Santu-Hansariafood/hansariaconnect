import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const ADMINS = new Set(["santude1997@gmail.com", "test@gmail.com"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const email = String(body?.email || "")
      .toLowerCase()
      .trim();
    const code = String(body?.code || "").trim();
    if (!email || !ADMINS.has(email)) {
      return NextResponse.json(
        { success: false, error: "Not allowed" },
        { status: 403 },
      );
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid code" },
        { status: 400 },
      );
    }
    const sessionCookie = req.cookies.get("admin_otp_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: "Session missing" },
        { status: 403 },
      );
    }
    let payload: {
      email: string;
      hash: string;
      salt: string;
      exp: number;
    } | null = null;
    try {
      payload = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json(
        { success: false, error: "Bad session" },
        { status: 400 },
      );
    }
    if (!payload || Date.now() > payload.exp) {
      const res = NextResponse.json(
        { success: false, error: "Expired" },
        { status: 403 },
      );
      res.cookies.delete("admin_otp_session");
      return res;
    }
    if (payload.email !== email) {
      return NextResponse.json(
        { success: false, error: "Email mismatch" },
        { status: 403 },
      );
    }
    const hash = crypto
      .createHash("sha256")
      .update(code + payload.salt)
      .digest("hex");
    if (hash !== payload.hash) {
      const res = NextResponse.json(
        { success: false, error: "Incorrect code" },
        { status: 401 },
      );
      res.cookies.delete("admin_otp_session");
      return res;
    }
    const response = NextResponse.json({ success: true });
    response.cookies.delete("admin_otp_session");
    response.cookies.set("admin_session", JSON.stringify({ email }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
