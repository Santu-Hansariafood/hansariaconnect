"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Contacts = dynamic(() => import("@/components/pages/Contacts/Contacts"))

export default function ContactsPage() {
  const { user, theme, sessionChecked } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!sessionChecked) return
    if (!user || user.step !== "complete") router.push("/")
  }, [user, router, sessionChecked])

  if (!sessionChecked) return null
  if (!user) return null

  return <Contacts user={user as any} theme={theme} />
}