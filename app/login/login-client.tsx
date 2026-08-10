"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import { Suspense, useEffect } from "react"
import dynamic from "next/dynamic"
const Login = dynamic(() => import("@/components/pages/Login/Login"))

function LoginClientInner() {
  const { user } = useApp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillMobile = searchParams?.get("mobile") ?? ""
  const reason = searchParams?.get("reason") ?? ""

  useEffect(() => {
    if (user?.step === "complete") router.push("/profile")
  }, [user, router])

  return <Login prefillMobile={prefillMobile} reason={reason || undefined} />
}

export default function LoginClient() {
  return (
    <Suspense fallback={null}>
      <LoginClientInner />
    </Suspense>
  )
}
