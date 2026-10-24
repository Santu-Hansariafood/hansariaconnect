"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";

import { useApp } from "@/context/AppContext/AppContext";
import { useSocket } from "@/hooks/useSocket";
import { useNavbarUser } from "@/hooks/navbar/useNavbarUser";
import { useUnreadCounts } from "@/hooks/navbar/useUnreadCounts";
import { useNavbarItems } from "@/hooks/navbar/useNavbarItems";

type User = {
  id?: string | number;
  name?: string;
  photo?: string;
};

type NavbarProps = {
  user: User;
  onLogout?: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const pathname = usePathname();

  const { theme, logout } = useApp();
  const { socket } = useSocket({ subscribeOnline: false });

  const navUser = useNavbarUser(user);
  const unreadCounts = useUnreadCounts();
  const navItems = useNavbarItems(unreadCounts);

  const subscribeToSocket = useCallback(
    (onStoreChange: () => void) => {
      if (!socket) return () => {};

      socket.on("connect", onStoreChange);
      socket.on("disconnect", onStoreChange);

      return () => {
        socket.off("connect", onStoreChange);
        socket.off("disconnect", onStoreChange);
      };
    },
    [socket],
  );
  const getSocketSnapshot = useCallback(
    () => Boolean(socket?.connected),
    [socket],
  );
  const isSelfOnline = useSyncExternalStore(
    subscribeToSocket,
    getSocketSnapshot,
    () => false,
  );

  const isItemActive = (path: string) =>
    Boolean(
      pathname &&
        (pathname === path || (path === "/chat" && pathname.startsWith("/chat/"))),
    );

  return (
    <nav
      style={{
        backgroundColor: theme.primary,
        borderBottomColor: `${theme.primary}80`,
      }}
      className="sticky top-0 z-50 border-b pt-[env(safe-area-inset-top)] text-white shadow-sm touch-manipulation theme-transition"
    >
      <div className="flex h-14 items-center gap-2 px-2 sm:h-[60px] sm:gap-3 sm:px-3">
        <Link
          href="/chat"
          aria-label="Go to chats"
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20 transition-transform duration-150 active:scale-95"
        >
          <Image
            src="/logo/logo.png"
            alt="HansariaConnect"
            fill
            sizes="40px"
            className="object-cover"
            priority
          />
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white sm:text-base">
          HansariaConnect
        </h1>

        <div className="hidden items-center gap-0.5 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.path);
            const count = Number(item.count || 0);
            const hasUnread = count > 0;

            return (
              <Link
                key={item.path}
                href={item.path}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex h-9 items-center gap-2 rounded-full px-2.5 text-[13px] font-medium transition-all duration-150 active:scale-95 lg:px-3 ${
                  isActive ? "bg-white/20 text-white" : "text-white/90 hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />

                <span className="hidden lg:inline">{item.label}</span>

                {hasUnread && (
                  <span
                    aria-label={`${count} unread`}
                    className="absolute right-0 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {isSelfOnline && (
            <span
              className="hidden rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium text-white lg:inline"
            >
              Online
            </span>
          )}

          <Link
            href="/profile"
            aria-label="Open profile"
            className="flex items-center gap-2 rounded-full p-0.5 pr-1 transition-all duration-150 hover:bg-white/10 active:scale-95 sm:pr-1.5"
          >
            <div className="relative shrink-0">
              {navUser.photo ? (
                <Image
                  src={navUser.photo}
                  alt={navUser.name || "User"}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white/20"
                  style={{
                    background: `linear-gradient(
                      135deg,
                      ${theme.primary} 0%,
                      ${theme.primary}cc 100%
                    )`,
                  }}
                >
                  {(navUser.name || "U").charAt(0).toUpperCase()}
                </div>
              )}

              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white transition-colors duration-200 ${
                  isSelfOnline ? "bg-emerald-500" : "bg-gray-400"
                }`}
                title={isSelfOnline ? "Online" : "Offline"}
              />
            </div>

            <div className="hidden min-w-0 max-w-[130px] flex-col items-start md:flex">
              <span className="w-full truncate text-[14px] font-medium leading-tight text-white">
                {navUser.name || "User"}
              </span>

              <span
                className={`w-full truncate text-[11px] leading-tight ${
                  isSelfOnline ? "text-emerald-200" : "text-white/80"
                }`}
              >
                {isSelfOnline ? "online" : "offline"}
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onLogout ?? logout}
            aria-label="Logout"
            title="Logout"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90"
          >
            <LogOut className="h-[19px] w-[19px]" />
          </button>
        </div>
      </div>

      <div
        className="flex items-stretch gap-0.5 overflow-x-auto overscroll-x-contain border-t px-1.5 py-1 md:hidden scrollbar-hide"
        style={{
          borderTopColor: `${theme.primary}80`,
          scrollbarWidth: "none",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.path);
          const count = Number(item.count || 0);
          const hasUnread = count > 0;

          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-w-[56px] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-all duration-150 active:scale-95 ${
                isActive ? "bg-white/20 text-white" : "text-white/90 hover:bg-white/10"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />

              <span className="max-w-[64px] truncate text-[10px] font-medium">
                {item.label}
              </span>

              {hasUnread && (
                <span
                  aria-label={`${count} unread`}
                  className="absolute right-1 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                >
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
