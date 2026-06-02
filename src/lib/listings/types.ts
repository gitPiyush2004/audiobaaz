/**
 * Canonical buyer-facing view-models for the listings surface.
 *
 * This file is the SINGLE SOURCE OF TRUTH for every type that crosses an
 * access boundary into the UI (cards, detail page, filters). Components and
 * pages must import these types from `@/lib/listings/types` — never from a
 * component file or an access-function file.
 *
 * ──────────────────────────────────────────────────────────────────────
 * RULES
 * ──────────────────────────────────────────────────────────────────────
 *
 * 1. View-models are intentionally lossy.
 *
 *      DB row
 *        ↓
 *      Access boundary  (src/lib/listings/{browse,detail,...}.ts)
 *        ↓
 *      View-model       (this file)
 *
 *    The transformation throws information away on purpose. Server-only
 *    fields like `floor_price`, `auto_accept_threshold`, `seller_score`,
 *    `buyer_score`, contact data (`phone`, `email`, `upi_id`,
 *    `telegram_chat_id`), and admin/availability flags must NEVER appear
 *    in any type below. The compiler stays a guardrail against leaks.
 *
 * 2. View-model field names describe what the UI shows, not what the DB
 *    column is called. Where the mapping is non-obvious, an inline comment
 *    notes the source of record.
 *
 * 3. New buyer view-models go HERE, not adjacent to a component. Component
 *    files only define their own `*Props` (which take a view-model as a
 *    field). The view-models are domain types; the props are component
 *    plumbing.
 *
 * 4. Inheritance is allowed when semantically true. `ListingDetailData`
 *    extends `ListingCardData` because every card field is also part of
 *    the detail surface. The seller field is unified across both — the
 *    card UI ignores fields it doesn't render.
 */

import type { ConditionGrade, ProductCategory } from "@/types";

// ─────────────────────────────────────────────────────────────────────────
// Seller view-model
// ─────────────────────────────────────────────────────────────────────────

/**
 * Public-facing seller summary used by listing cards and the listing detail
 * page. Strict subset — never accept a raw `User` row.
 *
 * Fields:
 *   - `full_name`    ← `users.full_name`   (may be unset for new accounts)
 *   - `city`         ← `users.city`
 *   - `rating`       ← derived from `ratings` table (0–5 public scale).
 *                       Distinct from internal `users.seller_score` (0–200),
 *                       which never appears here.
 *   - `rating_count` ← derived count of completed ratings
 *   - `member_since` ← `users.created_at` — exposed as a friendly join date
 *
 * `member_since` is optional for cards (they don't render it) and
 * conventionally present on the detail page.
 */
export interface SellerCardData {
  full_name?:    string;
  city?:         string;
  /** Public 0–5 rating. Distinct from internal `seller_score` (0–200). */
  rating?:       number;
  rating_count?: number;
  /** ISO timestamp; UI typically renders as "Member since Mar 2024". */
  member_since?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Listing — card surface
// ─────────────────────────────────────────────────────────────────────────

/**
 * Minimum data shape needed to render a listing card. Used by `ListingCard`
 * and anywhere a grid of listings appears (homepage strip, browse, search,
 * watchlist, similar listings).
 *
 * Source mapping (DB → view-model):
 *   id              ← listings.id
 *   slug            ← listings.slug
 *   product_name    ← listings.product_name
 *   brand           ← listings.brand
 *   condition_grade ← listings.condition_grade
 *   asking_price    ← listings.asking_price (PAISE)
 *   is_negotiable   ← listings.is_negotiable
 *   photos          ← listings.photos[]      (cover = photos[0])
 *   seller          ← join to users (mapped to SellerCardData)
 */
export interface ListingCardData {
  id:              string;
  /**
   * Human-readable slug, the canonical PUBLIC URL identifier for a listing.
   *
   * Rule: public navigation paths (`/listing/<x>`, `/offer/new/<x>`, share
   * links, OG metadata, sitemap entries) use SLUG. Internal references
   * (DB joins, API payloads, foreign keys) use ID.
   *
   * The two are not interchangeable — accumulating both shapes in URLs
   * fragments canonicalisation later. Today access functions accept either
   * for backwards-compatible lookups, but URL CONSTRUCTION should always
   * resolve to slug. A listing is allowed to be slug-less in the DB only
   * during draft state; anything reaching this view-model has been approved
   * and therefore has a slug.
   */
  slug?:           string;
  product_name:    string;
  brand:           string;
  condition_grade: ConditionGrade;
  /** Asking price in PAISE (₹ × 100). */
  asking_price:    number;
  is_negotiable:   boolean;
  /** Ordered photo URLs. First is the cover. */
  photos:          string[];
  seller?:         SellerCardData;
}

// ─────────────────────────────────────────────────────────────────────────
// Listing — detail surface
// ─────────────────────────────────────────────────────────────────────────

/**
 * View-model for the listing detail page (`/listing/[slug]`).
 *
 * Extends `ListingCardData` because every field a card shows is also
 * relevant on the detail page; the detail surface adds richer copy and the
 * inclusions checklist.
 *
 * Additional source mappings:
 *   category        ← listings.category
 *   condition_notes ← listings.condition_notes
 *   known_defects   ← listings.known_defects
 *   inclusions      ← listings.inclusions (JSONB Record<string, boolean>)
 *
 * What is NOT here, intentionally:
 *   - floor_price            (server-side only — buyers never see it)
 *   - auto_accept_threshold  (server-side only)
 *   - rejection_reason       (admin/seller surface)
 *   - any *_at lifecycle timestamps beyond what the UI renders
 */
export interface ListingDetailData extends ListingCardData {
  category:         ProductCategory;
  condition_notes?: string;
  known_defects?:   string;
  /**
   * Inclusions checklist. Empty object when the seller hasn't specified.
   * Keys are the human-readable labels stored on the listing
   * (e.g. "Stock cable", "Carrying case").
   */
  inclusions:       Record<string, boolean>;
}

// ─────────────────────────────────────────────────────────────────────────
// Browse filters & sort
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sort options for the browse surface. Default is `rating_desc` — higher
 * seller-rating listings first, with falls-back-to-recency tie-breaks
 * resolved inside the access function.
 */
export type BrowseSort =
  | "rating_desc"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "most_viewed";

/** Coarse price buckets shown on the filter sidebar. Values are in PAISE. */
export type PriceBucket = "under_5k" | "5k_15k" | "15k_30k" | "30k_75k" | "75k_plus";

/**
 * Filter inputs accepted by `getBrowseListings()` and other browse-shaped
 * access functions. Empty arrays / undefined values mean "no filter applied
 * for that axis".
 */
export interface BrowseFilters {
  categories?:     ProductCategory[];
  conditions?:     ConditionGrade[];
  priceBucket?:    PriceBucket;
  negotiableOnly?: boolean;
  sort?:           BrowseSort;
  /** Optional cap on results, e.g. for the homepage featured strip. */
  limit?:          number;
}
