import type { Metadata } from "next"
import CompanyPage from "@/components/common/CompanyPage/CompanyPage"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the terms that apply to using HansariaConnect, including the minimum age of 16, accounts, acceptable use, user content, and account deletion.",
  alternates: { canonical: "https://hfconnect.in/terms" },
}

export default function TermsPage() {
  return (
    <CompanyPage
      title="Terms of Service"
      description="These terms explain the responsibilities and rules that apply when you access or use HansariaConnect."
      updated="October 28, 2026"
      sections={[
        {
          title: "1. Acceptance and eligibility",
          body: "By accessing HansariaConnect, you agree to these Terms and our Privacy Policy. You must be at least 16 years old to create an account or use the service. If the minimum age required where you live is higher, that higher age applies. If you use the service for an organization, you confirm that you are authorized to accept these Terms for it.",
        },
        {
          title: "2. Your account",
          body: "Provide accurate account information and take reasonable steps to protect access to your account. You are responsible for activity performed through your account, except where applicable law provides otherwise. Contact support promptly if you believe your account has been compromised.",
        },
        {
          title: "3. Acceptable use",
          body: "Use HansariaConnect lawfully and respectfully. You must not:",
          items: [
            "Threaten, harass, defraud, exploit, or impersonate another person.",
            "Use the service to distribute unlawful material, malware, spam, or deceptive content.",
            "Interfere with the service, attempt unauthorized access, or disrupt other users.",
            "Violate another person's privacy, intellectual property, or other legal rights.",
            "Use the service in a way that creates an unreasonable security or operational risk.",
          ],
        },
        {
          title: "4. Your content and communications",
          body: "You remain responsible for content you submit or share and must have the rights and permissions needed to do so. You authorize us to process that content as needed to operate the features you request, consistent with the Privacy Policy. Respect recipients' privacy and remember that recipients may keep copies of messages or media.",
        },
        {
          title: "5. Service changes and availability",
          body: "We work to operate and improve HansariaConnect, but features may change and service may be interrupted or unavailable. We may suspend or restrict access when reasonably needed to protect users, comply with law, or address misuse or security risks.",
        },
        {
          title: "6. Account closure",
          body: "You may request account deletion using the process described on our account-deletion page. Deletion may make your profile and account access unavailable, does not remove copies already received by other users, and may be subject to limited retention required for legal, safety, or security purposes.",
          links: [{ label: "Account deletion instructions", href: "/account-deletion" }],
        },
        {
          title: "7. Disclaimers and liability",
          body: "To the extent permitted by applicable law, the service is provided on an \"as available\" basis. Nothing in these Terms excludes rights or remedies that cannot legally be excluded. To the extent permitted by law, HansariaConnect is not liable for indirect or consequential loss arising from use of the service.",
        },
        {
          title: "8. Updates to these Terms",
          body: "We may update these Terms as the service or applicable requirements change. The current version and its update date will be posted here. Continued use after an update takes effect means you accept the revised Terms to the extent permitted by law.",
        },
        {
          title: "9. Contact",
          body: "For questions about these Terms, contact support@hfconnect.in. If you do not agree with these Terms, stop using the service.",
          links: [
            {
              label: "Contact support",
              href: "mailto:support@hfconnect.in?subject=HansariaConnect%20terms%20question",
            },
          ],
        },
      ]}
    />
  );
}