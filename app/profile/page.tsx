"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Profile = dynamic(() => import( "@/components/pages/Profile/Profile"));
import { useState, useEffect as useReactEffect } from "react"

export default function ProfilePage() {
  const { user, theme } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.step !== "complete") router.push("/")
  }, [user, router])

  if (!user) return null

  return <Profile user={user as any} theme={theme} />
}
