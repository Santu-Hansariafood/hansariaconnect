import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = {
  title: "HansariaConnect Privacy Policy",
  description:
    "Learn what information HansariaConnect processes, how it is used and protected, and how to make privacy or account deletion requests.",
  alternates: { canonical: "https://hfconnect.in/privacy" },
};

export default function PrivacyPage() {
  return (
    <CompanyPage
      title="Privacy Policy"
      description="This policy explains how HansariaConnect handles information when you use our website and messaging services, the choices available to you, and how to contact us."
      updated="October 28, 2026"
      sections={[
        {
          title: "Information we process",
          body: "The information depends on the features you use and what you choose to provide. It can include:",
          items: [
            "Account details such as your mobile number, name, email, profile, and preferences.",
            "Contacts, group membership, status, and other information you add or choose to sync.",
            "Messages, attachments, and related delivery, seen, reaction, or timestamp information.",
            "Device and session information, such as browser/device details, login time, and IP address, used for account operation and security.",
            "Support messages and information you choose to provide when contacting us.",
            "Information needed to provide an external integration when you choose to connect one.",
          ],
        },
        {
          title: "How we use information",
          body: "We use information to create and authenticate accounts, deliver messages and media, provide contacts and groups, operate the features you request, protect accounts and users, troubleshoot reliability issues, and respond to support or privacy requests.",
        },
        {
          title: "Messages and other people",
          body: "We process messages and media to provide the communication features you use. Information you send is made available to its intended recipients, who may retain, copy, or share it. Deleting your account does not remove copies already received by other people. HansariaConnect does not represent that messages are end-to-end encrypted; avoid sending information that requires that protection.",
        },
        {
          title: "How information is shared",
          body: "We do not sell personal information. Information may be shared with the people and groups you communicate with, with service providers that support hosting, storage, messaging, authentication, or security, and when disclosure is required to comply with law or protect users and the service. Service providers are given information needed for their role.",
        },
        {
          title: "Data protection",
          body: "We use administrative and technical safeguards designed to protect information, including account authentication, restricted operational access, and measures to monitor and address misuse. No internet service or storage system can be guaranteed completely secure, so please protect your account credentials and do not send passwords or one-time codes to anyone.",
        },
        {
          title: "Retention",
          body: "We keep information for as long as needed to provide the service and for legitimate operational, safety, dispute-resolution, and legal purposes. Retention varies by information type and use. Where deletion is requested, information that must be retained for a legal or security purpose may be kept for that limited purpose.",
        },
        {
          title: "Your choices and requests",
          body: "You can update profile details and preferences using available account controls. You may also contact us to ask about access, correction, or deletion of personal information, subject to identity verification and applicable requirements.",
          links: [
            { label: "Request account deletion", href: "/account-deletion" },
            {
              label: "Email the privacy team",
              href: "mailto:privacy@hfconnect.in?subject=HansariaConnect%20privacy%20request",
            },
          ],
        },
        {
          title: "Children",
          body: "HansariaConnect is not intended for children below the minimum age described in our Terms. If you believe a child has provided information inappropriately, contact us so we can review the request.",
        },
        {
          title: "Policy updates and contact",
          body: "We may update this policy as the service or applicable requirements change. The latest version and its update date will be posted here. For privacy questions or requests, email privacy@hfconnect.in.",
        },
      ]}
    />
  );
}
