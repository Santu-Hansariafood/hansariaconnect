import Image from "next/image";

/**
 * Instant route-level loading UI. Next.js swaps this in while the next route
 * segment (and its JS chunk) is still loading, so a navigation never lands on a
 * blank white screen. Colors use the brand tokens so it matches the saved theme
 * on the very first frame.
 */
export default function RootLoading() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-white"
      role="status"
      aria-live="polite"
    >
      <div className="h-[60px] w-full shrink-0 bg-[var(--brand-primary)]" />

      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center">
          <Image
            src="/logo/removebg.png"
            alt="HansariaConnect"
            width={96}
            height={96}
            priority
          />

          <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-black/5">
            <div className="loading-bar h-full w-1/3 rounded-full bg-[var(--brand-primary)]" />
          </div>

          <span className="sr-only">Loading application</span>
        </div>
      </div>
    </div>
  );
}
