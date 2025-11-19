"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Palette,
  Image as ImageIcon,
  Type,
  Bell,
  User,
  Info,
} from "lucide-react";
import Navbar from "@/components/common/Navbar/Navbar";
import { fadeIn } from "@/utils/animations/animations";

interface Theme {
  primary: string;
  secondary: string;
  wallpaper: string;
  textSize: string;
}

interface SettingsProps {
  user: {
    name: string;
    mobile: string;
    photo: string;
  };
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, theme, onThemeChange }) => {
  const [localTheme, setLocalTheme] = useState<Theme>(theme);

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

  const handleColorChange = (color: { primary: string; secondary: string }) => {
    const newTheme = { ...localTheme, ...color };
    setLocalTheme(newTheme);
    onThemeChange(newTheme);
  };

  const handleWallpaperChange = (wallpaper: string) => {
    const newTheme = { ...localTheme, wallpaper };
    setLocalTheme(newTheme);
    onThemeChange(newTheme);
  };

  const handleTextSizeChange = (textSize: string) => {
    const newTheme = { ...localTheme, textSize };
    setLocalTheme(newTheme);
    onThemeChange(newTheme);
  };

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <Navbar user={user} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1
            className={`text-3xl font-bold text-gray-800 mb-2 ${theme.textSize}`}
          >
            Settings
          </h1>
          <p className="text-gray-600">
            Customize your HansariaConnect experience
          </p>
        </motion.div>

        <div className="space-y-6">
          <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Palette className="w-6 h-6" style={{ color: theme.primary }} />
              <h2 className="text-xl font-semibold text-gray-800">
                Theme Color
              </h2>
            </div>
            <div className="grid grid-cols-5 gap-4">
              {colorOptions.map((color) => (
                <button
                  key={color.name}
                  onClick={() => handleColorChange(color)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors"
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
          <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <ImageIcon
                className="w-6 h-6"
                style={{ color: theme.primary }}
              />
              <h2 className="text-xl font-semibold text-gray-800">
                Chat Wallpaper
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {wallpaperOptions.map((wp) => (
                <button
                  key={wp.name}
                  onClick={() => handleWallpaperChange(wp.value)}
                  className={`h-24 rounded-xl border-4 ${wp.value} ${
                    localTheme.wallpaper === wp.value
                      ? "border-emerald-500"
                      : "border-gray-200"
                  } hover:border-emerald-300 transition-colors`}
                >
                  <span className="text-xs font-medium text-gray-700">
                    {wp.name}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
          <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Type className="w-6 h-6" style={{ color: theme.primary }} />
              <h2 className="text-xl font-semibold text-gray-800">Text Size</h2>
            </div>
            <div className="flex gap-4">
              {textSizeOptions.map((size) => (
                <button
                  key={size.name}
                  onClick={() => handleTextSizeChange(size.value)}
                  className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-colors ${
                    localTheme.textSize === size.value
                      ? "text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  style={
                    localTheme.textSize === size.value
                      ? { backgroundColor: theme.primary }
                      : {}
                  }
                >
                  {size.name}
                </button>
              ))}
            </div>
          </motion.div>
          <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-6 h-6" style={{ color: theme.primary }} />
              <h2 className="text-xl font-semibold text-gray-800">
                Profile Settings
              </h2>
            </div>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-800">Edit Profile</p>
                <p className="text-sm text-gray-500">
                  Change name, photo, and about
                </p>
              </button>
              <button className="w-full text-left px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-800">Privacy</p>
                <p className="text-sm text-gray-500">
                  Manage who can see your info
                </p>
              </button>
            </div>
          </motion.div>
          <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6" style={{ color: theme.primary }} />
              <h2 className="text-xl font-semibold text-gray-800">
                Notifications
              </h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-800">
                    Message Notifications
                  </p>
                  <p className="text-sm text-gray-500">
                    Get notified for new messages
                  </p>
                </div>
                <button
                  className="w-12 h-6 rounded-full relative transition-colors"
                  style={{ backgroundColor: theme.primary }}
                >
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></span>
                </button>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-800">Group Notifications</p>
                  <p className="text-sm text-gray-500">
                    Get notified for group messages
                  </p>
                </div>
                <button className="w-12 h-6 bg-gray-300 rounded-full relative">
                  <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></span>
                </button>
              </div>
            </div>
          </motion.div>
          <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-6 h-6" style={{ color: theme.primary }} />
              <h2 className="text-xl font-semibold text-gray-800">About</h2>
            </div>
            <div className="space-y-2 text-gray-600">
              <p>HansariaConnect v1.0.0</p>
              <p className="text-sm">
                © 2025 HansariaConnect. All rights reserved.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
