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

  const navItems = [
    { path: "/chats", icon: MessageCircle, label: "Chats" },
    { path: "/status", icon: ImageIcon, label: "Status" },
    { path: "/groups", icon: Users, label: "Groups" },
    { path: "/settings", icon: Settings, label: "Settings" },
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
              return (
                <motion.button
                  key={item.path}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onClick={() => router.push(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
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
            return (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.9 }}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => router.push(item.path)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${
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
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
