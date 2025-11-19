"use client"

import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import { useEffect } from "react"
import dynamic from "next/dynamic"
const Login = dynamic(() => import("@/components/pages/Login/Login"))

export default function LoginPage() {
  const { user, setUser } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (user?.step === "otp") router.push("/otp")
    else if (user?.step === "name") router.push("/name-entry")
    else if (user?.step === "complete") router.push("/status")
  }, [user, router])

  const handleLogin = (mobile: string) => {
    const userData = { mobile, step: "otp" as const }
    setUser(userData)
    localStorage.setItem("hansariaUser", JSON.stringify(userData))
    router.push("/otp")
  }

  return <Login onLogin={handleLogin} />
}
