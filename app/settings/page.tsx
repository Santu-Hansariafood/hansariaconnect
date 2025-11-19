"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Settings = dynamic(() => import("@/components/common/Settings/Settings"))

export default function SettingsPage() {
  const { user, theme, updateTheme } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.step !== "complete") router.push("/")
  }, [user, router])

  if (!user) return null

  return <Settings user={user} theme={theme} onThemeChange={updateTheme} />
}
