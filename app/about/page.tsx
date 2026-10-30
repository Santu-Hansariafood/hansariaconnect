import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";
import TeamPortfolio from "@/components/common/CompanyPage/TeamPortfolio";

export const metadata: Metadata = {
  title: "About HansariaConnect: Our Team and Mission",
  description:
    "Meet HansariaConnect's mission and team portfolio: product design, messaging technology, platform reliability, and privacy-led support, built in India.",
  alternates: { canonical: "https://hfconnect.in/about" },
};

export default function AboutPage() {
  return (
    <CompanyPage
      title="A communication platform built around people and communities"
      description="HansariaConnect is an Indian messaging service created by Hansaria Food Private Limited. We bring direct conversations, groups, contacts, status updates, and media sharing together in one practical experience."
      sections={[
        {
          title: "Our purpose",
          body: "We are building useful, dependable communication tools for people, families, businesses, and local communities. Our product direction is guided by accessibility, clear product choices, and respect for the people who use the service.",
        },
        {
          title: "What we build",
          body: "HansariaConnect brings messaging, contacts, groups, status, and account controls into a focused experience across web and Android. We develop features iteratively and describe capabilities as they become available.",
        },
        {
          title: "Responsible technology",
          body: "We aim to use technology, including AI where applicable, to improve practical communication workflows. We do not describe the service as end-to-end encrypted; please review our Privacy Policy for how account information and communications are handled.",
        },
        {
          title: "Company and contact",
          body: "HansariaConnect is created by Hansaria Food Private Limited. For user support, business, or partnership enquiries, visit our Contact page.",
          links: [
            { label: "Contact our team", href: "/contact" },
            { label: "Read our privacy policy", href: "/privacy" },
          ],
        },
      ]}
    >
      <TeamPortfolio />
    </CompanyPage>
  );
}