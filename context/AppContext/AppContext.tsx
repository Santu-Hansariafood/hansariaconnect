"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

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

interface AppContextType {
  user: User | null
  theme: Theme
  setUser: (u: User | null) => void
  updateTheme: (t: Theme) => void
  logout: () => void
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
        }
      }
      setSessionChecked(true)
    }

    init()
  }, [])

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem("hansariaTheme", JSON.stringify(newTheme))
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {}
    setUser(null)
    localStorage.removeItem("hansariaUser")
  }

  return (
    <AppContext.Provider value={{ user, setUser, theme, updateTheme, logout }}>
      {sessionChecked ? children : null}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
