"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { ArrowUpRight, Code2, HeartHandshake, MessagesSquare, Palette } from "lucide-react";

const teams = [
  {
    title: "Product & experience",
    description: "Designing approachable, useful ways for people to connect.",
    icon: Palette,
    image: "/logo/removebg.png",
    background: "#d9f0e5",
  },
  {
    title: "Messaging & collaboration",
    description: "Building conversations, groups, and everyday sharing tools.",
    icon: MessagesSquare,
    image: "/logo/logo.png",
    background: "#e8e7ff",
  },
  {
    title: "Engineering & reliability",
    description: "Improving the platform experience across web and mobile.",
    icon: Code2,
    image: "/logo/removebg.png",
    background: "#d9eff5",
  },
  {
    title: "Privacy & user support",
    description: "Helping people understand account choices and get support.",
    icon: HeartHandshake,
    image: "/logo/logo.png",
    background: "#fff0d4",
  },
] as const;

export default function TeamPortfolio() {
  return (
    <section
      aria-labelledby="team-portfolio-title"
      className="mt-8 overflow-hidden rounded-3xl border border-[#dfe9e5] bg-white p-5 shadow-sm sm:p-8 lg:p-10"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f0f7f3] px-3 py-1.5">
            <Image
              src="/logo/removebg.png"
              alt="HansariaConnect logo"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#075e54]">
              The people behind the product
            </span>
          </div>
          <h2
            id="team-portfolio-title"
            className="text-2xl font-semibold tracking-tight text-[#123b32] sm:text-3xl"
          >
            Meet our team
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#53635e] sm:text-base">
            A collaborative team portfolio from Hansaria Food IT. The logos are
            temporary portrait placeholders for these team roles, not photos or
            named employee profiles.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#f2b544] px-5 py-2.5 text-sm font-semibold text-[#073b32] transition hover:bg-[#ffd477] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075e54]"
        >
          Start chatting
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <MotionConfig reducedMotion="user">
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {teams.map(
            ({ title, description, icon: Icon, image, background }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                whileHover={{ y: -5 }}
                className="group overflow-hidden rounded-2xl border border-[#e5efeb] bg-[#f8fbf9] p-3 transition-colors hover:border-[#9ac7b7] hover:bg-white"
              >
                <div
                  className="relative flex aspect-[1.4] items-center justify-center overflow-hidden rounded-xl"
                  style={{ backgroundColor: background }}
                >
                  <Image
                    src={image}
                    alt={`HansariaConnect logo placeholder for ${title}`}
                    width={180}
                    height={180}
                    className="h-36 w-36 object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#075e54] shadow-sm">
                    Team
                  </div>
                  <div className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#075e54] shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="px-2 pb-2 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0a8f76]">
                    Team portfolio
                  </p>
                  <h3 className="mt-1.5 text-lg font-semibold text-[#123b32]">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#53635e]">
                    {description}
                  </p>
                </div>
              </motion.article>
            ),
          )}
        </div>
      </MotionConfig>
    </section>
  );
}
