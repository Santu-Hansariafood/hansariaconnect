import type { Metadata } from "next"
import CompanyPage from "@/components/common/CompanyPage/CompanyPage"

export const metadata: Metadata = {
  title: "Terms and Conditions – HansariaConnect",
  description: "Read the terms and conditions for using HansariaConnect, the secure encrypted messaging platform.",
}

export default function TermsPage() {
  return <CompanyPage title="Terms and Conditions" description="These terms explain the rules and responsibilities that apply when you use HansariaConnect." updated="August 19, 2026" sections={[
    { title: "1. Using the service", body: "By using HansariaConnect, you agree to these Terms and our Privacy Policy. You must be at least 13 years old, or meet the minimum age required where you live." },
    { title: "2. Your account", body: "You are responsible for the information you provide, protecting access to your account, and activity performed through your account. Contact us promptly if you believe your account is being misused." },
    { title: "3. Acceptable use", body: "You may not use the service for unlawful, abusive, deceptive, or harmful activity, interfere with the service, distribute malware, impersonate others, or violate another person’s rights." },
    { title: "4. Content and communications", body: "You retain responsibility for content you send or upload. You must have the rights and permissions needed to share that content and must respect the privacy and consent of recipients." },
    { title: "5. Availability and changes", body: "We work to keep HansariaConnect reliable, but the service may change, be interrupted, or become unavailable. We may update these Terms and will publish the current version on this page." },
    { title: "6. Contact", body: "Questions about these Terms can be sent to support@hfconnect.in. If you do not agree with these Terms, please stop using the service." },
  ]} />
}