/**
 * Mock listings shaped exactly as `ListingCardData` — no server-only fields
 * by construction. This file is the inventory fixture used by the
 * `getBrowseListings()` access function during UI development.
 *
 * Design intent: realistic mess.
 *   - mixed condition grades S → D
 *   - mixed photo counts (1 to 6); some single-photo listings on purpose
 *   - mix of negotiable and fixed-price
 *   - mix of cities and seller experience levels
 *   - obscure brands alongside popular ones (CCA, Tin HiFi, Schiit, Topping…)
 *   - one or two listings with empty inclusions / sparse data
 *   - one with no rating-bearing seller (new account)
 *
 * Photos use `picsum.photos` with stable seeds so the same listing always
 * renders the same image during local dev. Real listings will come from
 * Supabase Storage URLs (already whitelisted in `next.config.mjs`).
 */

import type { ListingCardData } from "@/lib/listings/types";
import type { ProductCategory } from "@/types";
import { mockSellers, type MockSeller, type MockSellerId } from "./users";

/**
 * Listing extended slightly for browse-time filtering and sorting AND for
 * the detail-page surface. `ListingCardData` is the contract for the grid;
 * `ListingDetailData` (defined in `src/lib/listings/detail.ts`) is the
 * contract for the detail page. Extra fields below stay inside the
 * `lib/listings/*` boundary and are mapped out at each access function.
 */
export interface MockListing extends ListingCardData {
  category:      ProductCategory;
  /** ISO timestamp — used for `Newest` sort. */
  created_at:    string;
  /** Used for `Most viewed` sort. */
  view_count:    number;
  // ── Detail-page fields (only some listings have them — realistic mess) ──
  /** Free-text condition notes from the seller. */
  condition_notes?: string;
  /** Free-text disclosure of any known defects. */
  known_defects?:   string;
  /** Inclusions checklist: `{ "Stock cable": true, "Carrying case": false }`. */
  inclusions?:     Record<string, boolean>;
}

const sellerById = (id: MockSellerId) => {
  const s: MockSeller | undefined = mockSellers.find((m) => m.id === id);
  if (!s) throw new Error(`Mock seller not found: ${id}`);
  // Strip id when handing to view-models — id is internal mock plumbing.
  return {
    full_name:    s.full_name,
    city:         s.city,
    rating:       s.rating,
    rating_count: s.rating_count,
    member_since: s.member_since,
  };
};

