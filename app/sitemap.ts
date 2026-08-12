import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://hfconnect.in").replace(/\/$/, "")
  const now = new Date()
  const urls = [
    "/",
    "/chats",
    "/contacts",
    "/groups",
    "/status",
    "/profile",
    "/settings",
    "/login",
    "/verify-otp",
    "/otp",
    "/name-entry",
    "/terms",
  ]
  return urls.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : 0.7,
  }))
}

