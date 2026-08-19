import type { MetadataRoute } from "next"

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://hfconnect.in").replace(/\/+$/, "")
const lastModified = new Date(process.env.NEXT_PUBLIC_SITE_LAST_MODIFIED || "2026-08-19")

export default function sitemap(): MetadataRoute.Sitemap {
  const urls = [
    "/",
    "/about",
    "/contact",
    "/affiliate",
    "/privacy",
    "/terms",
  ]
  return urls.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path === "/" || path === "/about" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : path === "/about" ? 0.8 : 0.5,
  }))
}

