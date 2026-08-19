import type { Metadata } from "next";
import CompanyPage from "@/components/common/CompanyPage/CompanyPage";

export const metadata: Metadata = {
  title: "About HansariaConnect | Indian Chat Application",
  description:
    "Learn how Hansaria Food Private Limited's IT team is building HansariaConnect, an Indian AI-powered chat application for private and local communication.",
};

export default function AboutPage() {
  return <CompanyPage title="An Indian chat application built by the Hansaria Food IT team" description="HansariaConnect is an AI-powered, privacy-first messaging platform created in India by Hansaria Food Private Limited's IT team for direct conversations, groups, status updates, and secure media sharing." sections={[
    { title: "Our purpose", body: "We are building dependable communication tools for Indian users, businesses, families, and local communities." },
    { title: "What we build", body: "HansariaConnect brings messaging, contacts, groups, status, and account controls into one focused experience across web and Android." },
    { title: "Our technology direction", body: "We are developing a practical AI-powered chat experience with privacy, responsible product design, and useful everyday workflows at its centre." },
    { title: "Company contact", body: "HansariaConnect is created by Hansaria Food Private Limited. For business, partnership, or support enquiries, visit our Contact page or email support@hfconnect.in." },
  ]} />;
}