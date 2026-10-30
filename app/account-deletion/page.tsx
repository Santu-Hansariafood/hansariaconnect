import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = {
  title: "Delete Your HansariaConnect Account",
  description:
    "Learn how to request deletion of your HansariaConnect account and what happens to account information and messages.",
  alternates: { canonical: "https://hfconnect.in/account-deletion" },
};

export default function AccountDeletionPage() {
  return (
    <CompanyPage
      title="Request deletion of your HansariaConnect account"
      eyebrow="Account and data choices"
      description="You can ask us to delete your account by contacting the privacy team. This page explains how to submit a request, how we verify it, and what deletion means."
      updated="October 28, 2026"
      sections={[
        {
          title: "How to submit a request",
          body: "Email privacy@hfconnect.in from the email address associated with your account, if available. Include the mobile number or email address registered to the account so we can locate it. Do not send your password, one-time password, verification code, or unnecessary identity documents.",
          links: [
            {
              label: "Email an account deletion request",
              href: "mailto:privacy@hfconnect.in?subject=HansariaConnect%20account%20deletion%20request",
            },
          ],
        },
        {
          title: "Verification and processing",
          body: "We may ask for information reasonably needed to verify that you control the account before acting. We will review the request and communicate if further information is needed. Processing time can depend on verification, the scope of the request, and legal requirements; we do not promise a fixed completion time on this page.",
        },
        {
          title: "What account deletion means",
          body: "Once completed, you will no longer be able to use that account. Account profile and service data associated with it will be deleted or de-identified where applicable. You may lose access to profile details, contacts, groups, messages, and other account features, and the request may not be reversible.",
        },
        {
          title: "Messages and other users",
          body: "Deleting your account does not delete copies of messages, media, or other information already received or saved by other users. Those recipients manage copies in their own accounts.",
        },
        {
          title: "Limited retention",
          body: "Some information may need to be retained for a limited purpose, such as complying with law, addressing security or abuse, or resolving disputes. Information retained for such a purpose is not kept for unrelated use. For more detail about information handling, read the Privacy Policy.",
          links: [{ label: "Read the Privacy Policy", href: "/privacy" }],
        },
        {
          title: "Need help?",
          body: "If you cannot access your registered email or have a concern about unauthorized account access, contact support@hfconnect.in and describe the issue. Never email your password or one-time code.",
          links: [
            {
              label: "Contact support",
              href: "mailto:support@hfconnect.in?subject=HansariaConnect%20account%20help",
            },
          ],
        },
      ]}
    />
  );
}
