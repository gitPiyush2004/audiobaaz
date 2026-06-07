/**
 * Buyer offer dashboard — projection + access boundary.
 *
 * This file owns the SHAPE of the dashboard's data (`BuyerOfferRow`) and
 * the function that produces it (`getMyOffers`). The shape is intentionally
 * separate from `OfferSummary`:
 *
 *   OfferSummary    = offer-domain object — what an offer IS
 *   BuyerOfferRow   = dashboard projection — what one ROW shows
 *
 * Domain objects describe the system's nouns; projections describe a
 * specific surface's needs. Mixing them produces a slowly-growing blob
 * (display fields creeping into domain types, domain fields leaking into
 * UI types). Same separation pattern already used elsewhere in this repo:
 *
 *   Listing           ↔ ListingCardData / ListingDetailData
 *   User              ↔ SellerCardData
 *   OfferSummary      ↔ BuyerOfferRow      (this file)
 *
 * View-models are intentionally lossy. Server-only fields (floor_price,
 * auto_accept_threshold, scores, contact data, internal moderation flags)
 * cannot appear in any type below.
 *
 * Today: mock-backed via `mockOffers`. Future: same signature, replace the
 * body with a Supabase query that joins `offers` to `listings`. Call sites
 * (the dashboard page, future detail page) keep their imports unchanged.
 */

import type { OfferStatus, OfferSummary } from "@/lib/offers/types";
import { isTerminal } from "@/lib/offers/state";
import { mockOffers } from "@/lib/mock/offers";

// ─────────────────────────────────────────────────────────────────────────
// Projection shape — what one dashboard row shows
// ─────────────────────────────────────────────────────────────────────────

/**
 * Single row in the buyer's offer dashboard.
 *
 * Fields are exactly what the row component renders. Anything the row
 * doesn't render does NOT belong here. If the future detail page needs
 * the buyer's optional message, that's `OfferDetailData`'s problem, not
 * this projection's.
 *
 * Source mapping (DB → projection):
 *   id                   ← offers.id
 *   listing_href         ← derived: `/listing/${slug ?? id}` — public slug
 *                          URL preferred per the slug-vs-id rule
 *                          (see ListingCardData.slug doc).
 *   listing_title        ← `${listings.brand} ${listings.product_name}`
 *   listing_thumbnail    ← listings.photos[0]
 *   offer_amount         ← offers.offer_amount        (PAISE)
 *   asking_price         ← listings.asking_price       (PAISE)
 *   offer_pct_of_asking  ← derived rounded percentage
 *   status               ← offers.status
 *   created_at           ← offers.created_at
 *   expires_at           ← offers.expires_at  (semantics depend on status —
 *                          see OfferSummary.expires_at)
 */
export interface BuyerOfferRow {
  id:                  string;
  /** Pre-built href so the row component doesn't recompute slug-vs-id. */
  listing_href:        string;
  listing_title:       string;
  listing_thumbnail?:  string;
  /** Offer amount in PAISE. */
  offer_amount:        number;
  /** Listing asking price in PAISE — for the "X% of asking" display only. */
  asking_price:        number;
  /** 0–100 integer; `Math.round(offer_amount / asking_price * 100)`. */
  offer_pct_of_asking: number;
  status:              OfferStatus;
  created_at:          string;
  expires_at?:         string;
}

// ─────────────────────────────────────────────────────────────────────────
// Bucketed view — three sections the dashboard renders
// ─────────────────────────────────────────────────────────────────────────

/**
 * The dashboard renders three sections, each driven by one of these
 * predicates (defined in `state.ts` — single source of truth):
 *   - awaiting_seller : status === "pending"
 *   - action_needed   : status === "accepted"  (buyer must pay)
 *   - history         : isTerminal(status)
 *
 * Returning the bucketed shape from `getMyOffers()` keeps the page
 * component dumb — no filter logic in the JSX. If the bucketing rule
 * changes (e.g. splitting `accepted` from a future intermediate state),
 * the UI doesn't move.
 */
export interface BuyerOfferDashboardData {
  awaiting_seller: BuyerOfferRow[];
  action_needed:   BuyerOfferRow[];
  history:         BuyerOfferRow[];
}

// ─────────────────────────────────────────────────────────────────────────
// Boundary
// ─────────────────────────────────────────────────────────────────────────

export interface GetMyOffersFilters {
  /**
   * Optional cap on the history section size — paid/declined/expired/
   * cancelled rows that pile up over time. Active sections always render
   * in full.
   */
  historyLimit?: number;
}

/**
 * Fetch the authenticated buyer's offers for the dashboard.
 *
 * Today: returns the mock fixtures projected into `BuyerOfferRow`.
 * Tomorrow: same signature, body replaced with a Supabase query that
 *   1) selects `offers WHERE buyer_id = auth.uid()`,
 *   2) joins to `listings` for title/photo/asking,
 *   3) projects to BuyerOfferRow exactly the way `toRow()` does below.
 *
 * The "auth.uid()" piece arrives with the auth slice; this function
 * doesn't take a `userId` parameter because the boundary will read it
 * from the server-side session, not from the caller. Callers must NOT
 * thread userId through — that would be a leak of auth concerns into
 * pages.
 */
export async function getMyOffers(
  filters: GetMyOffersFilters = {}
): Promise<BuyerOfferDashboardData> {
  // Newest-first within each section so the most recent activity is
  // visible without scrolling. Stable sort across sections via created_at.
  const sorted = [...mockOffers].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  const awaiting_seller: BuyerOfferRow[] = [];
  const action_needed:   BuyerOfferRow[] = [];
  const history:         BuyerOfferRow[] = [];

  for (const offer of sorted) {
    const row = toRow(offer);
    if (offer.status === "pending") {
      awaiting_seller.push(row);
    } else if (offer.status === "accepted") {
      action_needed.push(row);
    } else if (isTerminal(offer.status)) {
      history.push(row);
    }
    // Any future non-terminal status that isn't pending/accepted falls
    // through silently here; the state machine is responsible for
    // ensuring all reachable statuses are categorised.
  }

  const cappedHistory =
    typeof filters.historyLimit === "number"
      ? history.slice(0, filters.historyLimit)
      : history;

  return {
    awaiting_seller,
    action_needed,
    history: cappedHistory,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Internal projection
// ─────────────────────────────────────────────────────────────────────────

/**
 * Project an `OfferSummary` into a `BuyerOfferRow`. Pure function — no
 * I/O, no React. The future Supabase impl will inline the equivalent
 * mapping over a joined query result; same shape, same rules.
 *
 * The `listing_href` calculation lives here so the page never has to
 * decide between slug and id. Public navigation paths use slug per the
 * canonical rule on `ListingCardData.slug`.
 */
function toRow(offer: OfferSummary): BuyerOfferRow {
  const slug = offer.listing_slug ?? offer.listing_id;
  const pct = offer.asking_price > 0
    ? Math.round((offer.offer_amount / offer.asking_price) * 100)
    : 0;

  return {
    id:                  offer.id,
    listing_href:        `/listing/${slug}`,
    listing_title:       offer.listing_title,
    listing_thumbnail:   offer.listing_thumbnail,
    offer_amount:        offer.offer_amount,
    asking_price:        offer.asking_price,
    offer_pct_of_asking: pct,
    status:              offer.status,
    created_at:          offer.created_at,
    expires_at:          offer.expires_at,
  };
}
