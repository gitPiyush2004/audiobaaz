/**
 * Listing detail access boundary.
 *
 * UI components and pages MUST call `getListingDetail(idOrSlug)` — never
 * read mock files or Supabase directly. Sibling of `browse.ts`. Mock-backed
 * today; the future Supabase migration replaces the implementation INSIDE
 * this function. Callers (the route page, components) keep their imports
 * unchanged.
 *
 * The return type is `ListingDetailData` — a strict view-model that
 * excludes server-only fields (`floor_price`, `auto_accept_threshold`,
 * `seller_score`, `buyer_score`) by construction so they cannot leak
 * into the client surface even if the underlying source is wrong.
 *
 * Type contracts (`ListingDetailData`, `SellerCardData`) live in
 * `@/lib/listings/types`.
 *
 * See `docs/context/buyer-flow.md` §4 for the boundary rules.
 */

import type { ConditionGrade } from "@/types";
import type { ListingDetailData } from "@/lib/listings/types";
import { mockListings } from "@/lib/mock/listings";

/**
 * Fetch a single listing by id OR slug.
 *
 * Returns `null` when not found. Callers translate that to a Next 404 via
 * `notFound()` — keeping the access boundary unaware of routing conventions.
 *
 * @param idOrSlug — either the `id` (UUID-like) or the human-readable `slug`
 */
export async function getListingDetail(
  idOrSlug: string
): Promise<ListingDetailData | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  const found = mockListings.find(
    (l) => l.slug === trimmed || l.id === trimmed
  );
  if (!found) return null;

  // Map MockListing → ListingDetailData. Done explicitly (not via spread)
  // so any new server-only field added to MockListing later cannot
  // accidentally leak through this boundary.
  const detail: ListingDetailData = {
    id:              found.id,
    slug:            found.slug,
    product_name:    found.product_name,
    brand:           found.brand,
    category:        found.category,
    condition_grade: found.condition_grade as ConditionGrade,
    asking_price:    found.asking_price,
    is_negotiable:   found.is_negotiable,
    photos:          found.photos,
    condition_notes: found.condition_notes,
    known_defects:   found.known_defects,
    inclusions:      found.inclusions ?? {},
    seller:          found.seller && {
      full_name:    found.seller.full_name,
      city:         found.seller.city,
      rating:       found.seller.rating,
      rating_count: found.seller.rating_count,
      member_since: found.seller.member_since,
    },
  };

  return detail;
}
