import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext/AppContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hansariaconnect.com"),

  title: {
    default: "HansariaConnect – Secure Encrypted Messaging",
    template: "%s | HansariaConnect",
  },

  description:
    "HansariaConnect is a secure end-to-end encrypted messaging platform designed for privacy, real-time chat, and seamless communication.",

  keywords: [
    "HansariaConnect",
    "Hansaria Chat App",
    "Encrypted Chat",
    "Secure Messaging India",
    "Private Messaging",
    "End-to-End Encryption",
    "Real-time Chat",
    "Instant Messaging App",
    "Made in India Chat App",
    "Secure Communication Hansaria",
  ],

  authors: [{ name: "Santu De" }],

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },

  applicationName: "HansariaConnect",

  openGraph: {
    title: "HansariaConnect – Secure Encrypted Messaging",
    description:
      "A privacy-first encrypted messaging platform built with real-time messaging and modern UX.",
    url: "https://hansariaconnect.com",
    siteName: "HansariaConnect",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "HansariaConnect – Secure Messaging",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "HansariaConnect – Secure Encrypted Messaging",
    description:
      "A privacy-first encrypted messaging platform built for modern communication.",
    images: ["/og-image.png"],
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },

  themeColor: "#0A0A0A",

  manifest: "/manifest.json",

  alternates: {
    canonical: "https://hansariaconnect.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>

      <body
        className={`${inter.variable} ${poppins.variable} bg-neutral-50 text-gray-900 antialiased`}
      >
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
