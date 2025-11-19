"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const ChatWindow = dynamic(() => import("@/components/pages/ChatWindow/ChatWindow"));

export default function ChatRoute() {
  const { user, theme } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.step !== "complete") router.push("/")
  }, [user, router])

  if (!user) return null

  return <ChatWindow user={user as any} theme={theme} />
}

