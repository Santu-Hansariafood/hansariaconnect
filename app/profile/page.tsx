"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Profile = dynamic(() => import( "@/components/pages/Profile/Profile"));

export default function ProfilePage() {
  const { user, theme, logout } = useApp()
  const router = useRouter()

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  }

  useEffect(() => {
    if (!user || user.step !== "complete") router.replace("/")
  }, [user, router])

  if (!user) return null

  return <Profile user={user as any} theme={theme} onLogout={handleLogout} />
}
