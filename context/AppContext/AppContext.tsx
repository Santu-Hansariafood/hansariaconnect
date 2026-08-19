"use client"

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react"

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
  const [theme, setTheme] = useState<Theme>({
    primary: "#0CA678",
    secondary: "#A2F5BF",
    wallpaper: "bg-gradient-to-br from-emerald-50 to-teal-50",
    textSize: "text-base",
  })
  const [sessionChecked, setSessionChecked] = useState(false)
  const [messagesCache, setMessagesCache] = useState<Map<string, CachedMessages>>(new Map())
  const [bootstrapData, setBootstrapData] = useState<BootstrapData>({})
  const [bootstrapReady, setBootstrapReady] = useState(false)

  const prefetchHomeData = async () => {
    try {
      const [convRes, statusRes] = await Promise.all([
        fetch("/api/conversations", { credentials: "include", cache: "no-store" }),
        fetch("/api/status", { credentials: "include", cache: "no-store" }),
      ])

      const [convData, statusData] = await Promise.all([
        convRes.ok ? convRes.json() : Promise.resolve({}),
        statusRes.ok ? statusRes.json() : Promise.resolve({}),
      ])

      setBootstrapData({
        conversations: Array.isArray(convData?.conversations) ? convData.conversations : [],
        statuses: statusData?.statuses || {},
      })
    } catch {}
    finally {
      setBootstrapReady(true)
    }
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [])

  useEffect(() => {
    const savedUser = localStorage.getItem("hansariaUser")
    const savedTheme = localStorage.getItem("hansariaTheme")
    if (savedTheme) setTheme(JSON.parse(savedTheme))

    const init = async () => {
      if (savedUser) {
        const parsed = JSON.parse(savedUser) as User
        const valid = await validateServerSession()
        if (valid) {
          setUser(parsed)
        } else {
          localStorage.removeItem("hansariaUser")
          setUser(null)
          setBootstrapReady(true)
        }
      } else {
        setBootstrapReady(true)
      }
      setSessionChecked(true)
    }

    init()
  }, [])

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

  const getCachedMessages = useCallback((peerId: string) => messagesCache.get(peerId), [messagesCache])

  const setCachedMessages = useCallback((peerId: string, data: CachedMessages) => {
    setMessagesCache((prev) => {
      const current = prev.get(peerId)
      if (current === data) return prev
      const next = new Map(prev)
      next.set(peerId, data)
      return next
    })
  }, [])

  const mergeCachedMessages = useCallback((peerId: string, incoming: any[], hasMore?: boolean) => {
    setMessagesCache((prev) => {
      const existing = prev.get(peerId)
      const merged = existing ? mergeMessagesById(existing.messages, incoming) : [...incoming]
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
        return prev
      }
      const next = new Map(prev)
      next.set(peerId, nextValue)
      return next
    })
  }, [mergeMessagesById])

  const clearCachedMessages = useCallback((peerId?: string) => {
    setMessagesCache((prev) => {
      if (!peerId) return new Map()
      if (!prev.has(peerId)) return prev
      const next = new Map(prev)
      next.delete(peerId)
      return next
    })
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
      {sessionChecked ? children : null}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
