/**
 * Mock offer fixtures shaped as `OfferSummary` — the offers domain object,
 * not the dashboard projection. The dashboard's `getMyOffers()` access
 * function reads these and projects them into `BuyerOfferRow`.
 *
 * Designed to exercise every branch the dashboard renders:
 *   - one `pending` close to the seller-response deadline
 *   - one `pending` with plenty of time left
 *   - one `accepted` with hours remaining on the buyer-payment deadline
 *   - one `paid`         (terminal — success)
 *   - one `declined`     (terminal — seller said no)
 *   - one `expired`      (terminal — timed out)
 *   - one `cancelled`    (terminal — buyer retracted)
 *   - one without `listing_thumbnail` so the row's no-photo path renders
 *   - one without `listing_slug` so id-based fallback links exercise
 *
 * Timestamps are computed relative to `MOCK_NOW` so the "time remaining"
 * displays in the dashboard are always realistic regardless of when dev
 * is running. Replace the implementation in `src/lib/offers/dashboard.ts`
 * — not the call sites — when the offers table comes online.
 */

import type { OfferSummary } from "@/lib/offers/types";

/**
 * Anchor "now" for fixture timestamps. Slightly in the past so that
 * `expires_at` for active statuses lands plausibly in the future.
 */
const MOCK_NOW = Date.now();

const HOUR = 60 * 60 * 1000;

const t = (offsetMs: number): string =>
  new Date(MOCK_NOW + offsetMs).toISOString();

export const mockOffers: OfferSummary[] = [
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
  },
];
