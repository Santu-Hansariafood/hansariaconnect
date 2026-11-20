"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";
import type { Socket } from "socket.io-client";

type SocketHandler = (...args: never[]) => void;
type SocketLibraryHandler = Parameters<Socket["on"]>[1];

let socketInstance: Socket | null = null;
let socketConnectPromise: Promise<Socket> | null = null;
let resumeRealtimeConnection: (() => void) | null = null;
let socketListeners: Array<{ type: string; handler: SocketHandler }> = [];
let onlineListeners: Array<(ids: string[]) => void> = [];
let onlineUsersSnapshot: string[] = [];

const publishOnlineUsers = (update: (current: string[]) => string[]) => {
  onlineUsersSnapshot = [...new Set(update(onlineUsersSnapshot))];
  onlineListeners.forEach((listener) => listener(onlineUsersSnapshot));
};

interface UseSocketOptions {
  subscribeOnline?: boolean;
  enabled?: boolean;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { subscribeOnline = true, enabled = true } = options;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const isInitializedRef = useRef(false);
  const syncOnlineUsers = useCallback((ids: string[]) => {
    setOnlineUserIds(ids);
  }, []);

  const connect = useCallback(async (): Promise<Socket> => {
    if (socketInstance) {
      if (!socketInstance.connected && !socketInstance.active) {
        socketInstance.connect();
      }
      setSocket(socketInstance);
      return socketInstance;
    }

    if (socketConnectPromise) {
      const sharedSocket = await socketConnectPromise;
      setSocket(sharedSocket);
      return sharedSocket;
    }

    socketConnectPromise = (async () => {
      const response = await fetch("/api/socket", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Realtime service returned HTTP ${response.status}`);
      }

      const url = typeof window !== "undefined" ? window.location.origin : undefined;
      const s = io(url, {
        path: "/api/socket",
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 400,
        reconnectionDelayMax: 4000,
        randomizationFactor: 0.2,
        timeout: 15000,
        upgrade: true,
        autoConnect: true,
        forceNew: false,
      });

      socketInstance = s;
      setSocket(s);

      let lastPacketAt = Date.now();
      let resumeProbeInFlight = false;
      const STALE_CONNECTION_MS = 35_000;

      const markPacket = () => {
        lastPacketAt = Date.now();
      };
      s.on("pong", markPacket);
      s.io.on("packet", markPacket);
      s.on("connect", markPacket);

      const reportVisibility = (hidden = document.visibilityState !== "visible") => {
        if (!socketInstance?.connected) return;
        socketInstance.emit("presence:visibility", { hidden });
      };

      const forceReconnect = () => {
        if (!socketInstance) return;
        console.info("[Socket] Refreshing realtime connection");
        if (socketInstance.connected) {
          socketInstance.disconnect();
        }
        socketInstance.connect();
      };

      /*
       * Mobile browsers freeze a backgrounded tab, which leaves the socket in a
       * half-dead state until Socket.IO's own heartbeat notices — that can mean
       * up to ~45s of missed messages. Keep the socket open in the background
       * while JS is still scheduled, and probe it the instant the app returns.
       */
      const resumeRealtime = () => {
        if (
          typeof document !== "undefined" &&
          document.visibilityState !== "visible"
        ) {
          return;
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          return;
        }
        if (!socketInstance) return;

        if (!socketInstance.connected) {
          console.info(
            "[Socket] App is back in the foreground — resuming realtime connection",
          );
          socketInstance.connect();
          return;
        }

        if (Date.now() - lastPacketAt > STALE_CONNECTION_MS) {
          forceReconnect();
          return;
        }

        if (resumeProbeInFlight) {
          reportVisibility(false);
          return;
        }

        resumeProbeInFlight = true;
        socketInstance.timeout(2500).emit("presence:ping", (error: Error | null) => {
          resumeProbeInFlight = false;
          if (error) {
            forceReconnect();
            return;
          }
          markPacket();
          reportVisibility(false);
        });
      };

      const keepAlive = () => {
        if (!socketInstance) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          return;
        }

        const hidden =
          typeof document !== "undefined" &&
          document.visibilityState !== "visible";

        if (!socketInstance.connected) {
          if (!hidden) socketInstance.connect();
          return;
        }

        reportVisibility(hidden);
      };

      window.addEventListener("online", resumeRealtime);
      window.addEventListener("focus", resumeRealtime);
      window.addEventListener("pageshow", resumeRealtime);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") resumeRealtime();
        else reportVisibility(true);
      });
      document.addEventListener("freeze", () => reportVisibility(true));
      document.addEventListener("resume", resumeRealtime);
      window.addEventListener("pagehide", () => reportVisibility(true));

      s.on("connect", () => reportVisibility());
      window.addEventListener("blur", () => reportVisibility());

      const keepAliveTimer = window.setInterval(keepAlive, 20_000);
      s.on("disconnect", () => {
        window.clearInterval(keepAliveTimer);
      });
      // Recreate the timer across reconnects by always running it on the window,
      // not tying its lifetime to a single socket disconnect.
      window.clearInterval(keepAliveTimer);
      window.setInterval(keepAlive, 20_000);

      let authenticationRetry: ReturnType<typeof setTimeout> | null = null;
      s.on("connect", () => {
        if (authenticationRetry) {
          clearTimeout(authenticationRetry);
          authenticationRetry = null;
        }
      });

      s.on("disconnect", (reason: string) => {
        publishOnlineUsers(() => []);
        if (reason === "io server disconnect") s.connect();
      });

      s.on("session:revoked", () => {
        socketInstance = null;
        s.disconnect();
        localStorage.removeItem("hansariaUser");
        if (typeof window !== "undefined") {
          window.location.assign("/login");
        }
      });

      s.on("connect_error", (error) => {
        console.error("[Socket] Connection failed:", error.message);
        if (!s.active && !authenticationRetry) {
          authenticationRetry = setTimeout(() => {
            authenticationRetry = null;
            if (socketInstance === s && !s.connected) s.connect();
          }, 5_000);
        }
      });

      s.io.on("reconnect_attempt", (attempt) => {
        console.info(`[Socket] Reconnecting (attempt ${attempt})`);
      });
      s.io.on("reconnect_error", (error) => {
        console.warn("[Socket] Reconnection attempt failed:", error.message);
      });
      s.io.on("reconnect_failed", () => {
        console.error("[Socket] Reconnection attempts were exhausted");
      });

      s.on("users:online", (ids: string[]) => {
        publishOnlineUsers(() => (Array.isArray(ids) ? ids : []));
      });
      s.on("user:online", ({ userId }: { userId?: string }) => {
        if (!userId) return;
        publishOnlineUsers((current) =>
          current.includes(userId) ? current : [...current, userId],
        );
      });
      s.on("user:offline", ({ userId }: { userId?: string }) => {
        if (!userId) return;
        publishOnlineUsers((current) => current.filter((id) => id !== userId));
      });

      socketListeners.forEach(({ type, handler }) =>
        s.on(type, handler as SocketLibraryHandler),
      );

      return s;
    })();

    try {
      return await socketConnectPromise;
    } finally {
      socketConnectPromise = null;
    }
  }, []);

  const addListener = useCallback((type: string, handler: SocketHandler) => {
    const alreadyRegistered = socketListeners.some(
      (listener) => listener.type === type && listener.handler === handler
    );

    if (!alreadyRegistered) {
      socketListeners.push({ type, handler });
    }

    if (socketInstance) {
      socketInstance.on(type, handler as SocketLibraryHandler);
    }
  }, []);

  const removeListener = useCallback((type: string, handler: SocketHandler) => {
    socketListeners = socketListeners.filter(
      (l) => !(l.type === type && l.handler === handler)
    );
    if (socketInstance) {
      socketInstance.off(type, handler as SocketLibraryHandler);
    }
  }, []);

  const addOnlineListener = useCallback((listener: (ids: string[]) => void) => {
    onlineListeners.push(listener);
    listener(onlineUsersSnapshot);
  }, []);

  const removeOnlineListener = useCallback((listener: (ids: string[]) => void) => {
    onlineListeners = onlineListeners.filter((l) => l !== listener);
  }, []);

  useEffect(() => {
    if (!subscribeOnline) return;
    addOnlineListener(syncOnlineUsers);
    return () => removeOnlineListener(syncOnlineUsers);
  }, [addOnlineListener, removeOnlineListener, syncOnlineUsers, subscribeOnline]);

  useEffect(() => {
    if (!enabled) {
      isInitializedRef.current = false;
      return;
    }

    const initialize = () => {
      if (isInitializedRef.current) return;
      isInitializedRef.current = true;
      void connect().catch((error) => {
        console.error("[Socket] Could not initialize realtime connection:", error);
        isInitializedRef.current = false;
        window.setTimeout(initialize, 5_000);
      });
    };

    initialize();

    return () => {
      // Don't disconnect on unmount to keep the socket alive across components
    };
  }, [connect, enabled]);

  return {
    socket,
    onlineUserIds,
    addListener,
    removeListener,
    addOnlineListener,
    removeOnlineListener,
  };
};

export const disconnectSocket = () => {
  const currentSocket = socketInstance;
  socketInstance = null;
  socketConnectPromise = null;
  currentSocket?.disconnect();
  publishOnlineUsers(() => []);
};
