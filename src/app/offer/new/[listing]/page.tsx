/**
 * Offer composition page — `/offer/new/[listing]`.
 *
 * Server component. Loads the listing through the existing
 * `getListingDetail()` access boundary; loads the negotiation range
 * through the new `getOfferRange()` access boundary. UI never inspects
 * `listing.floor_price` (it is not on the view-model anyway) and never
 * reads the URL shape directly — `parseOfferDraftFromSearchParams()` is
 * the helper that decodes the in-flight draft.
 *
 * SKELETON — locks the navigation contract for offer flow without
 * implementing real submission, auth, or persistence:
 *
 *   /listing/[slug]
 *     ↓ Make an offer
 *   /offer/new/[listing]
 *     ↓ choose amount → Continue
 *   /login?redirect=/offer/new/[listing]&offer=<paise>
 *
 * The `?offer=` carrier is intentional and replaceable: a future slice
 * will persist the draft server-side and pass `?draft=<id>` instead.
 * Call sites use `buildOfferAuthRedirect()` so that swap is one place.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getListingDetail } from "@/lib/listings/detail";
import {
  buildOfferAuthRedirect,
  getOfferRange,
  parseOfferDraftFromSearchParams,
  validateOfferAmount,
} from "@/lib/offers/draft";
import { ConditionBadge } from "@/components/listing/ConditionBadge";
import { OfferAmountInput } from "@/components/offers/OfferAmountInput";
import { formatPrice } from "@/lib/utils/formatting";

interface OfferPageProps {
  params:       { listing: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export async function generateMetadata({ params }: OfferPageProps): Promise<Metadata> {
  const listing = await getListingDetail(params.listing);
  if (!listing) return { title: "Listing not found — Audiobaaz" };
  return {
    title: `Make an offer · ${listing.brand} ${listing.product_name} — Audiobaaz`,
  };
}

export default async function OfferPage({ params, searchParams }: OfferPageProps) {
  const listing = await getListingDetail(params.listing);
  if (!listing) notFound();

  const backToListing = `/listing/${listing.slug ?? listing.id}`;

  // Branch 1: listing exists but seller doesn't accept offers.
  // Render a product-correct "offers unavailable" surface — never 404.
  if (!listing.is_negotiable) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={backToListing}
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to listing
        </Link>

        <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {listing.brand}
            </p>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {listing.product_name}
            </h1>
            <div className="mt-2">
              <ConditionBadge grade={listing.condition_grade} variant="full" size="sm" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <h2 className="text-sm font-semibold text-foreground">
              Offers unavailable for this listing
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The seller has listed this item as fixed-price only.
            </p>
            <p className="mt-3 font-mono text-base font-semibold text-accent">
              {formatPrice(listing.asking_price)}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-black transition-all hover:bg-accent-hover active:scale-[0.99]"
            >
              Buy now
            </Link>
            <Link
              href={backToListing}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-surface text-sm font-medium text-foreground transition-all hover:bg-surface-2"
            >
              View listing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Branch 2: listing accepts offers. Render the composition form.
  // Lift to a stable const so TS narrowing survives into the server-action closure.
  const negotiableListing = listing;
  const range = await getOfferRange({
    listingId:   negotiableListing.id,
    askingPrice: negotiableListing.asking_price,
  });

  // Hydrate any in-flight draft from the URL (e.g. coming back from auth).
  // Done through the helper so the URL carrier shape can change without
  // touching this page.
  const existingDraft = parseOfferDraftFromSearchParams(searchParams, negotiableListing.id);

  /**
   * Server action that handles "Continue" on the offer form.
   *
   * Skeleton behaviour: validate the amount, build the auth-redirect URL
   * via `buildOfferAuthRedirect()`, redirect. No DB writes, no offers
   * table touch, no auth check. The redirect SHAPE is what we're locking
   * in this slice — a future implementation replaces the body of this
   * action with real persistence, but the call sites stay the same.
   */
  async function continueAction(formData: FormData) {
    "use server";

    const raw = formData.get("offer");
    const amount = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;

    // Re-validate server-side. `validateOfferAmount` is the same rule
    // applied by the client UI — never trust the form value alone.
    const error = validateOfferAmount(amount, range);
    if (error) {
      // Skeleton: re-render the page with the existing URL state.
      // A future slice can surface the error inline via a result tuple.
      redirect(`/offer/new/${negotiableListing.id}?offer=${Math.max(amount || 0, 0)}`);
    }

    redirect(
      buildOfferAuthRedirect({
        listing_id:   negotiableListing.id,
        offer_amount: amount,
      })
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={backToListing}
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to listing
      </Link>

      <header className="mb-8 flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {listing.brand}
        </p>
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Make an offer · {listing.product_name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConditionBadge grade={listing.condition_grade} variant="full" size="sm" />
          <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Negotiable
          </span>
        </div>
      </header>

      <form action={continueAction} className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6">
        <OfferAmountInput
          range={range}
          defaultValue={existingDraft?.offer_amount}
        />

        <p className="text-xs leading-relaxed text-muted-foreground">
          The seller has 24 hours to accept or decline. If they accept,
          you&apos;ll have a 24-hour window to pay. Payments are
          escrow-protected and the seller is paid only after you confirm
          the gear matches the listing.
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href={backToListing}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium text-foreground transition-all hover:bg-surface-2"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-black transition-all hover:bg-accent-hover active:scale-[0.99]"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
