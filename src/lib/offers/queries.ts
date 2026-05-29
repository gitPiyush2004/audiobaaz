/**
 * Offers — buyer-side read functions that return offer-domain types.
 *
 * Sibling of `dashboard.ts`. Two files, two responsibilities:
 *
 *   dashboard.ts  → buyer-side projections (BuyerOfferRow, etc.)
 *   queries.ts    → buyer-side reads that return canonical domain types
 *                   (OfferDetailData here; OfferSummary may join later)
 *
 * Splitting them keeps each file's purpose sharp and avoids `dashboard.ts`
 * silently growing into a junk drawer of every offer-related read. If a
 * read needs a projection, it goes in dashboard.ts; if it returns a
 * domain type, it goes here.
 *
 * Same access-boundary rules as everywhere else:
 *   - View-models are intentionally lossy.
 *   - Server-only fields (floor_price, scores, contact data, etc.) cannot
 *     appear on returned types — enforced by `OfferDetailData`'s shape.
 *   - Mock-backed today; future Supabase impl replaces the BODY of each
 *     function. Call sites are unchanged.
 */

import type { OfferDetailData } from "@/lib/offers/types";
import { mockOffers } from "@/lib/mock/offers";

/**
 * Fetch a single offer for the buyer's detail page.
 *
 * Returns `null` when no offer matches the id; callers translate that to
 * a Next 404 via `notFound()`. The function is unaware of routing
 * conventions — same pattern as `getListingDetail()`.
 *
 * Today: scans the mock fixtures. Tomorrow: SELECT offers WHERE id = $1
 * AND buyer_id = auth.uid(); the buyer-id check stays server-side. Pages
 * MUST NOT pass a userId argument — ownership is enforced at the
 * boundary, never threaded through the URL or component props.
 */
export async function getOfferDetail(
  offerId: string
): Promise<OfferDetailData | null> {
  const trimmed = offerId.trim();
  if (!trimmed) return null;

  const found = mockOffers.find((o) => o.id === trimmed);
  if (!found) return null;

  // Map MockOffer → OfferDetailData via explicit field copy. Done as
  // explicit assignment (not spread) so any future server-only field
  // added to MockOffer cannot accidentally leak through this boundary.
  const detail: OfferDetailData = {
    id:                     found.id,
    listing_id:             found.listing_id,
    listing_slug:           found.listing_slug,
    listing_title:          found.listing_title,
    listing_thumbnail:      found.listing_thumbnail,
    offer_amount:           found.offer_amount,
    asking_price:           found.asking_price,
    status:                 found.status,
    created_at:             found.created_at,
    expires_at:             found.expires_at,
    message:                found.message,
    listing_was_negotiable: found.listing_was_negotiable,
  };

  return detail;
}
