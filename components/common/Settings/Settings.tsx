"use client";

import { motion } from "framer-motion";
import { fadeIn } from "@/utils/animations/animations";
import {
  Palette,
  Image as ImageIcon,
  Type,
  Bell,
  Info,
} from "lucide-react";

import { useSettings } from "@/hooks/settings/useSettings";
import { useThemeSettings } from "@/hooks/settings/useThemeSettings";
import { useNotificationSettings } from "@/hooks/settings/useNotificationSettings";
import dynamic from "next/dynamic";
import Loading from "../Loading/Loading";

const Navbar = dynamic(() => import("@/components/common/Navbar/Navbar"), {
  ssr: false,
  loading: () => <Loading />,
});

type NotificationKey = "messages" | "groups" | "enabled";

const notificationKeys: NotificationKey[] = ["messages", "groups", "enabled"];

const Settings = ({ user, theme, onThemeChange }: any) => {
  const { initialTheme, notifications, setNotifications } = useSettings();

  const {
    localTheme,
    updateTheme,
    loading: themeSaving,
  } = useThemeSettings(initialTheme || theme, onThemeChange);

  const {
    toggleNotification,
    loading: notificationLoading,
  } = useNotificationSettings(notifications, setNotifications);

  const colorOptions = [
    { primary: "#0CA678", secondary: "#A2F5BF", name: "Emerald" },
    { primary: "#0052CC", secondary: "#A5D8FF", name: "Royal Blue" },
    { primary: "#6B3FA0", secondary: "#CEB2E5", name: "Purple" },
    { primary: "#FF6B6B", secondary: "#FFD2D2", name: "Coral" },
    { primary: "#FF9700", secondary: "#FFDEA5", name: "Orange" },
  ];

  const wallpaperOptions = [
    { value: "bg-gradient-to-br from-emerald-50 to-teal-50", name: "Emerald" },
    { value: "bg-gradient-to-br from-blue-50 to-indigo-50", name: "Ocean" },
    { value: "bg-gradient-to-br from-purple-50 to-pink-50", name: "Lavender" },
    { value: "bg-gradient-to-br from-orange-50 to-amber-50", name: "Sunset" },
    { value: "bg-white", name: "Clean White" },
  ];

  const textSizeOptions = [
    { value: "text-sm", name: "Small" },
    { value: "text-base", name: "Medium" },
    { value: "text-lg", name: "Large" },
  ];

  return (
    <div className={`min-h-screen ${localTheme?.wallpaper}`}>
      <Navbar user={user} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1
            className={`text-3xl font-bold text-gray-800 mb-2 ${localTheme?.textSize}`}
          >
            Settings
          </h1>
          <p className="text-gray-600">
            Customize your HansariaConnect experience
          </p>
        </motion.div>

        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg mt-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-6 h-6" style={{ color: localTheme?.primary }} />
            <h2 className="text-xl font-semibold text-gray-800">Theme Color</h2>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {colorOptions.map((color) => (
              <button
                key={color.name}
                onClick={() => updateTheme(color)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50"
              >
                <div
                  className="w-12 h-12 rounded-full border-4 border-white shadow-lg"
                  style={{ backgroundColor: color.primary }}
                />
                <span className="text-xs text-gray-600">{color.name}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg mt-6">
          <div className="flex items-center gap-3 mb-4">
            <ImageIcon className="w-6 h-6" style={{ color: localTheme?.primary }} />
            <h2 className="text-xl font-semibold text-gray-800">Chat Wallpaper</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {wallpaperOptions.map((wp) => (
              <button
                key={wp.name}
                onClick={() => updateTheme({ wallpaper: wp.value })}
                className={`h-24 rounded-xl border-4 ${wp.value} ${
                  localTheme?.wallpaper === wp.value
                    ? "border-emerald-500"
                    : "border-gray-200"
                }`}
              >
                <span className="text-xs font-medium text-gray-700">{wp.name}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg mt-6">
          <div className="flex items-center gap-3 mb-4">
            <Type className="w-6 h-6" style={{ color: localTheme?.primary }} />
            <h2 className="text-xl font-semibold text-gray-800">Text Size</h2>
          </div>

          <div className="flex gap-4">
            {textSizeOptions.map((size) => (
              <button
                key={size.name}
                onClick={() => updateTheme({ textSize: size.value })}
                className={`flex-1 py-3 px-6 rounded-xl font-semibold ${
                  localTheme?.textSize === size.value
                    ? "text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
                style={
                  localTheme?.textSize === size.value
                    ? { backgroundColor: localTheme?.primary }
                    : {}
                }
              >
                {size.name}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg mt-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6" style={{ color: localTheme?.primary }} />
            <h2 className="text-xl font-semibold text-gray-800">Notifications</h2>
          </div>

          {notificationKeys.map((key) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mb-3"
            >
              <p className="font-medium text-gray-800 capitalize">
                {key} Notifications
              </p>

              <button
                onClick={() => toggleNotification(key)}
                disabled={notificationLoading}
                className={`w-12 h-6 rounded-full relative ${
                  notifications[key] ? "" : "bg-gray-300"
                }`}
                style={
                  notifications[key]
                    ? { backgroundColor: localTheme?.primary }
                    : undefined
                }
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    notifications[key] ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </motion.div>

        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg mt-6">
          <div className="flex items-center gap-3 mb-4">
            <Info className="w-6 h-6" style={{ color: localTheme?.primary }} />
            <h2 className="text-xl font-semibold text-gray-800">About</h2>
          </div>
          <p className="text-gray-600">HansariaConnect v1.0.0</p>
          <p className="text-sm text-gray-500">
            © 2025 HansariaConnect. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;
