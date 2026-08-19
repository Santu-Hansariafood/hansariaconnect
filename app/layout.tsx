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
    "HansariaConnect",
    "secure chat",
    "encrypted messaging",
    "privacy-focused messaging",
    "real-time chat",
    "group chat",
    "OTP login",
    "single-device login",
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
  themeColor: "#0A0A0A",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
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
