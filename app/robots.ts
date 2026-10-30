import type { MetadataRoute } from "next"

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://hfconnect.in").replace(/\/+$/, "")

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api",
          "/api/*",
          "/admin",
          "/admin/*",
          "/chat",
          "/chat/*",
          "/auth",
          "/auth/*",
          "/otp",
          "/otp/*",
          "/verify-otp",
          "/verify-otp/*",
          "/name-entry",
          "/name-entry/*",
          "/settings",
          "/settings/*",
          "/profile",
          "/profile/*",
          "/contacts",
          "/contacts/*",
          "/groups",
          "/groups/*",
          "/create-group",
          "/create-group/*",
          "/group-settings",
          "/group-settings/*",
          "/status",
          "/status/*",
          "/scan",
          "/scan/*",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
