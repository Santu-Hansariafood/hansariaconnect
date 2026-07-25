"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import { LogOut, MessageCircle } from "lucide-react";
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

  const isSelfOnline = !!socket && socket.connected;

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-[#f0f2f5] border-b border-gray-200 shadow-sm sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
              style={{
                background: `linear-gradient(135deg, #00a884 0%, #008069 100%)`,
              }}
            >
              <MessageCircle className="w-5 h-5 text-white" />
            </motion.div>

            <div>
              <h1 className="text-lg font-semibold text-gray-800">
                HansariaConnect
              </h1>
            </div>
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
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isActive
                      ? ""
                      : "text-gray-600 hover:bg-gray-200/60"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `#d1fae5`,
                          color: `#047857`,
                        }
                      : undefined
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>

                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-[#00a884] text-white text-[10px] rounded-full flex items-center justify-center font-bold min-w-[18px] px-1">
                      {item.count > 99 ? "99+" : item.count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/profile")}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-200/60 transition-all duration-200"
            >
              <div className="relative">
                {navUser.photo ? (
                  <Image
                    src={navUser.photo}
                    alt={navUser.name || "User"}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ background: `linear-gradient(135deg, #00a884 0%, #008069 100%)` }}
                  >
                    {(navUser.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#f0f2f5] ${
                    isSelfOnline ? "bg-green-500" : "bg-gray-400"
                  }`}
                  title={isSelfOnline ? "Online" : "Offline"}
                />
              </div>

              <div className="hidden md:flex flex-col items-start">
                <span className="font-medium text-gray-800 text-sm leading-tight">
                  {navUser.name || "User"}
                </span>
                <span className={`text-[11px] leading-tight ${
                  isSelfOnline ? "text-green-600" : "text-gray-500"
                }`}>
                  {isSelfOnline ? "online" : "offline"}
                </span>
              </div>
            </motion.button>

            {onLogout && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onLogout}
                className="p-2 text-gray-600 hover:bg-gray-200/60 rounded-lg transition-all duration-200"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>

        <div className="md:hidden flex items-center justify-around py-1.5 border-t border-gray-200 bg-[#f0f2f5]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const hasUnread = (item.count || 0) > 0;

            return (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.92 }}
                onClick={() => router.push(item.path)}
                className={`relative flex flex-col items-center gap-0.5 p-2 rounded-lg transition-all duration-200 ${
                  isActive ? "" : "text-gray-600 hover:bg-gray-200/50"
                }`}
                style={
                  isActive
                    ? {
                        color: "#047857",
                        backgroundColor: `#d1fae5`,
                      }
                    : undefined
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{item.label}</span>

                {hasUnread && (
                  <span className="absolute top-0 right-1 w-4 h-4 bg-[#00a884] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
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
