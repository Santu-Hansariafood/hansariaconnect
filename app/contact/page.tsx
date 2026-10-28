import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = {
  title: "Contact HansariaConnect",
  description: "Contact the HansariaConnect support, privacy, and partnerships teams.",
  alternates: { canonical: "https://hfconnect.in/contact" },
};

export default function ContactPage() {
  return (
    <CompanyPage
      title="Contact us"
      description="We are here to help with account questions, support requests, privacy concerns, and partnership enquiries."
      sections={[
        {
          title: "Support",
          body: "For help using HansariaConnect, email support@hfconnect.in with your registered mobile number and a short description of the issue. Never send your password or one-time password.",
        },
        {
          title: "Privacy and account deletion",
          body: "For privacy or data requests, email privacy@hfconnect.in. Include only the information needed to identify your request. See the account deletion page for instructions.",
          links: [{ label: "Account deletion instructions", href: "/account-deletion" }],
        },
        {
          title: "Business and partnerships",
          body: "For business enquiries, email partnerships@hfconnect.in. We review partnership proposals that improve communication, access, or safety for our users.",
        },
        {
          title: "Response times",
          body: "We aim to acknowledge requests during normal business hours. Response times may vary depending on the complexity and urgency of the request.",
        },
      ]}
    />
  );
}