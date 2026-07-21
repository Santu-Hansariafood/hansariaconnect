import type { Metadata } from "next"
import LoginClient from "./login-client"

export const metadata: Metadata = {
  title: "Login – HansariaConnect",
  description: "Login to HansariaConnect, the secure encrypted messaging app for private conversations.",
  keywords: ["HansariaConnect login", "secure chat login", "HFConnect login"],
}

export default function LoginPage() {
  return <LoginClient />
}
