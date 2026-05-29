/**
 * Offer creation access boundary.
 *
 * The point at which a buyer's `OfferDraftData` becomes a real `OfferSummary`
 * — i.e. the buyer has committed intent and the offer enters the state
 * machine in `pending`.
 *
 * Today this is a SKELETON: it validates inputs, applies the initial
 * `pending` state via the state machine, and returns a mocked summary.
 * No DB write, no auth check, no Telegram notification. The future
 * Supabase implementation replaces this function's BODY — the signature
 * is the contract that pages and forms will continue to call.
 *
 * Why this exists before auth and the offers table:
 *   - The negotiation state machine is the marketplace's hardest problem.
 *     Locking the domain object's shape and the entry point now lets the
 *     auth, RLS, and Telegram layers slot in without re-shaping anything.
 *   - The same `createOfferDraft` signature is what the eventual API
 *     route and the eventual seller-side admin force-create path will
 *     converge on. One contract, one file.
 *
 * See `docs/context/buyer-flow.md` §4 for the boundary rules.
 */

import { validateOfferTransition } from "@/lib/offers/state";
import type {
  OfferDraftData,
  OfferRange,
  OfferStatus,
  OfferSummary,
} from "@/lib/offers/types";
import { validateOfferAmount } from "@/lib/offers/draft";

// ─────────────────────────────────────────────────────────────────────────
// Result shape
// ─────────────────────────────────────────────────────────────────────────

/**
 * Outcome of `createOfferDraft`. A discriminated union so call sites are
 * forced to handle both branches and never silently assume success.
 *
 * The error shape mirrors the API envelope from ENGINEERING.md
 * (`{ data: null, error: { message, code } }`) so the future API route
 * can return this almost verbatim.
 */
export type CreateOfferResult =
  | { ok: true;  offer: OfferSummary }
  | { ok: false; error: { code: CreateOfferErrorCode; message: string } };

export type CreateOfferErrorCode =
  | "invalid_amount"
  | "out_of_range"
  | "listing_not_negotiable"
  | "listing_not_available"
  | "state_machine_rejected";

// ─────────────────────────────────────────────────────────────────────────
// Inputs the boundary needs from the caller
// ─────────────────────────────────────────────────────────────────────────

/**
 * Listing context required to create an offer. Callers pull this from
 * `getListingDetail()` and pass the relevant fields — the create function
 * does NOT load the listing itself, keeping it small and synchronous-ish
 * around the eventual DB write.
 *
 * Source-of-record (these are exactly the fields the future Supabase impl
 * will need to read from the listings row before inserting):
 *   id              ← listings.id
 *   slug            ← listings.slug
 *   brand           ← listings.brand
 *   product_name    ← listings.product_name
 *   thumbnail       ← listings.photos[0]
 *   asking_price    ← listings.asking_price (PAISE)
 *   is_negotiable   ← listings.is_negotiable
 */
export interface CreateOfferListingContext {
  id:            string;
  slug?:         string;
  brand:         string;
  product_name:  string;
  thumbnail?:    string;
  asking_price:  number;
  is_negotiable: boolean;
}

export interface CreateOfferDraftArgs {
  draft:    OfferDraftData;
  listing:  CreateOfferListingContext;
  range:    OfferRange;
}

// ─────────────────────────────────────────────────────────────────────────
// Boundary implementation (mock-backed)
// ─────────────────────────────────────────────────────────────────────────

/**
 * 24 hours in milliseconds. Locked product decision: pending offers expire
 * 24h after creation if the seller doesn't respond. Centralised here so
 * the eventual Supabase impl writes the same value into `expires_at`.
 */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Create a buyer offer from a validated draft.
 *
 * Skeleton behaviour:
 *   1. Re-validate the amount against the visible range (defence in depth —
 *      the page already validated, but the boundary cannot trust callers).
 *   2. Re-validate the listing accepts offers.
 *   3. Apply the initial `pending` state via the state machine. This is a
 *      no-op-shaped check today but ensures any future invariant added to
 *      `validateOfferTransition` is enforced uniformly.
 *   4. Return a mocked `OfferSummary` populated as if it had been
 *      persisted. No DB write.
 *
 * Future swap: replace the body with a Supabase insert + initial state
 * row. The signature, error shape, and PENDING_TTL_MS stay the same.
 */
export async function createOfferDraft(
  args: CreateOfferDraftArgs
): Promise<CreateOfferResult> {
  const { draft, listing, range } = args;

  if (!listing.is_negotiable) {
    return {
      ok: false,
      error: {
        code:    "listing_not_negotiable",
        message: "This seller doesn't accept offers on this listing.",
      },
    };
  }

  const amountError = validateOfferAmount(draft.offer_amount, range);
  if (amountError) {
    const code: CreateOfferErrorCode = !Number.isFinite(draft.offer_amount)
      ? "invalid_amount"
      : "out_of_range";
    return {
      ok: false,
      error: { code, message: amountError },
    };
  }

  // Apply the initial state via the state machine. We're transitioning
  // from a synthetic "no-state" baseline to `pending`, but using the same
  // validator means any future creation invariant lives in one place.
  // For the skeleton we just confirm `pending` is a legitimate origin
  // for at least one onward event — i.e. the state machine knows it.
  const initialStatus: OfferStatus = "pending";
  const sanity = validateOfferTransition(initialStatus, "seller_accept");
  if (!sanity.ok) {
    // Defensive — should never happen given the static transition table.
    return {
      ok: false,
      error: {
        code:    "state_machine_rejected",
        message: sanity.reason,
      },
    };
  }

  const now        = new Date();
  const expires_at = new Date(now.getTime() + PENDING_TTL_MS);

  // Mocked persistence. Future impl: INSERT into offers, return the row
  // mapped to OfferSummary. The mocked id format is intentionally
  // recognisable (`mock-offer-…`) so tests can assert on it during the
  // transition period.
  const offer: OfferSummary = {
    id:                `mock-offer-${randomSuffix()}`,
    listing_id:        listing.id,
    listing_slug:      listing.slug,
    listing_title:     `${listing.brand} ${listing.product_name}`,
    listing_thumbnail: listing.thumbnail,
    offer_amount:      draft.offer_amount,
    asking_price:      listing.asking_price,
    status:            initialStatus,
    created_at:        now.toISOString(),
    expires_at:        expires_at.toISOString(),
  };

  return { ok: true, offer };
}

function randomSuffix(): string {
  // Tiny, non-cryptographic — sufficient for distinguishing mock offers
  // during local development. The real impl will get a UUID from Postgres.
  return Math.random().toString(36).slice(2, 10);
}
