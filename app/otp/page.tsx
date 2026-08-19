'use client'

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
import Loading from "@/components/common/Loading/Loading"
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
    router.push("/chat")
  }

  const handleResend = () => {
  }

  return (
    <Suspense fallback={<Loading />}>
    <Otp
      mobile={user.mobile || ""}
      onVerify={handleVerify}
      onResend={handleResend}
    />
    </Suspense>
  )
}
