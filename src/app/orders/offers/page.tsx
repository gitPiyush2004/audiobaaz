/**
 * Buyer offer dashboard — `/orders/offers`.
 *
 * Server component. Loads bucketed dashboard data via `getMyOffers()`;
 * action affordances driven by the state-machine predicates from
 * `state.ts`. UI never reads `OfferStatus` directly to decide what's
 * actionable — it asks the predicates.
 *
 * Today the dashboard is unauthenticated mock data. The auth-gate slice
 * will wrap this route in middleware; nothing on this page changes when
 * that happens because `getMyOffers()` already takes no userId parameter
 * (it'll read auth.uid() server-side later — see dashboard.ts).
 *
 * The action buttons (Pay now / Cancel offer) link to `/login` as stubs.
 * They're rendered from `canBuyerPay()` / `canBuyerCancel()`, so when
 * real cancel/pay flows arrive, only the href and form action change —
 * the visibility logic is already correct.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Clock, Inbox } from "lucide-react";
import { getMyOffers, type BuyerOfferRow } from "@/lib/offers/dashboard";
import { canBuyerCancel, canBuyerPay } from "@/lib/offers/state";
import { OfferStatusBadge } from "@/components/offers/OfferStatusBadge";
import { formatPrice, formatDate } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";

// Time-sensitive content (deadline countdowns); skip route cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My offers — Audiobaaz",
};

const HISTORY_LIMIT = 25;

export default async function OffersDashboardPage() {
  const data = await getMyOffers({ historyLimit: HISTORY_LIMIT });
  const now = Date.now();

  const hasAny =
    data.awaiting_seller.length > 0 ||
    data.action_needed.length > 0 ||
    data.history.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          My offers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Offers you&apos;ve made, grouped by what needs your attention.
        </p>
      </header>

      {!hasAny && <DashboardEmptyState />}

      {data.action_needed.length > 0 && (
        <Section
          title="Action needed"
          subtitle="Your offer was accepted — pay within the window or it expires."
          tone="warning"
        >
          {data.action_needed.map((row) => (
            <OfferCard key={row.id} row={row} now={now} />
          ))}
        </Section>
      )}

      {data.awaiting_seller.length > 0 && (
        <Section
          title="Awaiting response"
          subtitle="The seller has 24 hours to accept or decline."
        >
          {data.awaiting_seller.map((row) => (
            <OfferCard key={row.id} row={row} now={now} />
          ))}
        </Section>
      )}

      {data.history.length > 0 && (
        <Section
          title="History"
          subtitle="Resolved offers — paid, declined, expired, or cancelled."
        >
          {data.history.map((row) => (
            <OfferCard key={row.id} row={row} now={now} />
          ))}
        </Section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────

interface SectionProps {
  title:    string;
  subtitle: string;
  tone?:    "warning";
  children: React.ReactNode;
}

function Section({ title, subtitle, tone, children }: SectionProps) {
  return (
    <section className="mb-8 last:mb-0">
      <div
        className={cn(
          "mb-3 flex flex-col gap-0.5",
          tone === "warning" && "border-l-2 border-warning pl-3"
        )}
      >
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Single offer row
// ─────────────────────────────────────────────────────────────────────────

interface OfferCardProps {
  row: BuyerOfferRow;
  now: number;
}

function OfferCard({ row, now }: OfferCardProps) {
  const canPay    = canBuyerPay(row.status);
  const canCancel = canBuyerCancel(row.status);
  const offerHref = `/orders/offers/${row.id}`;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-stretch">
      {/* Thumbnail — links to the listing (the gear), not the offer detail */}
      <Link
        href={row.listing_href}
        className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:aspect-square sm:h-24 sm:w-24"
        aria-label={`View ${row.listing_title}`}
      >
        {row.listing_thumbnail ? (
          <Image
            src={row.listing_thumbnail}
            alt=""
            fill
            sizes="(min-width: 640px) 96px, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-dim-foreground">
            No photo
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            href={offerHref}
            className="min-w-0 truncate text-sm font-semibold text-foreground hover:text-accent"
          >
            {row.listing_title}
          </Link>
          <OfferStatusBadge status={row.status} />
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="font-mono font-semibold text-accent">
            {formatPrice(row.offer_amount)}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.offer_pct_of_asking}% of asking ({formatPrice(row.asking_price)})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>Sent {formatDate(row.created_at)}</span>
          {row.expires_at && (
            <DeadlineLabel expiresAt={row.expires_at} now={now} status={row.status} />
          )}
        </div>

        {(canPay || canCancel) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {canPay && (
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-semibold text-black transition-all hover:bg-accent-hover active:scale-[0.98]"
              >
                Pay now
              </Link>
            )}
            {canCancel && (
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                Cancel offer
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Chevron — opens the offer detail page */}
      <Link
        href={offerHref}
        aria-label="View offer details"
        className="hidden self-center text-dim-foreground transition-colors hover:text-muted-foreground sm:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </Link>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Deadline label
// ─────────────────────────────────────────────────────────────────────────

interface DeadlineLabelProps {
  expiresAt: string;
  now:       number;
  status:    BuyerOfferRow["status"];
}

function DeadlineLabel({ expiresAt, now, status }: DeadlineLabelProps) {
  const ms = new Date(expiresAt).getTime() - now;

  // For terminal statuses we don't render this at all (caller filters
  // via `expires_at` presence, but defensive guard here too).
  if (status !== "pending" && status !== "accepted") return null;

  const past = ms <= 0;
  const display = past ? "Expired" : formatRemaining(ms);
  const urgent = !past && ms < 6 * 60 * 60 * 1000;

  return (
    <span
      className={cn(
        "flex items-center gap-1",
        urgent ? "text-warning" : past ? "text-muted-foreground" : undefined
      )}
    >
      <Clock className="h-3 w-3" aria-hidden />
      {past ? display : `${display} left`}
    </span>
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

// ─────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────

function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      <Inbox className="h-6 w-6 text-dim-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">No offers yet</p>
        <p className="text-xs text-muted-foreground">
          Find something you like and make an offer — we&apos;ll track it here.
        </p>
      </div>
      <Link
        href="/browse"
        className="mt-2 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-black transition-all hover:bg-accent-hover active:scale-[0.98]"
      >
        Browse listings
      </Link>
    </div>
  );
}
