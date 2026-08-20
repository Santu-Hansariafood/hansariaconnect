"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { fadeIn } from "@/utils/animations/animations";
import {
  Palette,
  Image as ImageIcon,
  Type,
  Bell,
  Info,
  BellRing,
  BellOff,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
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

const Settings = ({ user, theme, onThemeChange, onLogout }: any) => {
  const { initialTheme, notifications, setNotifications } = useSettings();

  const {
    localTheme,
    updateTheme,
    loading: themeSaving,
  } = useThemeSettings(initialTheme || theme, onThemeChange);

  const {
    toggleNotification,
    setRingtone,
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

  const [perm, setPerm] = useState<{ contacts: boolean; groups: boolean; status: boolean; attachments: boolean } | null>(null);
  const [wallpaperUploading, setWallpaperUploading] = useState(false);
  const [wallpaperUploadError, setWallpaperUploadError] = useState<string | null>(null);
  const [ringtoneUploading, setRingtoneUploading] = useState(false);
  const [ringtoneUploadError, setRingtoneUploadError] = useState<string | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const ringtoneInputRef = useRef<HTMLInputElement | null>(null);
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission | "unsupported">("default");
  const [permRequesting, setPermRequesting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch("/api/access/me", { cache: "no-store" });
        const data = await res.json();
        if (!mounted) return;
        if (res.ok && data?.permissions) setPerm(data.permissions);
      } catch {}
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setBrowserPerm("unsupported");
      return;
    }
    setBrowserPerm(Notification.permission);

    if ("permissions" in navigator && (navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: "notifications" })
        .then((status: any) => {
          if (!status) return;
          const onChange = () => {
            if (typeof window !== "undefined" && "Notification" in window) {
              setBrowserPerm(Notification.permission);
            }
          };
          status.onchange = onChange;
        })
        .catch(() => {});
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setBrowserPerm(result);
      console.log("[Settings] Notification permission result:", result);
    } catch (e: any) {
      console.error("[Settings] Error requesting notification permission:", e);
    } finally {
      setPermRequesting(false);
    }
  };

  const openBrowserSettingsHelp = () => {
    // Show a helpful alert since we can't directly open browser settings
    const browserInfo =
      navigator.userAgent.indexOf("Chrome") > -1 || navigator.userAgent.indexOf("Edg") > -1
        ? "Click the 🔒 lock icon in the address bar → Site settings → Notifications → Allow"
        : navigator.userAgent.indexOf("Firefox") > -1
        ? "Click the 🔒 lock icon in the address bar → Connection secure → More information → Permissions → Notifications → Allow"
        : navigator.userAgent.indexOf("Safari") > -1
        ? "Safari → Settings → Websites → Notifications → Find this site → Allow"
        : "Check your browser site settings to enable notifications.";
    window.alert("Notifications are blocked.\n\n" + browserInfo + "\n\nThen refresh this page.");
  };

  const ringtoneOptions = [
    { value: "chime", name: "Chime" },
    { value: "pulse", name: "Pulse" },
    { value: "spark", name: "Spark" },
    { value: "none", name: "Silent" },
  ];
  const customRingtoneActive = notifications?.ringtone && !ringtoneOptions.some((option) => option.value === notifications.ringtone);
  const backgroundStyle = localTheme?.wallpaperImage
    ? {
        backgroundImage: `url(${localTheme.wallpaperImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  const triggerWallpaperUpload = () => wallpaperInputRef.current?.click();
  const triggerRingtoneUpload = () => ringtoneInputRef.current?.click();

  const handleWallpaperUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setWallpaperUploadError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    setWallpaperUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "image");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || !data?.url) {
        setWallpaperUploadError(data?.error || "Unable to upload wallpaper.");
        return;
      }

      updateTheme({ wallpaperImage: data.url, wallpaper: "" });
    } catch (err: unknown) {
      setWallpaperUploadError("Upload failed. Please try again.");
    } finally {
      setWallpaperUploading(false);
    }
  };

  const handleRingtoneUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setRingtoneUploadError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    setRingtoneUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "audio");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || !data?.url) {
        setRingtoneUploadError(data?.error || "Unable to upload ringtone.");
        return;
      }

      setRingtone(data.url);
    } catch {
      setRingtoneUploadError("Upload failed. Please try again.");
    } finally {
      setRingtoneUploading(false);
    }
  };

  return (
    <div className={`min-h-screen ${!localTheme?.wallpaperImage ? localTheme?.wallpaper : ""}`} style={backgroundStyle}>
      <Navbar user={user} onLogout={onLogout} />

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
          <div className="mb-2">
            <h2 className="text-xl font-semibold text-gray-800">Your Access</h2>
            <p className="text-sm text-gray-600">Features available to you</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`px-4 py-3 rounded-xl border ${perm?.contacts ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}>Contacts</div>
            <div className={`px-4 py-3 rounded-xl border ${perm?.groups ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}>Groups</div>
            <div className={`px-4 py-3 rounded-xl border ${perm?.status ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}>Status</div>
            <div className={`px-4 py-3 rounded-xl border ${perm?.attachments ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}>Attachments</div>
          </div>
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
                onClick={() => updateTheme({ wallpaper: wp.value, wallpaperImage: "" })}
                className={`h-24 rounded-xl border-4 ${wp.value} ${
                  localTheme?.wallpaper === wp.value && !localTheme?.wallpaperImage
                    ? "border-emerald-500"
                    : "border-gray-200"
                }`}
              >
                <span className="text-xs font-medium text-gray-700">{wp.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Wallpaper URL
            </label>
            <div className="flex gap-3 items-center mb-3">
              <input
                type="text"
                value={localTheme?.wallpaperImage || ""}
                onChange={(e) => updateTheme({ wallpaperImage: e.target.value, wallpaper: "" })}
                placeholder="https://example.com/wallpaper.jpg"
                className="w-full px-4 py-3 border rounded-xl"
              />
              <button
                type="button"
                onClick={() => updateTheme({ wallpaperImage: "", wallpaper: localTheme?.wallpaper || "bg-white" })}
                className="px-4 py-3 rounded-xl bg-gray-100 text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={triggerWallpaperUpload}
                className="px-4 py-3 rounded-xl bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition"
              >
                {wallpaperUploading ? "Uploading…" : "Upload from gallery"}
              </button>
              <span className="text-sm text-gray-500">
                Choose an image file from your device to set as chat wallpaper.
              </span>
            </div>
            {wallpaperUploadError && (
              <p className="text-red-500 text-sm mt-2">{wallpaperUploadError}</p>
            )}
            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleWallpaperUpload}
            />
            <p className="text-sm text-gray-500 mt-2">
              Paste a wallpaper image URL or upload one from your gallery.
            </p>
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

          {/* Browser Notification Permission Card - CRITICAL: REQUIRED USER CLICK */}
          <div className={`mb-6 px-4 py-4 rounded-xl border ${
            browserPerm === "granted" ? "border-emerald-200 bg-emerald-50" :
            browserPerm === "denied" ? "border-red-200 bg-red-50" :
            browserPerm === "unsupported" ? "border-gray-200 bg-gray-50" :
            "border-amber-200 bg-amber-50"
          }`}>
            <div className="flex items-start gap-3">
              {browserPerm === "granted" && (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              )}
              {browserPerm === "default" && (
                <BellRing className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              )}
              {browserPerm === "denied" && (
                <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              )}
              {browserPerm === "unsupported" && (
                <AlertCircle className="w-6 h-6 text-gray-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                {browserPerm === "unsupported" ? (
                  <>
                    <p className="font-semibold text-gray-700">Notifications not supported</p>
                    <p className="text-sm text-gray-600 mt-0.5">Your browser does not support the Notification API.</p>
                  </>
                ) : browserPerm === "granted" ? (
                  <>
                    <p className="font-semibold text-emerald-700">Browser notifications enabled ✅</p>
                    <p className="text-sm text-emerald-600 mt-0.5">You'll receive notifications when new messages arrive.</p>
                  </>
                ) : browserPerm === "denied" ? (
                  <>
                    <p className="font-semibold text-red-700">Notifications blocked by browser ❌</p>
                    <p className="text-sm text-red-600 mt-0.5">You've blocked notifications. Enable them in browser settings to receive alerts.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-amber-700">Permission not granted ⚠️</p>
                    <p className="text-sm text-amber-600 mt-0.5">Click the button below to allow notifications. Your browser will show a prompt.</p>
                  </>
                )}

                <div className="mt-3">
                  {browserPerm === "default" && (
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      disabled={permRequesting}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium shadow-sm hover:opacity-90 transition disabled:opacity-60"
                      style={{ backgroundColor: localTheme?.primary }}
                    >
                      {permRequesting ? (
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <BellRing className="w-4 h-4" />
                      )}
                      {permRequesting ? "Requesting…" : "Allow Notifications"}
                    </button>
                  )}
                  {browserPerm === "denied" && (
                    <button
                      type="button"
                      onClick={openBrowserSettingsHelp}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium shadow-sm hover:bg-red-600 transition"
                    >
                      <BellOff className="w-4 h-4" />
                      How to Unblock
                    </button>
                  )}
                </div>
              </div>
            </div>
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

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Notification Ringtone
            </label>
            <div className="grid grid-cols-2 gap-3">
              {ringtoneOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRingtone(option.value)}
                  className={`px-4 py-3 rounded-xl text-left border transition ${
                    notifications.ringtone === option.value
                      ? "bg-emerald-50 border-emerald-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <p className="font-medium text-gray-800">{option.name}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={triggerRingtoneUpload}
                className={`px-4 py-3 rounded-xl text-left border transition ${
                  customRingtoneActive
                    ? "bg-emerald-50 border-emerald-300"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                <p className="font-medium text-gray-800">Upload Audio</p>
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <label className="block text-sm font-medium text-gray-700">Custom Ringtone URL</label>
              <input
                type="text"
                value={notifications?.ringtone || ""}
                onChange={(e) => setRingtone(e.target.value)}
                placeholder="https://example.com/ringtone.mp3"
                className="w-full px-4 py-3 border rounded-xl"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={triggerRingtoneUpload}
                  className="px-4 py-3 rounded-xl bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition"
                >
                  {ringtoneUploading ? "Uploading…" : "Upload Custom Ringtone"}
                </button>
                {ringtoneUploadError && (
                  <span className="text-sm text-red-500">{ringtoneUploadError}</span>
                )}
              </div>
              <input
                ref={ringtoneInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleRingtoneUpload}
              />
              <p className="text-sm text-gray-500">
                Upload a local ringtone file or paste a remote audio URL.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg mt-6">
          <div className="flex items-center gap-3 mb-4">
            <Info className="w-6 h-6" style={{ color: localTheme?.primary }} />
            <h2 className="text-xl font-semibold text-gray-800">About</h2>
          </div>
          <p className="text-gray-600">HansariaConnect v1.0.0</p>
          <p className="text-sm text-gray-500">
            © 2026 HansariaConnect. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;
