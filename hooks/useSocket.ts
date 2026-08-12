"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";

let socketInstance: any = null;
let socketListeners: Array<{ type: string; handler: (...args: any[]) => void }> = [];
let onlineListeners: Array<(ids: string[]) => void> = [];

export const useSocket = () => {
  const [socket, setSocket] = useState<any>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const isInitializedRef = useRef(false);

  const connect = useCallback(async () => {
    if (socketInstance && socketInstance.connected) {
      return socketInstance;
    }

    try {
      const cacheBuster = new Date().getTime();
      await fetch(`/api/socket?t=${cacheBuster}`);
    } catch {}

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

    s.on("disconnect", (reason: string) => {
      if (reason === "io server disconnect") {
        s.connect();
      }
    });

    s.on("connect_error", (_err: any) => {
      // Silent fallback: keep reconnecting without exposing internal errors
    });

    s.on("reconnect_attempt", (_attempt: number) => {
      // Silent reconnection attempt
    });

    s.on("reconnect_error", (_err: any) => {
      // Silent fallback for reconnect errors
    });

    s.on("reconnect_failed", () => {
      // Keep socket alive for later retry
    });

    // Handle users:online
    s.on("users:online", (ids: string[]) => {
      setOnlineUserIds(ids);
      onlineListeners.forEach((listener) => listener(ids));
    });

    // Re-add existing listeners
    socketListeners.forEach(({ type, handler }) => {
      s.on(type, handler);
    });

    return s;
  }, []);

  const addListener = useCallback((type: string, handler: (...args: any[]) => void) => {
    socketListeners.push({ type, handler });
    if (socketInstance) {
      socketInstance.on(type, handler);
    }
  }, []);

  const removeListener = useCallback((type: string, handler: (...args: any[]) => void) => {
    socketListeners = socketListeners.filter(
      (l) => !(l.type === type && l.handler === handler)
    );
    if (socketInstance) {
      socketInstance.off(type, handler);
    }
  }, []);

  const addOnlineListener = useCallback((listener: (ids: string[]) => void) => {
    onlineListeners.push(listener);
  }, []);

  const removeOnlineListener = useCallback((listener: (ids: string[]) => void) => {
    onlineListeners = onlineListeners.filter((l) => l !== listener);
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      connect();
    }

    return () => {
      // Don't disconnect on unmount to keep the socket alive across components
    };
  }, [connect]);

  return { socket, onlineUserIds, addListener, removeListener, addOnlineListener, removeOnlineListener };
};
