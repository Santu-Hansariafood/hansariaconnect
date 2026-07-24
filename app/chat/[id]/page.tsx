"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Loading from "@/components/common/Loading/Loading";
import ChatHome from "@/components/pages/ChatHome/ChatHome";
import ChatWindow from "@/components/pages/ChatWindow/ChatWindow";
import { useApp } from "@/context/AppContext/AppContext";

export default function ChatRoute() {
  const { user, theme, logout } = useApp();
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(params?.id as string || null);

  useEffect(() => {
    if (!user || user.step !== "complete") {
      router.replace("/login");
    } else {
      setLoading(false);
    }
  }, [user, router]);

  if (loading || !user) {
    return <Loading />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar (Contacts) */}
      <div className="w-96 border-r border-gray-200 flex flex-col overflow-hidden bg-gray-50">
        <ChatHome
          user={user}
          theme={theme}
          onLogout={logout}
          selectedChatId={selectedChatId || undefined}
          onSelectChat={setSelectedChatId}
        />
      </div>
      {/* Right Chat Window */}
      <div className="flex-1 overflow-hidden">
        {selectedChatId ? (
          <div className="h-full">
            <ChatWindow
              user={user as any}
              theme={theme}
              id={selectedChatId}
              onBack={() => setSelectedChatId(null)}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p>Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
