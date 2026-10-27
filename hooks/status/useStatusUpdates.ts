"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { useApp } from "@/context/AppContext/AppContext";

export interface StatusUser {
  id?: string | number;
  name?: string;
  photo?: string;
}

export interface StatusItem {
  id: string;
  name: string;
  avatar: string;
  media: string;
  type: "image" | "video";
  timestamp: string | Date;
  views: number;
  hasViewed?: boolean;
}

export interface StatusViewerItem {
  id: string;
  media: string;
  type: "image" | "video";
  user?: string;
  avatar?: string;
  timestamp?: string | Date;
}

/** Statuses expire quickly, so polling harder than this adds nothing. */
const REFRESH_COOLDOWN_MS = 10_000;
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Owns everything the Status screen needs: the contact status feed, the
 * upload flow for your own status, view receipts and the full-screen viewer
 * state.
 */
export const useStatusUpdates = (user: StatusUser) => {
  const { bootstrapData, bootstrapReady } = useApp();

  const [contactStatuses, setContactStatuses] = useState<
    Record<string, StatusItem[]>
  >({});
  const [myStatus, setMyStatus] = useState<StatusItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [adoptedBootstrap, setAdoptedBootstrap] = useState(false);

  const [viewerItems, setViewerItems] = useState<StatusViewerItem[] | null>(null);
  const [viewerStart, setViewerStart] = useState(0);

  const hasLoadedStatuses = useRef(false);
  const statusRefresh = useRef({ inFlight: false, lastStartedAt: 0 });

  const loadStatuses = useCallback(async () => {
    const now = Date.now();
    if (
      statusRefresh.current.inFlight ||
      now - statusRefresh.current.lastStartedAt < REFRESH_COOLDOWN_MS
    ) {
      return;
    }

    statusRefresh.current.inFlight = true;
    statusRefresh.current.lastStartedAt = now;
    setStatusError("");
    if (!hasLoadedStatuses.current) setLoadingStatuses(true);

    try {
      const res = await fetch("/api/status", { credentials: "include" });
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
      hasLoadedStatuses.current = true;
      statusRefresh.current.inFlight = false;
      setLoadingStatuses(false);
    }
  }, []);

  // Bootstrap already ships the feed, so adopt it once during render instead of
  // firing an extra request on mount.
  const bootstrapStatuses = bootstrapData.statuses;
  if (
    !adoptedBootstrap &&
    bootstrapReady &&
    bootstrapStatuses &&
    typeof bootstrapStatuses === "object"
  ) {
    setAdoptedBootstrap(true);
    setContactStatuses(bootstrapStatuses);
    setLoadingStatuses(false);
  }

  useEffect(() => {
    if (!bootstrapReady) return;

    if (adoptedBootstrap || bootstrapStatuses !== undefined) {
      // The feed is already on screen, so later refreshes stay silent.
      hasLoadedStatuses.current = true;
      return;
    }

    const refreshIfVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadStatuses();
      }
    };

    refreshIfVisible();

    const interval = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [adoptedBootstrap, bootstrapReady, bootstrapStatuses, loadStatuses]);

  const handleStatusUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "status");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.url) {
        console.error("Status upload failed:", uploadData);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.status) {
        console.error("Status creation failed:", data);
        return;
      }

      setMyStatus({
        id: data.status.id,
        name: user.name || "You",
        avatar: user.photo || "",
        media: data.status.media,
        type: data.status.type,
        timestamp: data.status.createdAt,
        views: 0,
      });

      // Let the next refresh through immediately instead of waiting out the cooldown.
      statusRefresh.current.lastStartedAt = 0;
      await loadStatuses();
    } catch (error) {
      console.error("Status upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleStatusView = useCallback(async (statusId: string) => {
    try {
      const res = await fetch(`/api/status/${statusId}/view`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Recording status view failed:", errorData);
      }

      setContactStatuses((prev) => {
        const next: Record<string, StatusItem[]> = {};
        for (const [uid, list] of Object.entries(prev)) {
          next[uid] = list.map((status) =>
            status.id === statusId
              ? {
                  ...status,
                  hasViewed: true,
                  views: status.views + (status.hasViewed ? 0 : 1),
                }
              : status,
          );
        }
        return next;
      });
    } catch (error) {
      console.error("Recording status view failed:", error);
    }
  }, []);

  const openViewer = useCallback(
    (userId: string, startIndex: number) => {
      const list = contactStatuses[userId] || [];
      setViewerItems(
        list.map((status) => ({
          id: status.id,
          media: status.media,
          type: status.type,
          user: status.name,
          avatar: status.avatar,
          timestamp: status.timestamp,
        })),
      );
      setViewerStart(startIndex);
    },
    [contactStatuses],
  );

  const closeViewer = useCallback(() => setViewerItems(null), []);

  return {
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
  };
};
