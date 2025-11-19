'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
const Otp = dynamic(() => import("@/components/pages/Otp/Otp"));

export default function OtpPage() {
  const { user, setUser } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.step !== "otp") {
      router.push("/")
    }
  }, [user, router])

  if (!user || user.step !== "otp") {
    return null
  }

  const handleVerify = (code: string) => {
    const updated = { ...user, step: "complete" as const }
    setUser(updated)
    localStorage.setItem("hansariaUser", JSON.stringify(updated))
    router.push("/chats")
  }

  const handleResend = () => {
  }

  return (
    <Otp
      mobile={user.mobile || ""}
      onVerify={handleVerify}
      onResend={handleResend}
    />
  )
}
