import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { verifyGoogleOAuthState } from "@/lib/auth/googleOAuthState";
import { userSessionCookieOptions } from "@/lib/sessionAuth";
import User from "@/models/user/User";

const redirectTo = (
  req: NextRequest,
  destination: string,
  error?: string,
) => {
  const url = new URL(destination, req.url);
  if (error) url.searchParams.set("google_error", error);

  const response = NextResponse.redirect(url);
  response.cookies.set("google_oauth_nonce", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/contacts/callback",
    maxAge: 0,
  });
  return response;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stateSession = verifyGoogleOAuthState(
    searchParams.get("state"),
    req.cookies.get("google_oauth_nonce")?.value,
  );
  if (!stateSession) {
    return redirectTo(req, "/contacts", "state_invalid");
  }

  if (searchParams.has("error")) {
    return redirectTo(req, "/contacts", "cancelled");
  }

  const code = searchParams.get("code");
  if (!code) {
    return redirectTo(req, "/contacts", "missing_code");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectTo(req, "/contacts", "not_configured");
  }

  await connectDB();
  const user = await User.findOne({
    _id: stateSession.id,
    sessions: {
      $elemMatch: {
        sessionId: stateSession.sessionId,
        createdAt: {
          $gt: Date.now() - userSessionCookieOptions.maxAge * 1000,
        },
      },
    },
  });
  if (!user) {
    return redirectTo(req, "/login");
  }

  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
  } catch (error) {
    console.error("[Google Contacts] Could not exchange authorization code:", error);
    return redirectTo(req, "/contacts", "connection_failed");
  }

  const token = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !token.access_token) {
    console.error(
      "[Google Contacts] Authorization code exchange failed:",
      token.error_description || token.error || tokenRes.status,
    );
    return redirectTo(req, "/contacts", "authorization_failed");
  }

  user.googleAccessToken = token.access_token;
  if (token.refresh_token) {
    user.googleRefreshToken = token.refresh_token;
  }
  if (token.expires_in) {
    user.googleTokenExpiry = Date.now() + token.expires_in * 1000;
  }
  await user.save();

  return redirectTo(req, "/contacts?google_connected=1");
}
