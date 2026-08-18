"use client";

import {
  useState,
  ChangeEvent,
  useEffect,
  Suspense,
  useCallback,
} from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
const StatusViewer = dynamic(
  () => import("@/components/common/StatusViewer/StatusViewer"),
  { ssr: false },
);
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import {
  staggerContainer,
  fadeInVariants,
} from "@/utils/animations/animations";
import Loading from "@/components/common/Loading/Loading";
import { useApp } from "@/context/AppContext/AppContext";

const Navbar = dynamic(() => import("@/components/common/Navbar/Navbar"));
const StatusCard = dynamic(
  () => import("@/components/common/StatusCard/StatusCard"),
  { ssr: false },
);

interface User {
  name?: string;
  photo?: string;
}

interface Theme {
  wallpaper: string;
  textSize?: string;
  primary?: string;
}

interface StatusItem {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  media: string;
  type: "image" | "video";
  timestamp: string | Date;
  views: number;
  hasViewed?: boolean;
  expiresAt?: string | Date;
}

export default function StatusPage({
  user,
  theme,
  onLogout,
}: {
  user: User;
  theme: Theme;
  onLogout?: () => void;
}) {
  const [myStatus, setMyStatus] = useState<StatusItem | null>(null);
  const [contactStatuses, setContactStatuses] = useState<
    Record<string, StatusItem[]>
  >({});
  const [uploading, setUploading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const { bootstrapData } = useApp();

  const loadStatuses = useCallback(async () => {
    setStatusError("");
    setLoadingStatuses(true);
    try {
      const res = await fetch("/api/status", {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data?.statuses) {
        setContactStatuses(data.statuses);
      } else {
        setStatusError(data?.error || "Unable to load status updates.");
      }
    } catch (err: unknown) {
      console.error("Failed to load statuses:", err);
      setStatusError("Unable to load status updates right now.");
    } finally {
      setLoadingStatuses(false);
    }
  }, []);

  useEffect(() => {
    if (bootstrapData.statuses && Object.keys(bootstrapData.statuses).length > 0) {
      setContactStatuses(bootstrapData.statuses);
      setLoadingStatuses(false);
      return;
    }

    const refreshIfVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadStatuses();
      }
    };

    refreshIfVisible();

    const interval = window.setInterval(refreshIfVisible, 15000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [bootstrapData.statuses, loadStatuses]);

  const handleStatusUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "status");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        console.error("Upload failed:", errorData);
        setUploading(false);
        return;
      }

      const uploadData = await uploadRes.json();
      if (!uploadData?.url) {
        console.error("No URL in upload response:", uploadData);
        setUploading(false);
        return;
      }

      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          media: uploadData.url,
          type: file.type.startsWith("video") ? "video" : "image",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Status creation failed:", errorData);
        setUploading(false);
        return;
      }

      const data = await res.json();
      if (data?.status) {
        setMyStatus({
          id: data.status.id,
          userId: String((user as { id?: string })?.id || ""),
          name: user.name || "You",
          avatar: user.photo || "",
          media: data.status.media,
          type: data.status.type,
          timestamp: data.status.createdAt,
          views: 0,
        });
        await loadStatuses();
      }
    } catch (error) {
      console.error("Status upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleStatusView = async (statusId: string) => {
    try {
      await fetch(`/api/status/${statusId}/view`, {
        method: "POST",
        credentials: "include",
      });
      setContactStatuses((prev) => {
        const next: Record<string, StatusItem[]> = {};
        for (const [uid, list] of Object.entries(prev)) {
          next[uid] = list.map((status) =>
            status.id === statusId
              ? { ...status, hasViewed: true, views: status.views + 1 }
              : status,
          );
        }
        return next;
      });
    } catch {}
  };

  const [viewerItems, setViewerItems] = useState<
    | {
        id: string;
        media: string;
        type: "image" | "video";
        user?: string;
      }[]
    | null
  >(null);

  const [viewerStart, setViewerStart] = useState(0);

  const openViewer = (userId: string, startIdx: number) => {
    const list = contactStatuses[userId] || [];
    const items = list.map((s) => ({
      id: s.id,
      media: s.media,
      type: s.type,
      user: s.name,
    }));
    setViewerItems(items);
    setViewerStart(startIdx);
  };

  return (
    <Suspense fallback={<Loading />}>
      <div className={`min-h-screen ${theme.wallpaper}`}>
        <Navbar user={user} onLogout={onLogout} />

        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1
              className={`text-3xl font-bold text-gray-800 mb-4 ${theme.textSize}`}
            >
              Status Updates
            </h1>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            <motion.div
              variants={fadeInVariants}
              className="bg-white rounded-2xl p-6 shadow-lg"
            >
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                My Status
              </h2>

              {myStatus ? (
                <StatusCard
                  status={{
                    user: myStatus.name,
                    avatar: myStatus.avatar,
                    type: myStatus.type,
                    timestamp: myStatus.timestamp,
                    views: myStatus.views,
                  }}
                  theme={theme}
                />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden">
                      <Image
                        src={user.photo || "/logo/logo.png"}
                        alt={user.name || "User"}
                        width={64}
                        height={64}
                        className="object-cover"
                      />
                    </div>

                    <label
                      className={`absolute bottom-0 right-0 p-2 rounded-full cursor-pointer shadow-lg ${
                        uploading ? "opacity-50" : ""
                      }`}
                      style={{ backgroundColor: theme.primary }}
                    >
                      <Plus className="w-4 h-4 text-white" />
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleStatusUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  <div>
                    <p className="font-medium text-gray-800">
                      {uploading ? "Uploading..." : "Add Status"}
                    </p>
                    <p className="text-sm text-gray-500">Share your moment</p>
                  </div>
                </div>
              )}
            </motion.div>
            <motion.div
              variants={fadeInVariants}
              className="bg-white rounded-2xl p-6 shadow-lg"
            >
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Recent Updates
              </h2>

              <div className="space-y-4">
                {loadingStatuses ? (
                  <p className="text-gray-500 text-center py-8">
                    Loading status updates...
                  </p>
                ) : statusError ? (
                  <p className="text-red-500 text-center py-8">{statusError}</p>
                ) : Object.keys(contactStatuses).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No status updates from your contacts
                  </p>
                ) : (
                  Object.entries(contactStatuses).map(([uid, statuses]) => (
                    <div key={uid}>
                      <h4 className="text-sm text-gray-500 mb-2">
                        {statuses[0]?.name || uid}
                      </h4>
                      <div className="space-y-2">
                        {statuses.map((status: StatusItem, idx: number) => (
                          <div
                            key={status.id}
                            onClick={() => openViewer(uid, idx)}
                            className="cursor-pointer"
                          >
                            <StatusCard
                              status={{
                                user: status.name,
                                avatar: status.avatar,
                                type: status.type,
                                timestamp: status.timestamp,
                                views: status.views,
                              }}
                              theme={theme}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
        {viewerItems && (
          // @ts-ignore
          <StatusViewer
            items={viewerItems}
            startIndex={viewerStart}
            onClose={() => setViewerItems(null)}
          />
        )}
      </div>
    </Suspense>
  );
}
