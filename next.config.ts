/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  generateEtags: true,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "graph.facebook.com",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
      },
      {
        protocol: "https",
        hostname: "gravatar.com",
      },
      {
        protocol: "https",
        hostname: "www.gravatar.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Hold optimized images at the edge for an hour instead of re-fetching every
    // minute, so a busy deploy serves avatars/media without hammering the origin.
    minimumCacheTTL: 3600,
    unoptimized: false,
  },
  // Strip debug logging from production bundles; keep errors/warnings so real
  // failures are still visible in the field.
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
  experimental: {
    // Rewrites barrel imports to per-module paths so only the icons/helpers that
    // are used ship in the bundle.
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "react-icons",
      "date-fns",
      "emoji-picker-react",
    ],
  },
}

module.exports = nextConfig
