/**
 * Offers access boundary — buyer-side draft helpers.
 *
 * All buyer-facing reads and validations for the offer flow go through
 * this module. UI never computes ranges from listing fields directly,
 * never inspects the URL shape inline, and never validates amounts using
 * ad-hoc logic. Same discipline as `src/lib/listings/*`.
 *
 * Today everything here is mock/stub. The future implementation will:
 *   - read `floor_price` and `auto_accept_threshold` SERVER-SIDE
 *   - compute the visible range using the configured buffer policy
 *   - persist the draft against an authenticated session
 * None of those details cross this boundary.
 *
 * See `docs/context/buyer-flow.md` §4 for the boundary rules.
 */

import type { OfferDraftData, OfferRange } from "@/lib/offers/types";

// ─────────────────────────────────────────────────────────────────────────
// Range computation
// ─────────────────────────────────────────────────────────────────────────

/**
 * For the skeleton: the visible range floor is 70% of asking. The real
 * implementation will use `Math.max(floor_price + buffer, asking * 0.5)`
 * or whatever policy product chooses — that decision lives behind this
 * function so the buyer surface never sees it. Adjusting the policy later
 * is a one-line change here, not a cross-cutting refactor.
 */
const SKELETON_FLOOR_PCT = 0.7;

/**
 * Get the negotiation range visible to the buyer for a listing.
 *
 * Mock-backed today — derives the band from `asking_price` only. The future
 * Supabase impl reads `floor_price` server-side, applies the buffer policy,
 * and returns the same `OfferRange` shape. Callers (the offer page,
 * `OfferAmountInput`) must NOT depend on how the range was computed.
 */
export async function getOfferRange(args: {
  listingId:    string;
  askingPrice:  number;
}): Promise<OfferRange> {
  // Skeleton policy. Replace with server-side computation that reads
  // floor_price + buffer; preserve this signature.
  const min = Math.round(args.askingPrice * SKELETON_FLOOR_PCT);
  const max = args.askingPrice;
  return { min, max };
}

// ─────────────────────────────────────────────────────────────────────────
// Draft parsing — the URL-as-carrier helper
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pull a buyer's in-flight offer draft out of `searchParams`.
 *
 * The current carrier is `?offer=<paise>`. This is a SKELETON contract —
 * a future implementation will pass `?draft=<server-stored-id>` instead.
 * Pages call this helper instead of reading `searchParams.offer` directly,
 * so swapping the carrier later does not require touching any page code.
 *
 * Returns `null` if no usable draft is present in the URL. Invalid values
 * (non-numeric, negative, NaN) are dropped silently — never trust client
 * input, never throw on a malformed URL.
 *
 * @param listingId — the listing this draft is being composed against;
 *                    embedded in the returned draft so callers don't have
 *                    to thread it manually.
 */
export function parseOfferDraftFromSearchParams(
  params: Record<string, string | string[] | undefined>,
  listingId: string
): OfferDraftData | null {
  const raw = params.offer;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;

  const offer_amount = Number.parseInt(value, 10);
  if (!Number.isFinite(offer_amount) || offer_amount <= 0) return null;

  return {
    listing_id:   listingId,
    offer_amount,
  };
}

/**
 * Build the URL that carries a draft through the auth boundary.
 *
 * Centralised so the auth-handoff shape is defined once and changes once.
 * Today: `/login?redirect=/offer/new/<id>&offer=<paise>`.
 * Tomorrow when drafts are server-persisted, this becomes
 * `/login?redirect=/offer/new/<id>&draft=<draft_id>` — same call sites,
 * different internals.
 */
export function buildOfferAuthRedirect(draft: OfferDraftData): string {
  const target = `/offer/new/${encodeURIComponent(draft.listing_id)}`;
  // Skeleton: pass the amount in the URL alongside the redirect.
  // Future: persist draft server-side, pass `draft=<id>` instead.
  const targetWithOffer = `${target}?offer=${draft.offer_amount}`;
  return `/login?redirect=${encodeURIComponent(targetWithOffer)}`;
}

/**
 * Validate that an amount is a legal offer for a given range.
 *
 * Returns `null` when valid, or a buyer-facing error message when not.
 * Centralised here so every entry point (URL hydration, form submission,
 * future client-side checks) shares the same rules.
 */
export function validateOfferAmount(
  offer_amount: number,
  range: OfferRange
): string | null {
  if (!Number.isFinite(offer_amount)) return "Enter a valid amount.";
  if (offer_amount < range.min) return "Offer is below the minimum the seller will consider.";
  if (offer_amount > range.max) return "Offer cannot exceed the asking price.";
  return null;
}
