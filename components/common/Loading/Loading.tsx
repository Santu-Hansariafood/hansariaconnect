import Image from "next/image";

/*
 * Boot screen shown while the app restores the session. Deliberately CSS-only
 * (no JS-driven animation loop) so it paints instantly and costs nothing while
 * the rest of the app is loading. Colors come from the brand tokens that the
 * inline script in app/layout.tsx sets before the first paint.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--brand-secondary) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-6">
        <Image
          src="/logo/removebg.png"
          alt="HansariaConnect"
          width={110}
          height={110}
          priority
          className="h-[110px] w-[110px] object-contain"
        />

        <h1
          className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ color: "var(--brand-primary)" }}
        >
          HansariaConnect
        </h1>

        <p className="mt-1.5 text-center text-[13px] text-gray-500 sm:text-sm">
          Private messaging, made in India
        </p>

        <div className="mt-8 h-1 w-56 overflow-hidden rounded-full bg-black/5">
          <div
            className="loading-bar h-full w-1/3 rounded-full"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
        </div>

        <span className="sr-only">Loading HansariaConnect…</span>
      </div>
    </div>
  );
}
