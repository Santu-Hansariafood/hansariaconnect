import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession, getUserSession } from "@/lib/edgeSessionAuth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/verify-otp",
  "/otp",
  "/name-entry",
  "/terms",
  "/admin/login",
]);

const PUBLIC_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/verify",
  "/api/auth/logout",
  "/api/auth/scan",
  "/api/auth/me",
  "/api/auth/[...nextauth]",
  "/api/admin/login",
  "/api/admin/login-key",
  "/api/admin/request-otp",
  "/api/admin/verify-otp",
  "/api/admin/logout",
  "/api/send-otp",
  "/api/verify-otp",
  "/_next",
  "/favicon",
  "/logo",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

function isProtectedUserPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  const protectedPaths = [
    "/chat/",
    "/chats",
    "/profile",
    "/settings",
    "/contacts",
    "/groups",
    "/status",
    "/create-group",
    "/group-settings/",
  ];
  for (const p of protectedPaths) {
    if (pathname.startsWith(p) || pathname === p.replace("/", "")) {
      return true;
    }
  }
  if (pathname.startsWith("/chat")) return true;
  if (pathname.startsWith("/group-settings")) return true;
  return false;
}

function extractChatId(pathname: string): string | null {
  const chatMatch = pathname.match(/^\/chat\/([^/?#]+)/);
  if (chatMatch) return chatMatch[1];
  return null;
}

function extractGroupSettingsId(pathname: string): string | null {
  const groupMatch = pathname.match(/^\/group-settings\/([^/?#]+)/);
  if (groupMatch) return groupMatch[1];
  return null;
}

const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

export async function middleware(req: NextRequest) {
  const { nextUrl, headers } = req;

  const host = headers.get("host") || "";

  const isAdminSubdomain = /^admin\./i.test(host);
  const isSuperSubdomain = /^super\./i.test(host);
  const isWebSubdomain = /^web\./i.test(host);

  const { pathname } = nextUrl;

  if (
    isSuperSubdomain &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api")
  ) {
    const url = req.nextUrl.clone();

    url.pathname =
      `/admin${pathname === "/" ? "" : pathname}`;

    return NextResponse.rewrite(url);
  }

  if (
    isAdminSubdomain &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api")
  ) {
    const url = req.nextUrl.clone();

    url.pathname =
      `/admin${pathname === "/" ? "" : pathname}`;

    return NextResponse.rewrite(url);
  }

  if (isWebSubdomain && pathname === "/") {
    const url = req.nextUrl.clone();

    url.pathname = "/login";

    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login")
  ) {
    const session = await getAdminSession(req);

    if (!session) {
      const url = req.nextUrl.clone();

      url.pathname = "/admin/login";
      url.search = "";

      return NextResponse.redirect(url);
    }

    if (
      isSuperSubdomain &&
      !session.isSuperAdmin
    ) {
      const url = req.nextUrl.clone();

      url.pathname = "/admin/login";
      url.search = "";

      return NextResponse.redirect(url);
    }
  }

  if (!isPublicPath(pathname) && isProtectedUserPath(pathname)) {
    const userSession = await getUserSession(req);

    if (!userSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }

    const chatId = extractChatId(pathname);
    if (chatId && !isValidObjectId(chatId)) {
      const url = req.nextUrl.clone();
      url.pathname = "/chats";
      url.search = "";
      return NextResponse.redirect(url);
    }

    const groupSettingsId = extractGroupSettingsId(pathname);
    if (groupSettingsId && !isValidObjectId(groupSettingsId)) {
      const url = req.nextUrl.clone();
      url.pathname = "/groups";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
