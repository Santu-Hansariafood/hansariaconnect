"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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

export default function ChatWorkspace() {
  const { user, theme, logout } = useApp() as unknown as {
    user?: MinimalUser;
    theme: ThemeShape;
    logout: () => void;
  };
  const router = useRouter();
  const pathname = usePathname();
  const selectedChatId = pathname?.match(/^\/chat\/([^/]+)/)?.[1] || null;
  const isReady = Boolean(user && user.step === "complete");

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    } else if (user.step !== "complete") {
      router.replace("/login");
    }
  }, [router, user]);

  if (!isReady) return <Loading />;

  return (
    <div className="flex h-[100dvh] min-h-0 w-screen overflow-hidden bg-[#f0f2f5] touch-manipulation">
      <aside
        className={`${selectedChatId ? "hidden md:flex" : "flex"} w-full min-w-0 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white md:w-[360px] md:max-w-[45%] md:flex-none lg:w-[400px] xl:w-[420px]`}
      >
        <ChatHome
          user={user!}
          theme={theme}
          onLogout={logout}
          selectedChatId={selectedChatId || undefined}
          onSelectChat={(id) => router.push(`/chat/${id}`, { scroll: false })}
        />
      </aside>

      <section
        className={`${selectedChatId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-hidden`}
      >
        {selectedChatId ? (
          <ChatWindow
            key={selectedChatId}
            user={user! as unknown as {
              id: number;
              name: string;
              avatar: string;
            }}
            theme={theme}
            id={selectedChatId}
            onBack={() => router.push("/chat", { scroll: false })}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center border-b-[6px] border-[#00a884]/50 bg-[#efeae2] p-4 text-gray-500">
            <div className="mb-4 flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-white shadow-xl sm:mb-6 sm:h-48 sm:w-48">
              <MessageCircle className="h-16 w-16 text-gray-300 sm:h-24 sm:w-24" />
            </div>
            <h2 className="mb-2 text-center text-2xl font-light text-gray-700 sm:text-3xl">
              HansariaConnect Web
            </h2>
            <p className="max-w-md text-center text-xs leading-relaxed text-gray-500 sm:text-sm">
              Select a chat from the sidebar to start messaging, or create a new
              contact to begin a conversation.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
