export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getBrowseListings } from "@/lib/listings/browse";
import { ListingCard } from "@/components/listing/ListingCard";
import { ListingGrid } from "@/components/listing/ListingGrid";

export default async function HomePage() {
  // Validate the access boundary in two places by consuming it from the
  // homepage. Featured = newest 4 across all categories.
  const featured = await getBrowseListings({ sort: "newest", limit: 4 });

  return (
    <>
      <section className="relative flex items-center justify-center overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/3 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[140px]"
        />

        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
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
            amps, and more. Condition-graded, escrow-protected, and dispute-backed
            — so you never have to guess.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/browse"
              className="inline-flex h-12 items-center rounded-xl bg-accent px-8 text-base font-semibold text-black transition-all hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98]"
            >
              Browse Listings
            </Link>
            <Link
              href="/sell"
              className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-8 text-base font-medium text-foreground transition-all hover:bg-surface-2 hover:border-border-2"
            >
              Sell Your Gear
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Latest listings
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fresh gear, just listed.
            </p>
          </div>
          <Link
            href="/browse"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            See all
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </header>

        <ListingGrid>
          {featured.map((l, i) => (
            <ListingCard key={l.id} listing={l} priority={i < 2} />
          ))}
        </ListingGrid>
      </section>
    </>
  );
}
