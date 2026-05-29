/**
 * Offer detail page — `/orders/offers/[id]`.
 *
 * Server component. Loads via `getOfferDetail()`; uses state-machine
 * predicates from `state.ts` for action affordances. The page never
 * inspects `OfferStatus` directly to decide UI — predicates only.
 *
 * Validates `OfferDetailData` as a contract: every field rendered here
 * comes from that type. If a field is missing or unnecessary, this is
 * the surface that surfaces it.
 *
 * Today the action buttons (Pay now / Cancel offer) link to `/login` as
 * stubs. When real cancel/pay arrive (auth + offers persistence slice),
 * only href + form action change — the visibility logic is already
 * driven by `canBuyerPay()` / `canBuyerCancel()`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { getOfferDetail } from "@/lib/offers/queries";
import { canBuyerCancel, canBuyerPay } from "@/lib/offers/state";
import { OfferStatusBadge } from "@/components/offers/OfferStatusBadge";
import { formatPrice, formatDate } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";

// Time-sensitive content (deadline countdowns); skip route cache.
export const dynamic = "force-dynamic";

interface OfferDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: OfferDetailPageProps): Promise<Metadata> {
  const offer = await getOfferDetail(params.id);
  if (!offer) return { title: "Offer not found — Audiobaaz" };
  return {
    title: `${offer.listing_title} · ${formatPrice(offer.offer_amount)} — My offers`,
  };
}

export default async function OfferDetailPage({ params }: OfferDetailPageProps) {
  const offer = await getOfferDetail(params.id);
  if (!offer) notFound();

  const listingHref = `/listing/${offer.listing_slug ?? offer.listing_id}`;
  const pct = offer.asking_price > 0
    ? Math.round((offer.offer_amount / offer.asking_price) * 100)
    : 0;

  const canPay    = canBuyerPay(offer.status);
  const canCancel = canBuyerCancel(offer.status);
  const now = Date.now();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/orders/offers"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        All offers
      </Link>

      <header className="mb-6 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Your offer
          </h1>
          <OfferStatusBadge status={offer.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          Sent {formatDate(offer.created_at)}
        </p>
      </header>

      {/* Listing card — the thing this offer is on */}
      <Link
        href={listingHref}
        className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {offer.listing_thumbnail ? (
            <Image
              src={offer.listing_thumbnail}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-dim-foreground">
              No photo
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Listing
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {offer.listing_title}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            Asking {formatPrice(offer.asking_price)}
          </p>
        </div>
      </Link>

      {/* Amount summary */}
      <section className="mb-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-dim-foreground">
          Offer amount
        </h2>
        <p className="mt-2 font-mono text-2xl font-semibold text-accent">
          {formatPrice(offer.offer_amount)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {pct}% of asking · {formatPrice(offer.asking_price - offer.offer_amount)} below asking
        </p>
        {!offer.listing_was_negotiable && (
          <p className="mt-3 rounded-md border border-border bg-surface-2 p-3 text-[11px] leading-relaxed text-muted-foreground">
            This listing was fixed-price when you placed this offer.
          </p>
        )}
      </section>

      {/* Buyer's message, if any */}
      {offer.message && (
        <section className="mb-6">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim-foreground">
            Your message to the seller
          </h2>
          <p className="whitespace-pre-line rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-foreground">
            {offer.message}
          </p>
        </section>
      )}

      {/* Deadline / status copy */}
      {offer.expires_at && (offer.status === "pending" || offer.status === "accepted") && (
        <DeadlineBlock
          status={offer.status}
          expiresAt={offer.expires_at}
          now={now}
        />
      )}

      {/* Actions */}
      {(canPay || canCancel) && (
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {canCancel && (
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              Cancel offer
            </Link>
          )}
          {canPay && (
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-black transition-all hover:bg-accent-hover active:scale-[0.99]"
            >
              Pay now
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Deadline block — only renders for active statuses with a deadline
// ─────────────────────────────────────────────────────────────────────────

interface DeadlineBlockProps {
  status:    "pending" | "accepted";
  expiresAt: string;
  now:       number;
}

function DeadlineBlock({ status, expiresAt, now }: DeadlineBlockProps) {
  const ms = new Date(expiresAt).getTime() - now;
  const past = ms <= 0;
  const urgent = !past && ms < 6 * 60 * 60 * 1000;

  const heading = status === "pending"
    ? "Awaiting seller response"
    : "Pay within the window";
  const body = status === "pending"
    ? "The seller has 24 hours from when you sent this offer to accept or decline. If they don't respond in time, the offer expires automatically."
    : "Your offer was accepted. You have 24 hours from acceptance to complete payment, or the offer expires and the listing stays live for other buyers.";

  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        urgent
          ? "border-warning/40 bg-warning/5"
          : past
          ? "border-border bg-surface"
          : "border-border bg-surface"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Clock
          className={cn("h-4 w-4", urgent ? "text-warning" : "text-muted-foreground")}
          aria-hidden
        />
        <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
      <p className={cn(
        "mt-2 font-mono text-xs",
        urgent ? "font-semibold text-warning" : "text-muted-foreground"
      )}>
        {past ? "Window closed" : `${formatRemaining(ms)} left`}
      </p>
    </section>
  );
}

function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) {
    const minutes = totalMinutes - hours * 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
