"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Groups = dynamic(() => import("@/components/pages/Groups/Groups"));

export default function GroupsPage() {
  const { user, theme } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.step !== "complete") router.push("/")
  }, [user, router])

  if (!user) return null

  return <Groups user={user} theme={theme} />
}
