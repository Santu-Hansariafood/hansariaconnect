import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://hfconnect.in"
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
    sitemap: `${base}/sitemap.xml`,
  }
}

