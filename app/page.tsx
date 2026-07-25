"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import Loading from "@/components/common/Loading/Loading";
import ChatHome from "@/components/pages/ChatHome/ChatHome";
import ChatWindow from "@/components/pages/ChatWindow/ChatWindow";
import { useApp } from "@/context/AppContext/AppContext";

export default function ChatPage() {
  const router = useRouter();
  const { user, theme, logout } = useApp();
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

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
    <div className="flex h-screen overflow-hidden bg-[#f0f2f5]">
      {/* Left Sidebar (Contacts) */}
      <div className="w-[420px] max-w-[40%] border-r border-gray-200 flex flex-col overflow-hidden bg-white">
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
          <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-[#efeae2] border-b-[6px] border-[#00a884]/50">
            <div className="w-48 h-48 mb-6 rounded-full bg-white shadow-xl flex items-center justify-center">
              <MessageCircle className="w-24 h-24 text-gray-300" />
            </div>
            <h2 className="text-3xl font-light text-gray-700 mb-3">HansariaConnect Web</h2>
            <p className="text-sm text-gray-500 max-w-md text-center leading-relaxed">
              Select a chat from the sidebar to start messaging, or create a new contact to begin a conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
