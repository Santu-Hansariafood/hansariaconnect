import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = {
  title: "Affiliate Program | HansariaConnect",
  description:
    "Learn who can apply to the HansariaConnect affiliate program and the transparency, privacy, and advertising standards expected of partners.",
  alternates: { canonical: "https://hfconnect.in/affiliate" },
};

export default function AffiliatePage() {
  return (
    <CompanyPage
      title="Build responsible partnerships with HansariaConnect"
      eyebrow="Partnerships"
      description="We welcome thoughtful collaborations that help people discover practical communication tools. Our affiliate program is subject to review, availability, and a written partner agreement."
      sections={[
        {
          title: "Who can apply",
          body: "Creators, community groups, publishers, educators, and businesses may submit a proposal if their audience and channels are relevant to communication, technology, or local communities.",
        },
        {
          title: "Review and participation",
          body: "Send us your proposal for review. If we see a suitable opportunity, we will discuss eligibility, approved materials, referral attribution, and any compensation in a written agreement before a campaign begins. Applying does not guarantee acceptance or earnings.",
        },
        {
          title: "Partner standards",
          body: "Partners must follow applicable laws, advertising rules, platform terms, and any written program requirements.",
          items: [
            "Clearly disclose a paid, sponsored, or commission-based relationship.",
            "Describe product capabilities accurately; do not make unsupported security, privacy, or performance claims.",
            "Do not use spam, deceptive promotions, impersonation, or forced downloads.",
            "Respect user privacy and collect only information needed for the agreed campaign.",
            "Do not bid on HansariaConnect trademarks or use our brand assets outside approved guidance.",
          ],
        },
        {
          title: "Apply",
          body: "Email your name or organization, audience, promotional channels, and a short partnership proposal. Please do not include sensitive personal information in your first message.",
          links: [
            {
              label: "Email partnerships",
              href: "mailto:partnerships@hfconnect.in?subject=HansariaConnect%20partnership%20proposal",
            },
          ],
        },
      ]}
    />
  );
}