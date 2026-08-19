import Link from "next/link";
import Image from "next/image";

type Section = {
  title: string;
  body: string;
  items?: string[];
};

type CompanyPageProps = {
  title: string;
  description: string;
  eyebrow?: string;
  updated?: string;
  sections: Section[];
};

export default function CompanyPage({
  title,
  description,
  eyebrow = "HansariaConnect",
  updated,
  sections,
}: CompanyPageProps) {
  return (
    <main className="min-h-screen bg-[#f7faf9] text-[#17211f]">
      <header className="border-b border-[#dfe9e5] bg-white/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[#075e54]">
            <Image src="/logo/logo.png" alt="HansariaConnect" width={36} height={36} className="rounded-full" />
            <span>HansariaConnect</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm text-[#53635e] sm:gap-5">
            <Link href="/privacy" className="hover:text-[#075e54]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#075e54]">Terms</Link>
            <Link href="/contact" className="hover:text-[#075e54]">Contact</Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="mb-10 border-b border-[#dfe9e5] pb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#0a8f76]">{eyebrow}</p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-[#17211f] sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#53635e] sm:text-lg">{description}</p>
          {updated && <p className="mt-4 text-sm text-[#71807b]">Last updated: {updated}</p>}
        </div>

        <div className="space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-[#17211f]">{section.title}</h2>
              <p className="mt-3 leading-7 text-[#53635e]">{section.body}</p>
              {section.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-[#53635e]">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      <footer className="border-t border-[#dfe9e5] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-[#71807b] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} HansariaConnect. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/about" className="hover:text-[#075e54]">About</Link>
            <Link href="/affiliate" className="hover:text-[#075e54]">Affiliate Program</Link>
            <Link href="/privacy" className="hover:text-[#075e54]">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#075e54]">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}