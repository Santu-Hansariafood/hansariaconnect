import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

type Section = {
  title: string;
  body: string;
  items?: string[];
  links?: { label: string; href: string }[];
};

type CompanyPageProps = {
  title: string;
  description: string;
  eyebrow?: string;
  updated?: string;
  sections: Section[];
  children?: ReactNode;
};

export default function CompanyPage({
  title,
  description,
  eyebrow = "HansariaConnect",
  updated,
  sections,
  children,
}: CompanyPageProps) {
  return (
    <main className="min-h-screen bg-[#f4f8f6] text-[#17211f]">
      <header className="border-b border-white/10 bg-[#073b32] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Image src="/logo/logo.png" alt="HansariaConnect" width={36} height={36} className="rounded-xl" />
            <span>HansariaConnect</span>
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#d3e7df]">
            <Link href="/about" className="transition hover:text-white">About</Link>
            <Link href="/affiliate" className="transition hover:text-white">Affiliate program</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/contact" className="transition hover:text-white">Contact</Link>
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#f2b544] px-4 font-semibold text-[#073b32] transition hover:bg-[#ffd477] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start chatting
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#073b32] via-[#075e54] to-[#11745d] px-6 py-10 text-white shadow-xl shadow-[#0a51451a] sm:px-10 sm:py-14 lg:px-14">
          <div aria-hidden="true" className="absolute -right-20 -top-32 -z-10 h-80 w-80 rounded-full border-[40px] border-white/5" />
          <div aria-hidden="true" className="absolute -bottom-40 right-1/4 -z-10 h-72 w-72 rounded-full bg-[#f2b544]/10 blur-2xl" />
          <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#f2d18a]">
            {eyebrow}
          </p>
          <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#d3e7df] sm:text-lg sm:leading-8">{description}</p>
          {updated && <p className="mt-5 text-sm text-[#b9d7cc]">Last updated: {updated}</p>}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:gap-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-[#dfe9e5] bg-white p-5 shadow-sm shadow-[#0a514508] sm:p-7">
              <h2 className="text-lg font-semibold tracking-tight text-[#123b32] sm:text-xl">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#53635e] sm:text-base">{section.body}</p>
              {section.items && (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <li key={item} className="rounded-xl border border-[#e5efeb] bg-[#f7faf8] px-3 py-3 text-sm leading-6 text-[#3d5b52]">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {section.links && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#075e54] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0a7868] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075e54]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
        {children}
      </article>

      <footer className="border-t border-[#dfe9e5] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-[#71807b] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} HansariaConnect. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/about" className="hover:text-[#075e54]">About</Link>
            <Link href="/affiliate" className="hover:text-[#075e54]">Affiliate Program</Link>
            <Link href="/privacy" className="hover:text-[#075e54]">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#075e54]">Terms</Link>
            <Link href="/account-deletion" className="hover:text-[#075e54]">Account deletion</Link>
            <Link href="/contact" className="hover:text-[#075e54]">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}