import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = { title: "Contact HansariaConnect", description: "Contact the HansariaConnect support and partnerships team." };

export default function ContactPage() {
  return <CompanyPage title="Contact us" description="We are here to help with account questions, support requests, privacy concerns, and partnership enquiries." sections={[
    { title: "Support", body: "For help using HansariaConnect, email support@hfconnect.in with your registered mobile number and a short description of the issue. Never send your password or one-time password." },
    { title: "Privacy requests", body: "For privacy or data requests, email privacy@hfconnect.in. Include enough information for us to identify your request without sending unnecessary personal data." },
    { title: "Business and partnerships", body: "For business enquiries, email partnerships@hfconnect.in. We review partnership proposals that improve communication, access, or safety for our users." },
    { title: "Response times", body: "We aim to acknowledge requests during normal business hours. Response times may vary depending on the complexity and urgency of the request." },
  ]} />;
}