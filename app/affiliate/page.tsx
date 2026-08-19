import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = { title: "Affiliate Program", description: "Learn about the HansariaConnect affiliate and referral program." };

export default function AffiliatePage() {
  return <CompanyPage title="HansariaConnect Affiliate Program" eyebrow="Partnerships" description="Help people discover a simpler, privacy-first way to stay connected." sections={[
    { title: "Who can apply", body: "Creators, communities, publishers, educators, and businesses with an audience interested in communication and privacy may apply." },
    { title: "How it works", body: "Approved partners receive campaign guidance and a referral arrangement described in their partner agreement. Program availability, eligibility, and rates may vary." },
    { title: "Partner standards", body: "Partners must use honest descriptions, clearly disclose commercial relationships, respect user privacy, and follow applicable advertising and platform rules.", items: ["Do not make promises about security or features that HansariaConnect has not published.", "Do not use spam, misleading claims, impersonation, or forced downloads.", "Do not purchase ads against HansariaConnect trademarks without written approval."] },
    { title: "Apply", body: "Send your name, audience or organization details, channels, and partnership idea to partnerships@hfconnect.in. We will review submissions and reply if there is a suitable opportunity." },
  ]} />;
}