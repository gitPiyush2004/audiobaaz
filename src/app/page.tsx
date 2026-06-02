import Link from "next/link";

export default function HomePage() {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[140px]"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
        {/* Eyebrow chip */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Managed · Verified · Trusted
        </div>

        <h1 className="font-heading text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-[5rem]">
          Buy &amp; sell{" "}
          <span className="text-accent">audio gear</span>{" "}
          you can trust.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          India&apos;s managed secondhand marketplace for headphones, speakers, DACs,
          amps, and more. Condition-graded, escrow-protected, and
          dispute-backed — so you never have to guess.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/browse"
            className="inline-flex h-12 items-center rounded-xl bg-accent px-8 text-base font-semibold text-black transition-all hover:bg-accent-dark hover:scale-[1.02] active:scale-[0.98]"
          >
            Browse Listings
          </Link>
          <Link
            href="/sell"
            className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-8 text-base font-medium text-foreground transition-all hover:bg-surface-2 hover:border-white/20"
          >
            Sell Your Gear
          </Link>
        </div>
      </div>
    </section>
  );
}
