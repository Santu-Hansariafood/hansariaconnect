"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Contacts = dynamic(() => import("@/components/pages/Contacts/Contacts"))

export default function ContactsPage() {
  const { user, theme } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.step !== "complete") router.push("/")
  }, [user, router])

  if (!user) return null

  return <Contacts user={user as any} theme={theme} />
}