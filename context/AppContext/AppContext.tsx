"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react"
import NotificationManager from "@/components/common/NotificationManager/NotificationManager"
import Loading from "@/components/common/Loading/Loading"

interface User {
  id?: string
  name?: string
  photo?: string
  mobile?: string
  step?: "otp" | "name" | "complete"
}

interface Theme {
  primary: string
  secondary: string
  wallpaper: string
  wallpaperImage?: string
  textSize: string
}

interface CachedMessages {
  messages: any[]
  hasMore: boolean
  loadedAt: number
}

interface BootstrapData {
  conversations?: any[]
  statuses?: Record<string, any[]>
  unreadCounts?: Record<string, number>
}

interface AppContextType {
  user: User | null
  theme: Theme
  setUser: (u: User | null) => void
  updateTheme: (t: Theme) => void
  logout: () => void
  getCachedMessages: (peerId: string) => CachedMessages | undefined
  setCachedMessages: (peerId: string, data: CachedMessages) => void
  mergeCachedMessages: (peerId: string, incoming: any[], hasMore?: boolean) => void
  clearCachedMessages: (peerId?: string) => void
  bootstrapData: BootstrapData
  bootstrapReady: boolean
  prefetchHomeData: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

const DEFAULT_THEME: Theme = {
  primary: "#0CA678",
  secondary: "#A2F5BF",
  wallpaper: "bg-gradient-to-br from-emerald-50 to-teal-50",
  textSize: "text-base",
}

const readSavedTheme = (): Theme => {
  if (typeof window === "undefined") return { ...DEFAULT_THEME }
  try {
    const raw = window.localStorage.getItem("hansariaTheme")
    if (!raw) return { ...DEFAULT_THEME }
    return { ...DEFAULT_THEME, ...(JSON.parse(raw) as Partial<Theme>) }
  } catch {
    return { ...DEFAULT_THEME }
  }
}

const validateServerSession = async (): Promise<boolean> => {
  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
    })
    return res.ok
  } catch {
    return false
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [theme, setTheme] = useState<Theme>(readSavedTheme)
  const [sessionChecked, setSessionChecked] = useState(false)
  const messagesCache = useRef(new Map<string, CachedMessages>())
  const [bootstrapData, setBootstrapData] = useState<BootstrapData>({})
  const [bootstrapReady, setBootstrapReady] = useState(false)

  const prefetchHomeData = async () => {
    try {
      const [convRes, statusRes, unreadRes] = await Promise.all([
        fetch("/api/conversations", { credentials: "include", cache: "no-store" }),
        fetch("/api/status", { credentials: "include", cache: "no-store" }),
        fetch("/api/unread-counts", { credentials: "include", cache: "no-store" }),
      ])

      const [convData, statusData, unreadData] = await Promise.all([
        convRes.ok ? convRes.json() : Promise.resolve({}),
        statusRes.ok ? statusRes.json() : Promise.resolve({}),
        unreadRes.ok ? unreadRes.json() : Promise.resolve({}),
      ])

      setBootstrapData({
        conversations: Array.isArray(convData?.conversations) ? convData.conversations : [],
        statuses: statusData?.statuses || {},
        unreadCounts: {
          ...(unreadData?.conversations || {}),
          ...(unreadData?.groups || {}),
        },
      })
    } catch {}
    finally {
      setBootstrapReady(true)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    let cancelled = false;
    let updateInterval: number | undefined;
    let checkForUpdate: (() => void) | undefined;

    const isUserTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable === true
      );
    };

    let reloadScheduled = false;
    const reloadForUpdate = () => {
      if (reloadScheduled) return;
      reloadScheduled = true;

      const tryReload = () => {
        if (document.visibilityState === "visible" && isUserTyping()) {
          return false;
        }
        console.log("[AppProvider] Applying app update — reloading");
        cleanup();
        window.location.reload();
        return true;
      };
      const cleanup = () => {
        document.removeEventListener("visibilitychange", tryReload);
        document.removeEventListener("focusout", tryReload);
      };

      if (tryReload()) return;
      console.log(
        "[AppProvider] App update ready — deferring reload until typing stops",
      );
      document.addEventListener("visibilitychange", tryReload);
      document.addEventListener("focusout", tryReload);
    };

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;
        console.log(
          "[AppProvider] ServiceWorker registered successfully for scope:",
          registration.scope,
          "| SW state:",
          registration.active?.state || registration.waiting?.state || registration.installing?.state || "installing",
        );

        if (registration.waiting) {
          console.log("[AppProvider] ServiceWorker update already waiting — activating");
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          console.log("[AppProvider] ServiceWorker update found - new version installing...");
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") {
              console.log("[AppProvider] ServiceWorker new version installed");
            }
          });
        });

        checkForUpdate = () => {
          registration.update().catch((error: unknown) => {
            console.warn(
              "[AppProvider] ServiceWorker update check failed:",
              error instanceof Error ? error.message : String(error),
            );
          });
        };
        updateInterval = window.setInterval(checkForUpdate, 15 * 60 * 1000);
      } catch (error: any) {
        if (cancelled) return;
        console.error(
          "[AppProvider] ServiceWorker registration FAILED. In-page notifications will still work, but background push delivery may be unavailable.",
          "Error:",
          error?.message || String(error),
        );
      }
    })();

    const onFocus = () => checkForUpdate?.();
    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate?.();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    let hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        console.log("[AppProvider] ServiceWorker is now controlling this page");
        return;
      }
      reloadForUpdate();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (updateInterval !== undefined) window.clearInterval(updateInterval);
    };
  }, [])

  useEffect(() => {
    void (async () => {
      let savedUser: User | null = null
      try {
        const rawUser = localStorage.getItem("hansariaUser")
        if (rawUser) savedUser = JSON.parse(rawUser) as User
      } catch (error) {
        console.error("[AppProvider] Could not restore saved app state:", error)
        localStorage.removeItem("hansariaUser")
      }

      if (savedUser) setUser(savedUser)
      setSessionChecked(true)

      try {
        const [valid, settings] = await Promise.all([
          savedUser ? validateServerSession() : Promise.resolve(false),
          fetch("/api/settings", {
            credentials: "include",
            cache: "no-store",
          })
            .then((res) => (res.ok ? res.json() : null))
            .catch((error) => {
              console.error("[AppProvider] Could not load settings:", error)
              return null
            }),
        ])

        if (settings?.theme) {
          setTheme(settings.theme)
          localStorage.setItem("hansariaTheme", JSON.stringify(settings.theme))
        }

        if (savedUser && !valid) {
          localStorage.removeItem("hansariaUser")
          setUser(null)
        }
      } catch (error) {
        console.error("[AppProvider] App session initialization failed:", error)
      }
    })()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty("--brand-primary", theme.primary)
    if (theme.secondary) root.style.setProperty("--brand-secondary", theme.secondary)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.primary)
  }, [theme.primary, theme.secondary])

  useEffect(() => {
    if (!user) {
      if (!sessionChecked) return
      setBootstrapReady(true)
      return
    }

    void prefetchHomeData()
  }, [user, sessionChecked])

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem("hansariaTheme", JSON.stringify(newTheme))
  }

  const mergeMessagesById = useCallback((prev: any[], incoming: any[]): any[] => {
    const map = new Map<string, any>()
    for (const m of prev) {
      const k = m.id?.toString?.() || m._id?.toString?.() || String(m.timestamp || m.createdAt || "")
      if (!map.has(k)) map.set(k, m)
    }
    for (const m of incoming) {
      const k = m.id?.toString?.() || m._id?.toString?.() || String(m.timestamp || m.createdAt || "")
      if (!map.has(k)) map.set(k, m)
    }
    return Array.from(map.values()).sort((a: any, b: any) => {
      const ta = new Date(a.timestamp || a.createdAt || 0).getTime()
      const tb = new Date(b.timestamp || b.createdAt || 0).getTime()
      return ta - tb
    })
  }, [])

  const getCachedMessages = useCallback(
    (peerId: string) => messagesCache.current.get(peerId),
    [],
  )

  const setCachedMessages = useCallback((peerId: string, data: CachedMessages) => {
    if (messagesCache.current.get(peerId) === data) return
    const next = new Map(messagesCache.current)
    next.set(peerId, data)
    messagesCache.current = next
  }, [])

  const mergeCachedMessages = useCallback((peerId: string, incoming: any[], hasMore?: boolean) => {
    const existing = messagesCache.current.get(peerId)
    const merged = existing
      ? mergeMessagesById(existing.messages, incoming)
      : [...incoming]
    const nextValue = {
      messages: merged,
      hasMore: typeof hasMore === "boolean" ? hasMore : !!existing?.hasMore,
      loadedAt: Date.now(),
    }
    if (
      existing &&
      existing.hasMore === nextValue.hasMore &&
      existing.messages.length === nextValue.messages.length &&
      existing.messages.every((message, index) => message === nextValue.messages[index])
    ) {
      return
    }
    const next = new Map(messagesCache.current)
    next.set(peerId, nextValue)
    messagesCache.current = next
  }, [mergeMessagesById])

  const clearCachedMessages = useCallback((peerId?: string) => {
    if (!peerId) {
      messagesCache.current = new Map()
      return
    }
    if (!messagesCache.current.has(peerId)) return
    const next = new Map(messagesCache.current)
    next.delete(peerId)
    messagesCache.current = next
  }, [])

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {}
    setUser(null)
    localStorage.removeItem("hansariaUser")
    clearCachedMessages()
  }

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        theme,
        updateTheme,
        logout,
        getCachedMessages,
        setCachedMessages,
        mergeCachedMessages,
        clearCachedMessages,
        bootstrapData,
        bootstrapReady,
        prefetchHomeData,
      }}
    >
      {sessionChecked ? (
        <>
          <NotificationManager userId={user?.id ? String(user.id) : null} />
          {children}
        </>
      ) : (
        <Loading />
      )}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
