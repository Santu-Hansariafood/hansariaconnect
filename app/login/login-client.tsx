"use client"

import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext/AppContext"
import { useEffect } from "react"
import dynamic from "next/dynamic"
const Login = dynamic(() => import("@/components/pages/Login/Login"))

export default function LoginClient() {
  const { user } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (user?.step === "complete") router.push("/profile")
  }, [user, router])

  return <Login />
}
