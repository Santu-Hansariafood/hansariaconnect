import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://hfconnect.in").replace(/\/$/, "")
  const now = new Date()
  const urls = [
    "/",
    "/terms",
    "/privacy",
    "/about",
    "/contact",
    "/affiliate",
  ]
  return urls.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : path === "/about" ? 0.8 : 0.6,
  }))
}

