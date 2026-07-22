import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const { nextUrl, headers } = req
  const host = headers.get("host") || ""
  const isAdminSubdomain = /^admin\./i.test(host)
  const isSuperSubdomain = /^super\./i.test(host)
  const isWebSubdomain = /^web\./i.test(host)
  const { pathname } = nextUrl
  
  // Handle super subdomain: redirect to /admin
  if (isSuperSubdomain && !pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
    const url = req.nextUrl.clone()
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`
    return NextResponse.rewrite(url)
  }
  
  // Handle admin subdomain
  if (isAdminSubdomain && !pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
    const url = req.nextUrl.clone()
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`
    return NextResponse.rewrite(url)
  }
  
  // Handle web subdomain (redirect to /login which will show QR)
  if (isWebSubdomain && pathname === "/") {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
  
  // Protect admin routes
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = req.cookies.get("admin_session")?.value
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = "/admin/login"
      url.search = ""
      return NextResponse.redirect(url)
    }
    
    // If on super subdomain, ensure session is a super admin
    if (isSuperSubdomain) {
      try {
        const sessionData = JSON.parse(session)
        if (!sessionData.isSuperAdmin) {
          const url = req.nextUrl.clone()
          url.pathname = "/admin/login"
          url.search = ""
          return NextResponse.redirect(url)
        }
      } catch {
        const url = req.nextUrl.clone()
        url.pathname = "/admin/login"
        url.search = ""
        return NextResponse.redirect(url)
      }
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ["/:path*"],
}
