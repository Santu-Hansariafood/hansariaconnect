import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, LockKeyhole, Users, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Indian AI-Powered Chat Application | HansariaConnect",
  description:
    "HansariaConnect is an Indian AI-powered chat application created by the Hansaria Food IT team for private messaging, groups, media sharing, and local communities.",
  alternates: { canonical: "https://hfconnect.in" },
  openGraph: {
    title: "HansariaConnect | Indian AI-Powered Chat Application",
    description:
      "Private, practical messaging made in India by the Hansaria Food IT team.",
    url: "https://hfconnect.in",
    type: "website",
  },
};

const features = [
  {
    icon: LockKeyhole,
    title: "Privacy-first conversations",
    text: "Keep direct messages, groups, and shared media in one focused communication space.",
  },
  {
    icon: Users,
    title: "Built for Indian communities",
    text: "Connect with people, teams, families, and local communities from any device.",
  },
  {
    icon: Sparkles,
    title: "AI-powered direction",
    text: "A modern communication platform designed to grow with useful, responsible AI features.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6fbf8] text-[#10231d]">
      <section className="border-b border-[#cfe5dc] bg-[#073b32] text-white">
        <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-7">
          <nav className="flex items-center justify-between" aria-label="Main navigation">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2b544] text-[#073b32]">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              HansariaConnect
            </Link>
            <Link href="/login" className="rounded-full border border-white/40 px-4 py-2 text-sm font-medium transition hover:bg-white/10">
              Sign in
            </Link>
          </nav>

          <div className="grid gap-12 pb-16 pt-20 sm:pb-24 sm:pt-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#f2d18a]">Made in India by Hansaria Food IT</p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                An Indian AI-powered chat application for real conversations.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#d3e7df] sm:text-xl">
                HansariaConnect brings private messaging, groups, contacts, and media sharing together for people and local communities across India.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="rounded-full bg-[#f2b544] px-6 py-3 font-semibold text-[#073b32] transition hover:bg-[#ffd477]">
                  Start chatting
                </Link>
                <Link href="/about" className="rounded-full border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
                  About the team
                </Link>
              </div>
            </div>
            <div className="border-l border-[#5b8b7e] pl-6 lg:justify-self-end lg:max-w-sm">
              <p className="text-2xl font-medium leading-tight text-[#f2d18a]">Local roots. Practical technology. A more connected India.</p>
              <p className="mt-4 leading-7 text-[#b9d7cc]">Created by the Hansaria Food IT team as an independent Indian communication platform.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="features-title">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#11745d]">One app for everyday connection</p>
        <h2 id="features-title" className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">A secure chat experience shaped for how people communicate today.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="border-t-2 border-[#11745d] bg-white p-6 shadow-sm">
              <Icon className="h-7 w-7 text-[#11745d]" aria-hidden="true" />
              <h3 className="mt-6 text-xl font-semibold">{title}</h3>
              <p className="mt-3 leading-7 text-[#4c625b]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[#cfe5dc] bg-[#e5f3ed]" aria-labelledby="india-title">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 id="india-title" className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">A Made-in-India chat platform with a local-first point of view.</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#416058]">HansariaConnect is being developed in India by the Hansaria Food IT team. We are building dependable digital tools for Indian users, businesses, families, and communities while keeping privacy, accessibility, and responsible product development at the centre.</p>
          <Link href="/about" className="mt-7 inline-flex rounded-full bg-[#073b32] px-6 py-3 font-semibold text-white transition hover:bg-[#0d5a4b]">Learn about HansariaConnect</Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-5 py-8 text-sm text-[#4c625b] sm:px-8">
        <span>© {new Date().getFullYear()} HansariaConnect</span>
        <Link href="/privacy" className="hover:text-[#073b32]">Privacy</Link>
        <Link href="/terms" className="hover:text-[#073b32]">Terms</Link>
        <Link href="/contact" className="hover:text-[#073b32]">Contact</Link>
      </footer>
    </main>
  );
}
