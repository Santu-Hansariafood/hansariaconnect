import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = { title: "About HansariaConnect", description: "Learn about HansariaConnect and its privacy-first communication tools." };

export default function AboutPage() {
  return <CompanyPage title="Communication with more control" description="HansariaConnect is a privacy-first messaging platform for direct conversations, groups, status updates, and secure media sharing." sections={[
    { title: "Our purpose", body: "We want everyday communication to feel simple, dependable, and respectful of the people using it." },
    { title: "What we build", body: "HansariaConnect brings messaging, contacts, groups, status, and account controls into one focused experience across web and mobile devices." },
    { title: "Our principles", body: "We value privacy, clear product behavior, responsible security practices, accessibility, and thoughtful support." },
    { title: "Company contact", body: "For business, partnership, or support enquiries, visit our Contact page or email support@hfconnect.in." },
  ]} />;
}