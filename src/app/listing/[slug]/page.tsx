/**
 * Single listing page — `/listing/<slug>` (also accepts a raw id).
 *
 * Server component. Reads via the `getListingDetail()` access boundary,
 * never the mock files or Supabase directly. View-model construction
 * (excluding server-only fields like `floor_price` and trust scores)
 * happens inside the boundary, not here.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getListingDetail } from "@/lib/listings/detail";
import { formatPrice } from "@/lib/utils/formatting";
import { ConditionBadge } from "@/components/listing/ConditionBadge";
import { PhotoGallery } from "@/components/listing/PhotoGallery";
import { SellerCard } from "@/components/listing/SellerCard";
import { AccessoryList } from "@/components/listing/AccessoryList";

interface ListingPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const listing = await getListingDetail(params.slug);
  if (!listing) {
    return { title: "Listing not found — Audiobaaz" };
  }
  return {
    title:       `${listing.brand} ${listing.product_name} — Audiobaaz`,
    description: listing.condition_notes ?? `${listing.brand} ${listing.product_name} on Audiobaaz`,
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const listing = await getListingDetail(params.slug);
  if (!listing) notFound();

  const altBase = `${listing.brand} ${listing.product_name}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        href="/browse"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to browse
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        {/* Left column — gallery + meta */}
        <div className="flex min-w-0 flex-col gap-8">
          <PhotoGallery photos={listing.photos} alt={altBase} />

          <section>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {listing.brand}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {listing.product_name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ConditionBadge grade={listing.condition_grade} variant="full" size="md" />
              {listing.is_negotiable && (
                <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Negotiable
                </span>
              )}
            </div>
          </section>

          {listing.condition_notes && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim-foreground">
                Condition notes
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {listing.condition_notes}
              </p>
            </section>
          )}

          {listing.known_defects && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim-foreground">
                Known defects
              </h2>
              <p className="whitespace-pre-line rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm leading-relaxed text-foreground">
                {listing.known_defects}
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim-foreground">
              What&apos;s included
            </h2>
            <AccessoryList inclusions={listing.inclusions} />
          </section>
        </div>

        {/* Right column — sticky purchase + seller */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <p className="font-mono text-2xl font-semibold text-accent">
              {formatPrice(listing.asking_price)}
            </p>

            <Link
              href="/login"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-black transition-all hover:bg-accent-hover active:scale-[0.99]"
            >
              Buy now
            </Link>

            {listing.is_negotiable && (
              <Link
                href={`/offer/new/${listing.slug ?? listing.id}`}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-surface text-sm font-medium text-foreground transition-all hover:bg-surface-2"
              >
                Make an offer
              </Link>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Payments are escrow-protected. The seller is paid only after
              you confirm the gear matches the listing.
            </p>
          </div>

          {listing.seller && <SellerCard seller={listing.seller} />}
        </aside>
      </div>
    </div>
  );
}
