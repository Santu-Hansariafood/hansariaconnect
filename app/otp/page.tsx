'use client'

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import dynamic from "next/dynamic"
import Loading from "@/components/common/Loading/Loading"
const Otp = dynamic(() => import("@/components/pages/Otp/Otp"));

export default function OtpPage() {
  const { user, setUser, sessionChecked } = useApp()
  const router = useRouter()
  const [serverError, setServerError] = useState("")

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

  const handleVerify = async (code: string) => {
    if (!user?.mobile) {
      router.replace("/login")
      return
    }

    setServerError("")
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile: user.mobile, code }),
      })
      const data = (await res.json().catch(() => null)) as {
        success?: boolean
        userId?: string
        name?: string
        photo?: string
        email?: string
        error?: string
      } | null

      if (!res.ok || !data?.success || !data.userId) {
        setServerError(data?.error || "Could not verify the code.")
        return
      }

      const updated = {
        id: data.userId,
        mobile: user.mobile,
        name: data.name || user.name,
        photo: data.photo || user.photo,
        email: data.email || user.email,
        step: "complete" as const,
      }
      setUser(updated)
      localStorage.setItem("hansariaUser", JSON.stringify(updated))
      router.push("/chat")
    } catch {
      setServerError("Could not reach the server. Please try again.")
    }
  }

  const handleResend = async (): Promise<
    string | { message: string; retryAfter?: number } | null
  > => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile: user.mobile }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        return {
          message: data?.error || "Could not send a new code. Please try again.",
          retryAfter:
            res.status === 429
              ? Number(res.headers.get("Retry-After")) || undefined
              : undefined,
        }
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
      serverError={serverError}
    />
    </Suspense>
  )
}
