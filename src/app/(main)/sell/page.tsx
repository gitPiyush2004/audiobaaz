import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sell Your Gear — Audiobaaz",
  description:
    "List your secondhand audio gear on India's managed marketplace. Admin-verified, escrow-protected, Telegram-notified.",
};

const steps = [
  {
    n: "01",
    title: "Create your listing",
    body: "Walk through our 6-step guided form — product, condition grade, inclusions, photos, and price. Takes about 10 minutes.",
  },
  {
    n: "02",
    title: "Admin review",
    body: "We verify your listing for accuracy and completeness. Most reviews finish in 2–4 hours between 9 am and 9 pm IST.",
  },
  {
    n: "03",
    title: "Go live",
    body: "Your listing appears in the marketplace. Buyers can save it, make offers, and start negotiations.",
  },
  {
    n: "04",
    title: "Accept an offer",
    body: "You get notified on Telegram the moment an offer arrives. Accept or decline — no pressure. Parallel negotiations are fine; first buyer to pay wins.",
  },
  {
    n: "05",
    title: "Ship and get paid",
    body: "Record a short packing video, hand off the package to the courier, and we hold payment in escrow until delivery. After the 48-hour inspection window closes, the payout lands in your UPI.",
  },
];

const guarantees = [
  {
    title: "Escrow protection",
    body: "Funds are collected before the buyer receives the gear. You are never left waiting for payment.",
  },
  {
    title: "Dispute support",
    body: "If a buyer raises a dispute, our team arbitrates and protects you against false claims.",
  },
  {
    title: "Telegram notifications",
    body: "Every offer, payment, and shipping update lands directly in your Telegram — no app to install.",
  },
  {
    title: "48-hour inspection window",
    body: "Buyers have 48 hours to raise a concern. After that, escrow auto-releases to you — no action needed on your end.",
  },
];

const timeline = [
  { label: "Submit listing", time: "Day 0" },
  { label: "Admin review", time: "2–4 hrs" },
  { label: "Go live", time: "Same day" },
  { label: "Buyer inspection", time: "48 hrs" },
  { label: "UPI payout", time: "After inspection" },
];

export default function SellPage() {
  return (
    <div className="min-h-screen bg-bg">

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/5 blur-[120px]"
        />

        <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            10% fee only when you sell
          </div>

          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[4rem]">
            Sell your gear to people
            <br className="hidden sm:block" />
            who actually{" "}
            <span className="text-accent">care.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Audiobaaz is India&apos;s managed secondhand audio marketplace. We verify
            every listing, protect every transaction, and handle the back-and-forth
            so you can focus on finding the right buyer.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/sell/new"
              className="inline-flex h-12 items-center rounded-xl bg-accent px-8 text-base font-semibold text-black transition-all hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98]"
            >
              Start a Listing
            </Link>
            <Link
              href="/browse"
              className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-8 text-base font-medium text-foreground transition-all hover:bg-surface-2 hover:border-border-2"
            >
              Browse the marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          How it works
        </h2>
        <p className="mt-2 text-muted-foreground">
          Five steps from listing to payout.
        </p>

        <ol className="mt-12 divide-y divide-border">
          {steps.map(({ n, title, body }) => (
            <li key={n} className="flex gap-6 py-8 sm:gap-10">
              <span className="w-12 shrink-0 font-mono text-2xl font-bold text-accent sm:w-16 sm:text-3xl">
                {n}
              </span>
              <div>
                <h3 className="font-heading text-lg font-semibold text-foreground sm:text-xl">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Fee breakdown ───────────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-sm">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                One simple fee.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                We charge{" "}
                <span className="font-semibold text-foreground">10%</span> when
                your gear sells. No listing fees. No subscription. No fine print.
                If it does not sell, you pay nothing.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-2 p-6 sm:min-w-[280px]">
              <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Example payout
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Your listing price
                  </span>
                  <span className="font-mono text-sm text-foreground">
                    ₹10,000
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Platform fee (10%)
                  </span>
                  <span className="font-mono text-sm text-error">− ₹1,000</span>
                </div>
                <div className="my-2 border-t border-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    You receive
                  </span>
                  <span className="font-mono text-lg font-bold text-accent">
                    ₹9,000
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Seller guarantee ────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          We&apos;ve got your back.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Audiobaaz manages the hard parts so you don&apos;t have to.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {guarantees.map(({ title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-2"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Timeline ────────────────────────────────────── */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What to expect, and when.
          </h2>

          <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:gap-0">
            {timeline.map(({ label, time }, i) => (
              <div
                key={label}
                className="flex items-start gap-4 sm:flex-1 sm:flex-col sm:gap-0"
              >
                <div className="flex w-full items-center">
                  <div className="h-3 w-3 shrink-0 rounded-full border-2 border-accent bg-bg" />
                  {i < timeline.length - 1 && (
                    <div className="hidden h-px flex-1 bg-border sm:block" />
                  )}
                </div>
                <div className="sm:mt-3 sm:pr-4">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{time}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-xs text-muted-foreground">
            Reviews happen between 9 am and 9 pm IST. Listings submitted outside
            those hours are reviewed the following morning.
          </p>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 translate-y-1/3 rounded-full bg-accent/5 blur-[120px]"
        />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to find your gear a{" "}
            <span className="text-accent">new home?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            It takes about 10 minutes to create a listing. We&apos;ll take it from
            there.
          </p>
          <Link
            href="/sell/new"
            className="mt-8 inline-flex h-12 items-center rounded-xl bg-accent px-10 text-base font-semibold text-black transition-all hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Listing
          </Link>
        </div>
      </section>

    </div>
  );
}
