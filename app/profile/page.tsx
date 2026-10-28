"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Profile = dynamic(() => import( "@/components/pages/Profile/Profile"));

export default function ProfilePage() {
  const { user, theme, logout, sessionChecked } = useApp()
  const router = useRouter()

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  }

  useEffect(() => {
    if (!sessionChecked) return
    if (!user || user.step !== "complete") router.replace("/")
  }, [user, router, sessionChecked])

  if (!sessionChecked) return null
  if (!user) return null

  return <Profile user={user as any} theme={theme} onLogout={handleLogout} />
}
