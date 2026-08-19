"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import Loading from "@/components/common/Loading/Loading";
import ChatHome from "@/components/pages/ChatHome/ChatHome";
import ChatWindow from "@/components/pages/ChatWindow/ChatWindow";
import { useApp } from "@/context/AppContext/AppContext";

type MinimalUser = {
  id?: string | number;
  name?: string;
  photo?: string;
  avatar?: string;
  mobile?: string;
  step?: string;
};

type ThemeShape = {
  primary: string;
  secondary?: string;
  textSize?: string;
  wallpaper?: string;
  isDark?: boolean;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const check = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 768);
      }
    };

    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);

    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  return isMobile;
}

export default function ChatIndexPage() {
  const appCtx = useApp() as unknown as { user?: MinimalUser; theme: ThemeShape; logout: () => void };
  const { user, theme, logout } = appCtx;
  const router = useRouter();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const isReady = Boolean(user && user.step === "complete");

  useEffect(() => {
    if (user && user.step !== "complete") {
      router.replace("/login");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      const savedUser = localStorage.getItem("hansariaUser");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed?.step === "complete") {
            window.location.reload();
          }
        } catch {}
      }
    }
  }, [user]);

  if (!isReady) {
    return <Loading />;
  }

  const showSidebar = !isMobile || !selectedChatId;
  const showChat = !isMobile || !!selectedChatId;

  return (
    <div className="flex h-[100dvh] min-h-0 w-screen overflow-hidden bg-[#f0f2f5] touch-manipulation">
      <div
        className={`
          ${showSidebar ? "flex" : "hidden"}
          ${isMobile ? "w-full min-w-0 flex-1 basis-full" : "w-[360px] sm:w-[400px] md:w-[420px] max-w-[45%] min-w-0"}
          border-r border-gray-200 flex-col overflow-hidden bg-white shrink-0
        `}
      >
        <ChatHome
          user={user!}
          theme={theme}
          onLogout={logout}
          selectedChatId={selectedChatId || undefined}
          onSelectChat={(id) => {
            setSelectedChatId(id);
            if (isMobile) {
              router.replace(`/chat/${id}`, { scroll: false });
            }
          }}
        />
      </div>

      <div
        className={`
          ${showChat ? "flex" : "hidden"}
          ${isMobile ? "w-full min-w-0 flex-1 basis-full" : "flex-1 min-w-0"}
          flex-col overflow-hidden
        `}
      >
        {selectedChatId ? (
          <div className="h-full w-full min-w-0">
            <ChatWindow
              user={user! as unknown as { id: number; name: string; avatar: string }}
              theme={theme}
              id={selectedChatId}
              onBack={() => {
                if (isMobile) {
                  setSelectedChatId(null);
                  router.replace("/chat", { scroll: false });
                } else {
                  setSelectedChatId(null);
                }
              }}
            />
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-gray-500 bg-[#efeae2] border-b-[6px] border-[#00a884]/50 p-4">
            <div className="mb-4 h-32 w-32 shrink-0 rounded-full bg-white shadow-xl flex items-center justify-center sm:mb-6 sm:h-48 sm:w-48">
              <MessageCircle className="h-16 w-16 text-gray-300 sm:h-24 sm:w-24" />
            </div>
            <h2 className="mb-2 text-center text-2xl font-light text-gray-700 sm:text-3xl">HansariaConnect Web</h2>
            <p className="max-w-md text-center text-xs leading-relaxed text-gray-500 sm:text-sm">
              Select a chat from the sidebar to start messaging, or create a new contact to begin a conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
