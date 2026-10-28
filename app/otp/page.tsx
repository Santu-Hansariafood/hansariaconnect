'use client'

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
import Loading from "@/components/common/Loading/Loading"
const Otp = dynamic(() => import("@/components/pages/Otp/Otp"));

export default function OtpPage() {
  const { user, setUser, sessionChecked } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!sessionChecked) return
    if (!user || user.step !== "otp") {
      router.push("/")
    }
  }, [user, router, sessionChecked])

  if (!sessionChecked) return <Loading />;
  if (!user || user.step !== "otp") {
    return null
  }

  const handleVerify = (code: string) => {
    const updated = { ...user, step: "complete" as const }
    setUser(updated)
    localStorage.setItem("hansariaUser", JSON.stringify(updated))
    router.push("/chat")
  }

  const handleResend = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile: user.mobile }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        return data?.error || "Could not send a new code. Please try again."
      }
      return null
    } catch {
      return "Could not reach the server. Please check your connection."
    }
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
