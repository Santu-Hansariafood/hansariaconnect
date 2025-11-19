"use client"

import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const NameEntry = dynamic(() => import("@/components/pages/NameEntry/NameEntry"));

export default function NameEntryPage() {
  const { user, setUser } = useApp()
  const router = useRouter()

  if (!user || user.step !== "name") {
    router.push("/")
    return null
  }

  const handleNameEntry = (name: string, photo: string) => {
    const updated = { ...user, name, photo, step: "complete" as const }
    setUser(updated)
    localStorage.setItem("hansariaUser", JSON.stringify(updated))
    router.push("/status")
  }

  return <NameEntry user={user} onComplete={handleNameEntry} />
}
