"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import { LogOut } from "lucide-react";
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { theme } = useApp();
  const { socket } = useSocket();
  const navUser = useNavbarUser(user);
  const unreadCounts = useUnreadCounts();
  const navItems = useNavbarItems(unreadCounts);

  const isSelfOnline = !!socket && socket.connected;

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        backgroundColor: theme.primary,
        borderBottomColor: theme.primary + "80",
      }}
      className="border-b shadow-md sticky top-0 z-50"
    >
      <div className="px-2 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.button
              onClick={() => router.push("/")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0 overflow-hidden shadow-md ring-1 ring-white/20"
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

            <h1 className="text-white font-bold text-base sm:text-lg">HansariaConnect</h1>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              const hasUnread = (item.count || 0) > 0;

              return (
                <motion.button
                  key={item.path}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => router.push(item.path)}
                  className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white"
                      : "text-gray-100 hover:bg-white/10"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `rgba(255, 255, 255, 0.2)`,
                        }
                      : undefined
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm hidden lg:inline">{item.label}</span>

                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold min-w-4.5 h-4.5 px-1">
                      {item.count > 99 ? "99+" : item.count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {isSelfOnline && (
              <span className="hidden sm:inline text-xs text-white px-2 py-1 rounded-full" style={{backgroundColor: theme.primary + "60"}}>
                Online
              </span>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/profile")}
              className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all duration-200"
            >
              <div className="relative flex-shrink-0">
                {navUser.photo ? (
                  <Image
                    src={navUser.photo}
                    alt={navUser.name || "User"}
                    width={34}
                    height={34}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-white/20"
                  />
                ) : (
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm bg-white/20 ring-2 ring-white/20"
                    style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}cc 100%)` }}
                  >
                    {(navUser.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className={`absolute bottom-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full ring-2 ring-white ${
                    isSelfOnline
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-gray-400"
                  }`}
                  title={isSelfOnline ? "Online" : "Offline"}
                />
              </div>

              <div className="hidden md:flex flex-col items-start min-w-0 max-w-35">
                <span className="font-medium text-white text-sm leading-tight truncate w-full">
                  {navUser.name || "User"}
                </span>
                <span className={`text-[11px] leading-tight truncate w-full ${
                  isSelfOnline ? "text-emerald-100" : "text-gray-200"
                }`}>
                  {isSelfOnline ? "online" : "offline"}
                </span>
              </div>
            </motion.button>

            {onLogout && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onLogout}
                className="p-2 text-white/70 hover:bg-white/10 rounded-lg transition-all duration-200"
                title="Logout"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>
        </div>

        <div className="md:hidden flex items-center justify-around py-1.5 border-t overflow-x-auto" style={{borderTopColor: theme.primary + "80", backgroundColor: theme.primary}}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const hasUnread = (item.count || 0) > 0;

            return (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.92 }}
                onClick={() => router.push(item.path)}
                className={`relative flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-lg transition-all duration-200 flex-1 min-w-13 ${
                  isActive ? "text-white bg-white/20" : "text-gray-100 hover:bg-white/10"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-medium truncate max-w-16">{item.label}</span>

                {hasUnread && (
                  <span className="absolute top-0 right-0.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold min-w-4 h-4 px-1">
                    {item.count > 9 ? "9+" : item.count}
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
