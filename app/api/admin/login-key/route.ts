import { NextRequest, NextResponse } from "next/server";
import { signAdminSession, adminSessionCookieOptions } from "@/lib/sessionAuth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const key = String(body?.key || "").trim();

    const adminLoginKey = process.env.ADMIN_LOGIN_KEY;
    if (!adminLoginKey) {
      return NextResponse.json(
        { success: false, error: "Admin login key not configured" },
        { status: 500 },
      );
    }

    if (key !== adminLoginKey) {
      return NextResponse.json(
        { success: false, error: "Invalid login key" },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(
      "admin_session",
      signAdminSession({
        keyLogin: true,
        adminId: process.env.ADMIN_LOGIN_KEY_ID || "admin-key-login",
        userId: process.env.ADMIN_LOGIN_KEY_ID || "admin-key-login",
        email: process.env.ADMIN_LOGIN_KEY_EMAIL || "admin-key-login@local",
        isSuperAdmin: false,
      }),
      adminSessionCookieOptions,
    );
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
