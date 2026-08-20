"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();

  const { theme } = useApp();
  const { socket } = useSocket();

  const navUser = useNavbarUser(user);
  const unreadCounts = useUnreadCounts();
  const navItems = useNavbarItems(unreadCounts);

  const isSelfOnline = Boolean(socket?.connected);

  const handleNavigation = (path: string) => {
    if (path !== pathname) {
      router.push(path);
    }
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        backgroundColor: theme.primary,
        borderBottomColor: `${theme.primary}80`,
      }}
      className="sticky top-0 z-50 border-b shadow-md"
    >
      <div className="px-2 sm:px-4">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <motion.button
              type="button"
              onClick={() => handleNavigation("/")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              aria-label="Go to home"
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full shadow-md ring-1 ring-white/20 sm:h-10 sm:w-10"
            >
              <Image
                src="/logo/logo.png"
                alt="HansariaConnect"
                fill
                sizes="(max-width: 640px) 36px, 40px"
                className="object-cover"
                priority
              />
            </motion.button>

            <h1 className="truncate text-base font-bold text-white sm:text-lg">
              HansariaConnect
            </h1>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              const count = Number(item.count || 0);
              const hasUnread = count > 0;

              return (
                <motion.button
                  key={item.path}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                  }}
                  onClick={() => handleNavigation(item.path)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-2 font-medium transition-all duration-200 sm:px-4 ${
                    isActive ? "text-white" : "text-gray-100 hover:bg-white/10"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: "rgba(255, 255, 255, 0.2)",
                        }
                      : undefined
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />

                  <span className="hidden text-sm lg:inline">{item.label}</span>

                  {hasUnread && (
                    <span
                      aria-label={`${count} unread`}
                      className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm"
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {isSelfOnline && (
              <span
                className="hidden rounded-full px-2 py-1 text-xs text-white sm:inline"
                style={{
                  backgroundColor: `${theme.primary}60`,
                }}
              >
                Online
              </span>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => handleNavigation("/profile")}
              aria-label="Open profile"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 transition-all duration-200 hover:bg-white/10 sm:gap-2"
            >
              <div className="relative shrink-0">
                {navUser.photo ? (
                  <Image
                    src={navUser.photo}
                    alt={navUser.name || "User"}
                    width={36}
                    height={36}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white/20 sm:h-9 sm:w-9"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white/20 sm:h-9 sm:w-9 sm:text-sm"
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
                  className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-white sm:h-4 sm:w-4 ${
                    isSelfOnline
                      ? "animate-pulse bg-emerald-500"
                      : "bg-gray-400"
                  }`}
                  title={isSelfOnline ? "Online" : "Offline"}
                />
              </div>

              <div className="hidden min-w-0 max-w-[140px] flex-col items-start md:flex">
                <span className="w-full truncate text-sm font-medium leading-tight text-white">
                  {navUser.name || "User"}
                </span>

                <span
                  className={`w-full truncate text-[11px] leading-tight ${
                    isSelfOnline ? "text-emerald-100" : "text-gray-200"
                  }`}
                >
                  {isSelfOnline ? "online" : "offline"}
                </span>
              </div>
            </motion.button>

            {onLogout && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={onLogout}
                aria-label="Logout"
                title="Logout"
                className="rounded-lg p-2 text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </motion.button>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-1 overflow-x-auto border-t py-1.5 md:hidden"
          style={{
            borderTopColor: `${theme.primary}80`,
            backgroundColor: theme.primary,
            scrollbarWidth: "none",
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const count = Number(item.count || 0);
            const hasUnread = count > 0;

            return (
              <motion.button
                key={item.path}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => handleNavigation(item.path)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-w-[52px] flex-1 shrink-0 flex-col items-center gap-0.5 rounded-lg p-1.5 transition-all duration-200 sm:min-w-[60px] sm:p-2 ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-gray-100 hover:bg-white/10"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />

                <span className="max-w-[64px] truncate text-[10px] font-medium sm:text-[11px]">
                  {item.label}
                </span>

                {hasUnread && (
                  <span
                    aria-label={`${count} unread`}
                    className="absolute right-0.5 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                  >
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
