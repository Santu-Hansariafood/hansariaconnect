import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How HansariaConnect collects, uses, protects, and manages personal information.",
};

export default function PrivacyPage() {
  return <CompanyPage title="Privacy Policy" description="We build HansariaConnect to help people communicate privately and with control over their data." updated="August 19, 2026" sections={[
    { title: "Information we collect", body: "We may collect information needed to provide the service, such as your mobile number, profile details, contacts you choose to save, messages, device information, and security logs." },
    { title: "How we use information", body: "We use information to authenticate accounts, deliver messages, provide contacts and groups, prevent abuse, maintain reliability, and respond to support requests." },
    { title: "Messages and content", body: "Messages and media are processed to deliver the communication you request. Do not share information with a person unless you are comfortable with that person receiving it." },
    { title: "Sharing and service providers", body: "We do not sell personal information. We may use trusted infrastructure and service providers to operate authentication, messaging, storage, communications, and security functions." },
    { title: "Your choices", body: "You can review or update available profile information, manage contacts, and request help with account or privacy questions by contacting our team." },
    { title: "Contact", body: "For privacy questions or requests, email support@hfconnect.in. This policy may be updated as the service changes." },
  ]} />;
}