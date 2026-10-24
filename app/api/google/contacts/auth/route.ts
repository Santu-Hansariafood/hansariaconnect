import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/sessionAuth";
import {
  createGoogleOAuthNonce,
  signGoogleOAuthState,
} from "@/lib/auth/googleOAuthState";

export async function GET(req: Request) {
  const session = await getUserSession(req);
  if (!session?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!redirectUri || !clientId) {
    const url = new URL("/contacts?google_error=not_configured", req.url);
    return NextResponse.redirect(url);
  }

  const scope =
    "https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email";

  const nonce = createGoogleOAuthNonce();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state: signGoogleOAuthState(session, nonce),
  }).toString();

  const response = NextResponse.redirect(url);
  response.cookies.set("google_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/contacts/callback",
    maxAge: 10 * 60,
  });
  return response;
}
