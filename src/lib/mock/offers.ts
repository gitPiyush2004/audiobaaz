/**
 * Mock offer fixtures. Stored shape is `MockOffer` — `OfferSummary` plus
 * the detail-only fields (`message`, `listing_was_negotiable`) so a single
 * fixture array drives both the dashboard and the offer detail page.
 *
 * The dashboard's `getMyOffers()` reads only the OfferSummary subset and
 * projects to `BuyerOfferRow`. The detail page's `getOfferDetail()` reads
 * the full row and projects to `OfferDetailData`. Each access function is
 * responsible for narrowing — fixtures don't enforce.
 *
 * Designed to exercise every branch:
 *   - one `pending` close to the seller-response deadline
 *   - one `pending` with plenty of time left
 *   - one `accepted` with hours remaining on the buyer-payment deadline
 *   - one `paid`         (terminal — success)
 *   - one `declined`     (terminal — seller said no)
 *   - one `expired`      (terminal — timed out)
 *   - one `cancelled`    (terminal — buyer retracted)
 *   - one without `listing_thumbnail` so the row's no-photo path renders
 *   - one without `listing_slug` so id-based fallback links exercise
 *   - one with `message` populated so the detail page exercises that field
 *   - one with `listing_was_negotiable: false` so the detail page
 *     exercises the "seller doesn't usually accept offers" footnote
 *
 * Timestamps are computed relative to `MOCK_NOW` so the "time remaining"
 * displays are always realistic regardless of when dev is running.
 * Replace the implementations in `src/lib/offers/dashboard.ts` and
 * `src/lib/offers/queries.ts` — not the call sites — when the offers
 * table comes online.
 */

import type { OfferSummary } from "@/lib/offers/types";

/**
 * Storage shape for the mock array. Carries the union of fields used by
 * any offers access function. Each access function projects down to its
 * own view-model.
 */
export interface MockOffer extends OfferSummary {
  /** Optional buyer message — surfaces on `OfferDetailData`. */
  message?: string;
  /**
   * Snapshot of the listing's `is_negotiable` flag at the time the offer
   * was placed. Listings can be flipped between negotiable and fixed-
   * price by the seller; we store the value at offer-creation time so
   * the buyer's history reflects the listing as it was when they acted.
   * Surfaces on `OfferDetailData.listing_was_negotiable`.
   */
  listing_was_negotiable: boolean;
}

/**
 * Anchor "now" for fixture timestamps. Slightly in the past so that
 * `expires_at` for active statuses lands plausibly in the future.
 */
const MOCK_NOW = Date.now();

const HOUR = 60 * 60 * 1000;

const t = (offsetMs: number): string =>
  new Date(MOCK_NOW + offsetMs).toISOString();

export const mockOffers: MockOffer[] = [
  // pending — close to seller-response deadline (3 hours left)
  {
    id:                "mock-offer-aa11bb22",
    listing_id:        "lst-001",
    listing_slug:      "moondrop-blessing-3-7421",
    listing_title:     "Moondrop Blessing 3",
    listing_thumbnail: "https://picsum.photos/seed/blessing3-0/400/300",
    offer_amount:      1900000, // ₹19,000
    asking_price:      2200000, // ₹22,000
    status:            "pending",
    created_at:        t(-21 * HOUR),
    expires_at:        t(3 * HOUR),
    message:           "Hi! Picking up my first set of mid-range IEMs and these are top of my list. Can do ₹19k cash if you're flexible.",
    listing_was_negotiable: true,
  },
  // pending — fresh, ~22 hours remaining
  {
    id:                "mock-offer-cc33dd44",
    listing_id:        "lst-005",
    listing_slug:      "ifi-zen-can-3318",
    listing_title:     "iFi ZEN CAN Signature 6XX",
    listing_thumbnail: "https://picsum.photos/seed/zencan-0/400/300",
    offer_amount:      1500000, // ₹15,000
    asking_price:      1850000, // ₹18,500
    status:            "pending",
    created_at:        t(-2 * HOUR),
    expires_at:        t(22 * HOUR),
    listing_was_negotiable: true,
  },
  // accepted — buyer must pay; ~6 hours of payment window left
  {
    id:                "mock-offer-ee55ff66",
    listing_id:        "lst-002",
    listing_slug:      "sennheiser-hd-660s2-3914",
    listing_title:     "Sennheiser HD 660S2",
    listing_thumbnail: "https://picsum.photos/seed/hd660s2-0/400/300",
    offer_amount:      3400000, // ₹34,000
    asking_price:      3800000, // ₹38,000
    status:            "accepted",
    created_at:        t(-26 * HOUR),
    expires_at:        t(6 * HOUR),
    message:           "Thanks for considering. Pads look fine in the photos — works for me at this price.",
    listing_was_negotiable: true,
  },
  // paid — terminal success
  {
    id:                "mock-offer-77881122",
    listing_id:        "lst-008",
    listing_slug:      "fiio-k7-bt-6608",
    listing_title:     "FiiO K7 BT",
    listing_thumbnail: "https://picsum.photos/seed/k7bt-0/400/300",
    offer_amount:      1690000, // ₹16,900 (asking)
    asking_price:      1690000,
    status:            "paid",
    created_at:        t(-72 * HOUR),
    // Realistic edge case: the buyer paid asking on what was a non-negotiable
    // listing — they used Buy now, but it still creates an offer record.
    listing_was_negotiable: false,
  },
  // declined — seller said no (no thumbnail in the fixture, exercises fallback)
  {
    id:                "mock-offer-99aabbcc",
    listing_id:        "lst-004",
    listing_slug:      "schiit-magni-heretic-2207",
    listing_title:     "Schiit Magni Heretic",
    offer_amount:      750000,  // ₹7,500
    asking_price:      1100000, // ₹11,000
    status:            "declined",
    created_at:        t(-48 * HOUR),
    listing_was_negotiable: true,
  },
  // expired — pending timed out (24h no seller response)
  {
    id:                "mock-offer-ddee0011",
    listing_id:        "lst-009",
    listing_slug:      "tin-hifi-p1-max-1027",
    listing_title:     "Tin HiFi P1 Max",
    listing_thumbnail: "https://picsum.photos/seed/p1max-0/400/300",
    offer_amount:      2100000, // ₹21,000
    asking_price:      2400000, // ₹24,000
    status:            "expired",
    created_at:        t(-50 * HOUR),
    listing_was_negotiable: true,
  },
  // cancelled — buyer retracted before acceptance
  // (no slug — exercises id-fallback link)
  {
    id:                "mock-offer-22334455",
    listing_id:        "lst-010",
    listing_title:     "Kinera Leyding 8-core OFC Cable (2-pin)",
    listing_thumbnail: "https://picsum.photos/seed/leyding-0/400/300",
    offer_amount:      280000,  // ₹2,800
    asking_price:      320000,  // ₹3,200
    status:            "cancelled",
    created_at:        t(-30 * HOUR),
    listing_was_negotiable: true,
  },
];
