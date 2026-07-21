import { NextResponse } from "next/server";

export async function GET() {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  const scope =
    "https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email";

  const url =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    "&access_type=offline" +
    "&prompt=consent";

  return NextResponse.redirect(url);
}
