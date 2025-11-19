"use client"

import StatusPage from "@/components/pages/Status/Status"
import { useApp } from "@/context/AppContext/AppContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function StatusRoute() {
  const { user, theme } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.step !== "complete") router.push("/")
  }, [user, router])

  if (!user) return null

  return <StatusPage user={user} theme={theme} />
}
