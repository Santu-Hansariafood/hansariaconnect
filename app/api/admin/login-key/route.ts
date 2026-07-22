import { NextRequest, NextResponse } from "next/server";

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
    response.cookies.set("admin_session", JSON.stringify({ keyLogin: true }), {
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