const photo = (seed: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${seed}-${i}/1200/900`);

export const mockListings: MockListing[] = [
  {
    id:              "lst-001",
    slug:            "moondrop-blessing-3-7421",
    product_name:    "Blessing 3",
    brand:           "Moondrop",
    category:        "iem",
    condition_grade: "A",
    asking_price:    2200000, // ₹22,000
    is_negotiable:   true,
    photos:          photo("blessing3", 5),
    seller:          sellerById("seller-002"),
    created_at:      "2026-05-27T14:12:00.000Z",
    view_count:      341,
    condition_notes: "Used for about 4 months. No driver flex, perfect channel balance. Shells are spotless. Pelican-style case it ships with is also unscuffed.",
    inclusions: {
      "Stock ear tips (S / M / L)":   true,
      "Foam tips":                    false,
      "Carrying case":                true,
      "Stock cable":                  true,
      "Documentation / warranty card":true,
    },
  },
  {
    id:              "lst-002",
    slug:            "sennheiser-hd-660s2-3914",
    product_name:    "HD 660S2",
    brand:           "Sennheiser",
    category:        "headphone",
    condition_grade: "B",
    asking_price:    3800000, // ₹38,000
    is_negotiable:   true,
    photos:          photo("hd660s2", 6),
    seller:          sellerById("seller-001"),
    created_at:      "2026-05-26T09:45:00.000Z",
    view_count:      512,
    condition_notes: "About a year of weekend listening. Pads have light flattening on the rear edge from headband pressure — replacements are widely available. Sound is unaffected. Box has shelf scuffs.",
    known_defects:   "Hairline scratch on the left cup near the gimbal hinge — purely cosmetic, took the photo straight on so it shows up worse than in person.",
    inclusions: {
      "Carrying case":                false,
      "Extra ear pads":               false,
      "Detachable cable":             true,
      "6.35 mm adapter":              true,
      "Documentation / warranty card":true,
    },
  },
  {
    id:              "lst-003",
    slug:            "topping-e30-ii-1158",
    product_name:    "E30 II DAC",
    brand:           "Topping",
    category:        "dac",
    condition_grade: "S",
    asking_price:    1450000, // ₹14,500
    is_negotiable:   false,
    photos:          photo("toppinge30", 3),
    seller:          sellerById("seller-005"),
    created_at:      "2026-05-28T18:30:00.000Z",
    view_count:      88,
    condition_notes: "Bought from Headphone Zone, never opened. Still has the warranty seal. Selling because I won the same unit in a giveaway.",
    inclusions: {
      "Power adapter":                true,
      "USB cable":                    true,
      "Optical cable":                true,
      "Documentation / warranty card":true,
    },
  },
  {
    id:              "lst-004",
    slug:            "schiit-magni-heretic-2207",
    product_name:    "Magni Heretic",
    brand:           "Schiit",
    category:        "amp",
    condition_grade: "B",
    asking_price:    1100000, // ₹11,000
    is_negotiable:   true,
    photos:          photo("magni", 2),
    seller:          sellerById("seller-003"),
    created_at:      "2026-05-25T11:10:00.000Z",
    view_count:      203,
  },
  {
    id:              "lst-005",
    slug:            "ifi-zen-can-3318",
    product_name:    "ZEN CAN Signature 6XX",
    brand:           "iFi",
    category:        "amp",
    condition_grade: "A",
    asking_price:    1850000,
    is_negotiable:   true,
    photos:          photo("zencan", 4),
    seller:          sellerById("seller-002"),
    created_at:      "2026-05-24T17:00:00.000Z",
    view_count:      167,
  },
  // Single photo, mid-grade, lower-rated seller — realistic mess
  {
    id:              "lst-006",
    slug:            "kz-zsn-pro-x-9917",
    product_name:    "ZSN Pro X",
    brand:           "KZ",
    category:        "iem",
    condition_grade: "C",
    asking_price:    180000, // ₹1,800
    is_negotiable:   true,
    photos:          photo("zsnprox", 1),
    seller:          sellerById("seller-006"),
    created_at:      "2026-05-22T08:20:00.000Z",
    view_count:      96,
  },
  // Visible wear — D grade
  {
    id:              "lst-007",
    slug:            "audio-technica-m50x-4521",
    product_name:    "ATH-M50x",
    brand:           "Audio-Technica",
    category:        "headphone",
    condition_grade: "D",
    asking_price:    540000, // ₹5,400
    is_negotiable:   true,
    photos:          photo("m50x", 4),
    seller:          sellerById("seller-004"),
    created_at:      "2026-05-20T13:55:00.000Z",
    view_count:      245,
    condition_notes: "Studio workhorse for 3+ years. Drivers are flawless, headband is what you'd expect — leatherette flaking on the underside, pads are split on both sides. Sounds exactly like a new pair.",
    known_defects:   "Pads will need replacement (~₹600 aftermarket). One small crack at the swivel joint, glued and stable, hasn't moved in months.",
    inclusions: {
      "Carrying case":                false,
      "Extra ear pads":               false,
      "Detachable cable":             true,
      "6.35 mm adapter":              true,
      "Documentation / warranty card":false,
    },
  },
  // Sealed listing
  {
    id:              "lst-008",
    slug:            "fiio-k7-bt-6608",
    product_name:    "K7 BT",
    brand:           "FiiO",
    category:        "dac_amp",
    condition_grade: "S",
    asking_price:    1690000, // ₹16,900
    is_negotiable:   false,
    photos:          photo("k7bt", 5),
    seller:          sellerById("seller-001"),
    created_at:      "2026-05-28T20:05:00.000Z",
    view_count:      134,
  },
  // New seller (no rating) — UI should fall back gracefully
  {
    id:              "lst-009",
    slug:            "tin-hifi-p1-max-1027",
    product_name:    "P1 Max",
    brand:           "Tin HiFi",
    category:        "iem",
    condition_grade: "B",
    asking_price:    2400000,
    is_negotiable:   true,
    photos:          photo("p1max", 3),
    seller:          sellerById("seller-007"),
    created_at:      "2026-05-23T10:40:00.000Z",
    view_count:      28,
    condition_notes: "got these last year, used a couple of times only",
    inclusions: {
      "Stock ear tips (S / M / L)":   true,
      "Carrying case":                true,
    },
  },
  // Cable — niche category, single photo, very obscure brand
  {
    id:              "lst-010",
    slug:            "kinera-leyding-3702",
    product_name:    "Leyding 8-core OFC Cable (2-pin)",
    brand:           "Kinera",
    category:        "cable",
    condition_grade: "A",
    asking_price:    320000,
    is_negotiable:   false,
    photos:          photo("leyding", 1),
    seller:          sellerById("seller-008"),
    created_at:      "2026-05-21T16:25:00.000Z",
    view_count:      62,
  },
  // High-end source — premium pricing
  {
    id:              "lst-011",
    slug:            "fiio-m11s-5840",
    product_name:    "M11S DAP",
    brand:           "FiiO",
    category:        "source",
    condition_grade: "B",
    asking_price:    4500000, // ₹45,000
    is_negotiable:   true,
    photos:          photo("m11s", 4),
    seller:          sellerById("seller-002"),
    created_at:      "2026-05-19T22:10:00.000Z",
    view_count:      387,
  },
  // Obscure brand, mid-grade, fixed-price — realistic edge case
  {
    id:              "lst-012",
    slug:            "cca-cra-plus-8826",
    product_name:    "CRA+",
    brand:           "CCA",
    category:        "iem",
    condition_grade: "C",
    asking_price:    150000, // ₹1,500
    is_negotiable:   false,
    photos:          photo("ccacra", 2),
    seller:          sellerById("seller-006"),
    created_at:      "2026-05-18T07:50:00.000Z",
    view_count:      71,
  },
];
