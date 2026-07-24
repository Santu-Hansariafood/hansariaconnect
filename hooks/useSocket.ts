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
      transports: ["polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    socketInstance = s;
    setSocket(s);

    s.on("connect", () => {
      console.log("Socket connected");
    });
    s.on("disconnect", (reason: string) => {
      console.log("Socket disconnected:", reason);
    });
    s.on("connect_error", (err: any) => {
      console.error("Socket connection error:", err);
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
