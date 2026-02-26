import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const { nextUrl, headers } = req
  const host = headers.get("host") || ""
  const isAdminSubdomain = /^admin\./i.test(host)
  const { pathname } = nextUrl
  if (isAdminSubdomain && !pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
    const url = req.nextUrl.clone()
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`
    return NextResponse.rewrite(url)
  }
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = req.cookies.get("admin_session")?.value
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = "/admin/login"
      url.search = ""
      return NextResponse.redirect(url)
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/:path*"],
}

