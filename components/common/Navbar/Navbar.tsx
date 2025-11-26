"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import {
  MessageCircle,
  Users,
  Image as ImageIcon,
  Settings,
  LogOut,
  Phone,
} from "lucide-react";

type User = {
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
  const { theme, user: ctxUser } = useApp();
  const [navUser, setNavUser] = useState<User>({ name: user?.name, photo: user?.photo });
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, chats: 0, groups: 0 });

  useEffect(() => {
    const load = async () => {
      const id = (ctxUser as any)?.id
      if (!id) {
        setNavUser({ name: user?.name, photo: user?.photo })
        return
      }
      try {
        const res = await fetch(`/api/profile/${id}`)
        const data = await res.json()
        if (data?.profile) {
          setNavUser({ name: data.profile.name, photo: data.profile.photo })
        } else {
          setNavUser({ name: user?.name, photo: user?.photo })
        }
      } catch {
        setNavUser({ name: user?.name, photo: user?.photo })
      }
    }
    load()
  }, [ctxUser])

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await fetch("/api/unread-counts", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data) {
          const chatsUnread = Object.values(data.conversations || {}).reduce((a: number, b: number) => a + b, 0);
          const groupsUnread = Object.values(data.groups || {}).reduce((a: number, b: number) => a + b, 0);
          setUnreadCounts({
            total: data.total || 0,
            chats: chatsUnread,
            groups: groupsUnread,
          });
        }
      } catch {}
    };
    loadUnread();
    const interval = setInterval(loadUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: "/chats", icon: MessageCircle, label: "Chats", count: unreadCounts.chats },
    { path: "/contacts", icon: Phone, label: "Contacts", count: 0 },
    { path: "/status", icon: ImageIcon, label: "Status", count: 0 },
    { path: "/groups", icon: Users, label: "Groups", count: unreadCounts.groups },
    { path: "/settings", icon: Settings, label: "Settings", count: 0 },
  ];

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.secondary})`,
              }}
            >
              <MessageCircle className="w-6 h-6 text-white" />
            </motion.div>
            <h1 className="text-xl font-bold text-gray-800">
              HansariaConnect
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              const hasUnread = (item.count || 0) > 0;
              return (
                <motion.button
                  key={item.path}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onClick={() => router.push(item.path)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                    isActive ? "shadow-md" : "text-gray-600 hover:bg-gray-100 hover:shadow-sm"
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: `${theme.secondary}`, color: `${theme.primary}` }
                      : undefined
                  }
                >
                  <Icon className="w-5 h-5 transition-transform duration-300" />
                  {item.label}
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {item.count! > 99 ? "99+" : item.count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => router.push("/profile")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all duration-300 hover:shadow-sm"
          >
            {navUser.photo && navUser.photo.trim() ? (
              <Image
                src={navUser.photo}
                alt={navUser.name || "User"}
                width={32}
                height={32}
                className="rounded-full object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: `${theme.primary}` }}
              >
                {(navUser.name || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden md:block font-medium text-gray-800">
              {navUser.name || "User"}
            </span>
          </motion.button>

            {onLogout && (
              <motion.button
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={onLogout}
                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-300 hover:shadow-sm"
                title="Logout"
              >
                <LogOut className="w-5 h-5 transition-transform duration-300" />
              </motion.button>
            )}
          </div>
        </div>
        <div className="md:hidden flex items-center justify-around py-2 border-t border-gray-200">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const hasUnread = (item.count || 0) > 0;
            return (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.9 }}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => router.push(item.path)}
                className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${
                  isActive ? "" : "text-gray-600 hover:bg-gray-50"
                }`}
                style={
                  isActive
                    ? { color: theme.primary, backgroundColor: `${theme.secondary}80` }
                    : undefined
                }
              >
                <Icon className="w-6 h-6 transition-transform duration-300" />
                <span className="text-xs">{item.label}</span>
                {hasUnread && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {item.count! > 9 ? "9+" : item.count}
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
