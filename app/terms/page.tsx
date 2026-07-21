import type { Metadata } from "next"
import TermsClient from "./terms-client"

export const metadata: Metadata = {
  title: "Terms and Conditions – HansariaConnect",
  description: "Read the terms and conditions for using HansariaConnect, the secure encrypted messaging platform.",
}

export default function TermsPage() {
  return <TermsClient />
}