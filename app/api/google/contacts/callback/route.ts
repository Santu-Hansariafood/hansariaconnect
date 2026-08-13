import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Contact from "@/models/contact/Contact";
import { getUserSession } from "@/lib/sessionAuth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const token = await tokenRes.json();
  if (!token.access_token)
    return NextResponse.json({ error: "Token error" }, { status: 400 });

  const session = await getUserSession(req as any);
  if (!session?.id) {
    return NextResponse.redirect("/login");
  }

  await connectDB();

  const user = await User.findById(session.id);
  if (!user) {
    return NextResponse.redirect("/login");
  }

  user.googleAccessToken = token.access_token;
  if (token.refresh_token) {
    user.googleRefreshToken = token.refresh_token;
  }
  if (token.expires_in) {
    user.googleTokenExpiry = Date.now() + token.expires_in * 1000;
  }
  await user.save();

  // Save tokens and redirect user back to contacts page.
  // Contacts import should only happen after an explicit user confirmation
  // to avoid automatic import from Google address book.
  return NextResponse.redirect("/contacts?google_connected=1");
}
