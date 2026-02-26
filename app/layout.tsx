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
    default: "HansariaConnect – Secure Encrypted Messaging App",
    template: "%s | HansariaConnect",
  },

  description:
    "HansariaConnect is a secure, privacy-focused encrypted messaging platform with real-time chat and modern UI.",

  keywords: [
    "HansariaConnect",
    "Hansaria Chat",
    "Encrypted Messaging App",
    "Secure Chat App India",
    "Indian WhatsApp Alternative",
    "Private Messaging",
    "HFConnect",
  ],

  authors: [{ name: "Santu De", url: "https://hfconnect.in" }],
  creator: "HansariaConnect",
  publisher: "HansariaConnect",

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

  openGraph: {
    title: "HansariaConnect – Secure Encrypted Messaging App",
    description:
      "A privacy-first encrypted messaging platform with real-time communication.",
    url: "https://hfconnect.in",
    siteName: "HansariaConnect",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/favicon/android-chrome-512x512.png",
        width: 1200,
        height: 630,
        alt: "HansariaConnect Preview",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "HansariaConnect – Secure Encrypted Messaging App",
    description:
      "Modern encrypted messaging app designed for privacy and speed.",
    images: ["/favicon/android-chrome-512x512.png"],
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
              "@type": "WebSite",
              name: "HansariaConnect",
              url: "https://hfconnect.in",
              description:
                "HansariaConnect is a secure encrypted messaging platform.",
              publisher: {
                "@type": "Organization",
                name: "HansariaConnect",
                logo:
                  "https://hfconnect.in/favicon/android-chrome-512x512.png",
              },
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
