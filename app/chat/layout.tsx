import type { Metadata } from "next";
import ChatWorkspace from "@/components/pages/ChatWorkspace/ChatWorkspace";

export const metadata: Metadata = {
  title: "Chat",
  description: "Private HansariaConnect messaging application.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ChatLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <ChatWorkspace />
    </>
  );
}