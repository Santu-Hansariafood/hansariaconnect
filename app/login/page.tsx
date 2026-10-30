import type { Metadata } from "next"
import LoginClient from "./login-client"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your HansariaConnect messaging account.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginPage() {
  return <LoginClient />
}
