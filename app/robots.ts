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
          "/admin",
          "/admin/*",
          "/chat",
          "/chat/*",
          "/login",
          "/otp",
          "/verify-otp",
          "/name-entry",
          "/settings",
          "/profile",
          "/contacts",
          "/groups",
          "/status",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}

