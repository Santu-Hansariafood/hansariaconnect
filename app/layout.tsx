import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext/AppContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "HansariaConnect – Secure Encrypted Messaging",
  description:
    "HansariaConnect is a secure end-to-end encrypted chat platform designed for privacy, real-time messaging, and seamless communication.",
  keywords: [
    "HansariaConnect",
    "Chat App Hansaria",
    "Messaging App Hansaria",
    "Secure Chat App Hansaria",
    "Encrypted Messaging Hansaria",
    "Private Chat Hansaria",
    "Real-time Messaging Hansaria",
    "Chat Application Hansaria",
    "Instant Messaging Hansaria",
    "Secure Communication Hansaria",
    "Privacy-focused Chat Hansaria",
    "End-to-End Encryption Hansaria",
    "Hansaria Chat Platform",
    "Hansaria Messaging Service",
    "Confidential Chat Hansaria",
    "Hansaria Secure Messaging",
    "Hansaria Chat Solution",
    "Hansaria Communication App",
    "Hansaria Private Messaging",
    "Hansaria Encrypted Chat",
    "Made in India Chat App Hansaria",
  ],
  authors: [
    { name: "Santu De" },
  ],
  openGraph: {
    title: "HansariaConnect",
    description:
      "A privacy-focused encrypted messaging platform built for seamless communication.",
    type: "website",
    siteName: "HansariaConnect",
  },
  twitter: {
    card: "summary_large_image",
    title: "HansariaConnect",
    description:
      "Secure encrypted messaging built with a modern user experience.",
  },
  metadataBase: new URL("https://hansariaconnect.com"),
  robots: "index, follow",
  alternates: {
    canonical: "https://hansariaconnect.com",
  },
  applicationName: "HansariaConnect",

  // Optional: Uncomment when adding PWA
  // manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${poppins.variable} bg-neutral-50 text-gray-900 antialiased`}
      >
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
