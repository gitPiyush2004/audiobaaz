/**
 * Canonical view-models for the offers (negotiation) surface.
 *
 * Single source of truth for every offer-related type that crosses an
 * access boundary into the UI. Mirrors the contract pattern established
 * in `src/lib/listings/types.ts` — same rules, same discipline. Domain is
 * separate (offers are not listings) so the file lives in its own folder
 * rather than being absorbed into `lib/listings/types.ts`.
 *
 * Components and pages must import these types from `@/lib/offers/types` —
 * never from a component file or an access-function file.
 *
 * ──────────────────────────────────────────────────────────────────────
 * RULES (same as listings/types.ts, with an extra note for this domain)
 * ──────────────────────────────────────────────────────────────────────
 *
 * 1. View-models are intentionally lossy.
 *
 *      DB row / pricing engine state
 *        ↓
 *      Access boundary  (src/lib/offers/*.ts)
 *        ↓
 *      View-model       (this file)
 *
 *    The transformation throws information away ON PURPOSE. For offers
 *    the stakes are higher than for listings because the discarded
 *    fields directly affect marketplace economics — exposing any of
 *    them shifts the negotiation in the buyer's favour and breaks the
 *    seller's pricing privacy.
 *
 *    The following MUST NEVER appear on any type in this file:
 *      - listings.floor_price            (lower bound the seller will accept)
 *      - listings.auto_accept_threshold  (auto-accept short-circuit price)
 *      - users.seller_score / buyer_score (internal trust signals)
 *      - any pricing engine inputs (history weights, demand factors,
 *        platform-side margin signals)
 *      - any internal moderation flags
 *
 *    The compiler is the guardrail. If a future field is added to the DB
 *    that should stay server-side, it does NOT get a TypeScript home here.
 *
 * 2. View-model field names describe what the UI shows / submits, not
 *    what the DB column is called. Source-of-record mappings noted inline
 *    where the relationship isn't obvious.
 *
 * 3. New offer view-models go HERE, not adjacent to a component.
 */

// ─────────────────────────────────────────────────────────────────────────
// Offer range (server-computed band the buyer is allowed to negotiate within)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The negotiation band visible to the buyer for a given listing.
 *
 *   min ─── (some buffer above the seller's private floor) ─── asking
 *
 * The seller's actual `floor_price` is NEVER exposed; `min` is computed
 * server-side as `floor_price + buffer` (or fallback heuristic) and only
 * the resulting range is returned. The buyer cannot reverse-engineer the
 * floor from `min` because the buffer is opaque to them.
 *
 * Both values are in PAISE (₹ × 100).
 */
export interface OfferRange {
  /** Lowest amount the buyer can submit. Always strictly less than `max`. */
  min: number;
  /** The listing's asking price. Always greater than or equal to `min`. */
  max: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Offer draft (what the buyer is composing pre-submission)
// ─────────────────────────────────────────────────────────────────────────

/**
 * In-flight offer the buyer is composing on `/offer/new/[listing]`.
 *
 * This is the BUYER-FACING shape. It is not the eventual `offers` table
 * row — that has additional server-set fields (status, expiry, auto-accept
 * outcome) which never appear on the buyer surface.
 *
 * The draft survives the authentication boundary. Today the carrier is the
 * URL (`?offer=22000`); a future implementation will store the draft
 * server-side and pass an opaque `draft_id` instead. The page reads via
 * `parseOfferDraftFromSearchParams()` so the URL shape can change without
 * forcing the page to change.
 *
 * Source-of-record:
 *   listing_id    ← URL path param (resolved via getListingDetail)
 *   offer_amount  ← user input, validated against OfferRange
 *   message       ← optional free-text from the buyer (not yet wired)
 */
export interface OfferDraftData {
  /** Listing slug or id this offer targets. */
  listing_id: string;
  /** Offer amount in PAISE. Validated to fall within OfferRange. */
  offer_amount: number;
  /** Optional free-text message to the seller. Defer to a later slice. */
  message?: string;
}
