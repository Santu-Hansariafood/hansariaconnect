"use client";

import { Suspense } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

import {
  staggerContainer,
  fadeInVariants,
} from "@/utils/animations/animations";
import Loading from "@/components/common/Loading/Loading";
import {
  useStatusUpdates,
  type StatusItem,
  type StatusUser,
} from "@/hooks/status/useStatusUpdates";

const Navbar = dynamic(() => import("@/components/common/Navbar/Navbar"));
const StatusViewer = dynamic(
  () => import("@/components/common/StatusViewer/StatusViewer"),
  { ssr: false },
);
const StatusCard = dynamic(
  () => import("@/components/common/StatusCard/StatusCard"),
  { ssr: false },
);

interface Theme {
  wallpaper: string;
  textSize?: string;
  primary?: string;
}

export default function StatusPage({
  user,
  theme,
  onLogout,
}: {
  user: StatusUser;
  theme: Theme;
  onLogout?: () => void;
}) {
  const {
    contactStatuses,
    myStatus,
    uploading,
    statusError,
    loadingStatuses,
    viewerItems,
    viewerStart,
    handleStatusUpload,
    handleStatusView,
    openViewer,
    closeViewer,
  } = useStatusUpdates(user);

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
          <StatusViewer
            items={viewerItems}
            startIndex={viewerStart}
            onClose={closeViewer}
            onView={handleStatusView}
          />
        )}
      </div>
    </Suspense>
  );
}
