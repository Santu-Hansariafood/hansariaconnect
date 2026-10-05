"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";
import type { Socket } from "socket.io-client";

type SocketHandler = (...args: never[]) => void;
type SocketLibraryHandler = Parameters<Socket["on"]>[1];

let socketInstance: Socket | null = null;
let socketConnectPromise: Promise<Socket> | null = null;
let socketListeners: Array<{ type: string; handler: SocketHandler }> = [];
let onlineListeners: Array<(ids: string[]) => void> = [];

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const isInitializedRef = useRef(false);

  const connect = useCallback(async (): Promise<Socket> => {
    if (socketInstance) {
      if (!socketInstance.connected && !socketInstance.active) {
        socketInstance.connect();
      }
      return socketInstance;
    }

    if (socketConnectPromise) return socketConnectPromise;

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
        reconnectionDelay: 800,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.2,
        timeout: 20000,
        upgrade: true,
        autoConnect: true,
        forceNew: false,
      });

      socketInstance = s;
      setSocket(s);

      let authenticationRetry: ReturnType<typeof setTimeout> | null = null;
      s.on("connect", () => {
        if (authenticationRetry) {
          clearTimeout(authenticationRetry);
          authenticationRetry = null;
        }
      });

      s.on("disconnect", (reason: string) => {
        setOnlineUserIds([]);
        onlineListeners.forEach((listener) => listener([]));
        if (reason === "io server disconnect") s.connect();
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
        setOnlineUserIds(ids);
        onlineListeners.forEach((listener) => listener(ids));
      });
      s.on("user:online", ({ userId }: { userId?: string }) => {
        if (!userId) return;
        setOnlineUserIds((current) => current.includes(userId) ? current : [...current, userId]);
      });
      s.on("user:offline", ({ userId }: { userId?: string }) => {
        if (!userId) return;
        setOnlineUserIds((current) => current.filter((id) => id !== userId));
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
  }, []);

  const removeOnlineListener = useCallback((listener: (ids: string[]) => void) => {
    onlineListeners = onlineListeners.filter((l) => l !== listener);
  }, []);

  useEffect(() => {
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
  }, [connect]);

  return { socket, onlineUserIds, addListener, removeListener, addOnlineListener, removeOnlineListener };
};
