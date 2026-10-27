import type { Metadata, Viewport } from "next";
import { Roboto, Poppins } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext/AppContext";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-roboto",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hfconnect.in"),

  title: {
    default: "HansariaConnect | Indian AI-Powered Chat Application",
    template: "%s | HansariaConnect",
  },

  description:
    "HansariaConnect is an Indian AI-powered chat application created by the Hansaria Food IT team for private messaging, groups, media sharing, and local communities.",

  keywords: [
    "Hansaria Food IT",
    "HansariaConnect",
    "Santu's Creations",
    "Hansaria Food Private Limited",
    "Indian AI chat application",
    "India messaging app",
    "Indian chat application",
    "AI-powered chat app India",
    "Made in India app",
    "Indian messaging platform",
    "local community chat app",
    "Hansaria Food IT team",
  ],

  authors: [{ name: "Hansaria Food Private Limited", url: "https://hfconnect.in" }],
  creator: "Hansaria Food IT Team",
  publisher: "Hansaria Food Private Limited",
  category: "technology",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },

  applicationName: "HansariaConnect",
  appleWebApp: {
    capable: true,
    title: "HansariaConnect",
    statusBarStyle: "default",
  },

  openGraph: {
    title: "HansariaConnect | Indian AI-Powered Chat Application",
    description:
      "Private, practical messaging made in India by the Hansaria Food IT team.",
    url: "https://hfconnect.in",
    siteName: "HansariaConnect",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://hfconnect.in/favicon/android-chrome-512x512.png",
        width: 1200,
        height: 630,
        alt: "HansariaConnect Secure Messaging",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "HansariaConnect | Indian AI-Powered Chat Application",
    description:
      "An Indian chat application for private conversations, groups, media sharing, and local communities.",
    creator: "@HansariaConnect",
    images: ["https://hfconnect.in/favicon/android-chrome-512x512.png"],
  },

  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-32x32.png", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },

  manifest: "/manifest.json",

  alternates: {
    canonical: "https://hfconnect.in",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ca678",
  viewportFit: "cover",
};

/*
 * Every deploy replaces the hashed files under /_next/static. A page that is
 * still holding the previous build — or one that was loading exactly while the
 * files were being swapped — asks for a chunk that no longer exists, gets a 404
 * back, and never boots: the "ChunkLoadError ... Failed to load chunk" console
 * error. Reloading fetches the current HTML, and with it the chunks that match
 * it, so the failure heals itself instead of leaving a dead page.
 *
 * Guarded so it can never become a reload loop, and deliberately tiny.
 */
const chunkRecoveryScript = `
(function () {
  var AT_KEY = "hansaria.chunkRecoveryAt";
  var COUNT_KEY = "hansaria.chunkRecoveryCount";
  var COOLDOWN_MS = 10000;
  var WINDOW_MS = 300000;
  var MAX_ATTEMPTS = 2;
  var reloading = false;

  var storage = (function () {
    try {
      var probe = "__hansaria_probe__";
      sessionStorage.setItem(probe, "1");
      sessionStorage.removeItem(probe);
      return sessionStorage;
    } catch (error) {
      // Without working storage there is no way to break a reload loop, so
      // recovery is left to the user rather than risking an endless refresh.
      return null;
    }
  })();

  if (!storage) return;

  var readNumber = function (key) {
    var value = parseInt(storage.getItem(key) || "", 10);
    return isNaN(value) ? 0 : value;
  };

  var recover = function (reason) {
    if (reloading) return;

    var now = Date.now();
    var lastAt = readNumber(AT_KEY);
    var attempts = now - lastAt > WINDOW_MS ? 0 : readNumber(COUNT_KEY);
    var tooSoon = now - lastAt < COOLDOWN_MS;
    if (tooSoon || attempts >= MAX_ATTEMPTS) return;

    reloading = true;
    storage.setItem(AT_KEY, String(now));
    storage.setItem(COUNT_KEY, String(attempts + 1));
    console.warn("[bootstrap] " + reason + " - reloading to load the current build.");
    window.location.reload();
  };

  var isBuildAsset = function (url) {
    return typeof url === "string" && url.indexOf("/_next/static/") !== -1;
  };

  // Resource errors do not bubble, so they are caught in the capture phase.
  // Only fatal assets are considered: a failed preload is retried by the real
  // tag, whereas a failed script or stylesheet leaves the app broken.
  window.addEventListener("error", function (event) {
    var target = event.target;
    if (!target || !target.tagName) return;
    if (target.tagName === "SCRIPT" && isBuildAsset(target.src)) {
      recover("A script from a previous build is gone (404)");
    } else if (target.tagName === "LINK" && target.rel === "stylesheet" && isBuildAsset(target.href)) {
      recover("A stylesheet from a previous build is gone (404)");
    }
  }, true);

  // The same failure surfaces in the app as a rejected dynamic import.
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason || {};
    var message = String(reason.message || reason);
    if (
      reason.name === "ChunkLoadError" ||
      /Loading chunk [^ ]+ failed|Failed to load chunk|error loading dynamically imported module/i.test(message)
    ) {
      recover("A JavaScript chunk failed to load");
    }
  });
})();
`;

/*
 * Runs before the first paint so the saved theme is applied instantly and the
 * app never flashes the default green on top of a custom one. Kept tiny and
 * dependency-free on purpose.
 */
const themeBootstrapScript = `
(function () {
  try {
    var raw = localStorage.getItem("hansariaTheme");
    if (!raw) return;
    var theme = JSON.parse(raw) || {};
    var root = document.documentElement;
    if (theme.primary) root.style.setProperty("--brand-primary", theme.primary);
    if (theme.secondary) root.style.setProperty("--brand-secondary", theme.secondary);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    if (theme.primary) meta.setAttribute("content", theme.primary);
  } catch (error) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />

        <meta
          name="google-site-verification"
          content="KOtoHmfJpZzpPdAhcnsZcPBaO41N8EKdujIWScgtK5E"
        />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />

        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/favicon/apple-touch-icon.png" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://hfconnect.in/#organization",
                  name: "Hansaria Food Private Limited",
                  url: "https://hfconnect.in",
                  description:
                    "The Indian company behind HansariaConnect and its digital communication products.",
                  logo: "https://hfconnect.in/favicon/android-chrome-512x512.png",
                  brand: {
                    "@type": "Brand",
                    name: "HansariaConnect",
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": "https://hfconnect.in/#website",
                  name: "HansariaConnect",
                  url: "https://hfconnect.in",
                  description:
                    "An Indian AI-powered chat application created by the Hansaria Food IT team.",
                  publisher: { "@id": "https://hfconnect.in/#organization" },
                  inLanguage: "en-IN",
                },
                {
                  "@type": "SoftwareApplication",
                  "@id": "https://hfconnect.in/#application",
                  name: "HansariaConnect",
                  applicationCategory: "CommunicationApplication",
                  operatingSystem: "Web, Android",
                  url: "https://hfconnect.in/chat",
                  description:
                    "An Indian AI-powered chat application for private messaging, groups, media sharing, and local communities.",
                  creator: { "@id": "https://hfconnect.in/#organization" },
                  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
                },
              ],
            }),
          }}
        />
      </head>

      <body
        className={`${roboto.variable} ${poppins.variable} bg-neutral-50 text-gray-900 antialiased`}
      >
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
