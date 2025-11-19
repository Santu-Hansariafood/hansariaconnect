"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Profile = dynamic(() => import( "@/components/pages/Profile/Profile"));

export default function ProfilePage() {
  const { user, theme } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.step !== "complete") router.push("/")
  }, [user, router])

  if (!user) return null

  const safeUser = {
    name: user.name || "User",
    mobile: user.mobile || "",
    photo:
      user.photo ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop",
  }

  return <Profile user={safeUser as any} theme={theme} />
}
