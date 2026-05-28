/**
 * Listings access boundary for the buyer flow.
 *
 * UI components and pages MUST call `getBrowseListings()` — never read mock
 * files or Supabase directly. Today this returns mock data; later it'll swap
 * to a Supabase query, then add caching and pagination, without forcing any
 * UI changes.
 *
 * The return type is `ListingCardData` so server-only fields like
 * `floor_price`, `auto_accept_threshold`, and trust scores can never leak
 * into client bundles.
 *
 * Type contracts (`ListingCardData`, `BrowseFilters`, `BrowseSort`,
 * `PriceBucket`) live in `@/lib/listings/types`.
 */

import type {
  BrowseFilters,
  BrowseSort,
  ListingCardData,
  PriceBucket,
} from "@/lib/listings/types";
import type { ConditionGrade, ProductCategory } from "@/types";
import { mockListings, type MockListing } from "@/lib/mock/listings";

const PRICE_BUCKETS: Record<PriceBucket, { min: number; max: number }> = {
  under_5k:  { min: 0,        max: 500_000 },     // < ₹5,000
  "5k_15k":  { min: 500_000,  max: 1_500_000 },   // ₹5k – ₹15k
  "15k_30k": { min: 1_500_000, max: 3_000_000 },  // ₹15k – ₹30k
  "30k_plus":{ min: 3_000_000, max: Number.POSITIVE_INFINITY },
};

function applyFilters(input: MockListing[], f: BrowseFilters): MockListing[] {
  let out = input;

  if (f.categories && f.categories.length > 0) {
    const set = new Set(f.categories);
    out = out.filter((l) => set.has(l.category));
  }

  if (f.conditions && f.conditions.length > 0) {
    const set = new Set(f.conditions);
    out = out.filter((l) => set.has(l.condition_grade));
  }

  if (f.priceBucket) {
    const { min, max } = PRICE_BUCKETS[f.priceBucket];
    out = out.filter((l) => l.asking_price >= min && l.asking_price < max);
  }

  if (f.negotiableOnly) {
    out = out.filter((l) => l.is_negotiable);
  }

  return out;
}

function applySort(input: MockListing[], sort: BrowseSort): MockListing[] {
  const out = [...input]; // never mutate the source
  switch (sort) {
    case "newest":
      return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "price_asc":
      return out.sort((a, b) => a.asking_price - b.asking_price);
    case "price_desc":
      return out.sort((a, b) => b.asking_price - a.asking_price);
    case "most_viewed":
      return out.sort((a, b) => b.view_count - a.view_count);
    case "rating_desc":
    default: {
      // Higher seller rating first; missing ratings sort to the end.
      // Tie-break on rating_count, then on newest.
      const r = (l: MockListing) => l.seller?.rating ?? -1;
      const c = (l: MockListing) => l.seller?.rating_count ?? 0;
      return out.sort((a, b) => {
        const dr = r(b) - r(a);
        if (dr !== 0) return dr;
        const dc = c(b) - c(a);
        if (dc !== 0) return dc;
        return b.created_at.localeCompare(a.created_at);
      });
    }
  }
}

/** Strip MockListing-only fields so the public surface stays exactly `ListingCardData`. */
function toCardData(l: MockListing): ListingCardData {
  return {
    id:              l.id,
    slug:            l.slug,
    product_name:    l.product_name,
    brand:           l.brand,
    condition_grade: l.condition_grade,
    asking_price:    l.asking_price,
    is_negotiable:   l.is_negotiable,
    photos:          l.photos,
    seller:          l.seller,
  };
}

/**
 * Fetch listings for the browse surface.
 *
 * Currently returns mock data; the function signature is the contract the
 * Supabase implementation will honour. UI must depend on this signature only.
 */
export async function getBrowseListings(
  filters: BrowseFilters = {}
): Promise<ListingCardData[]> {
  const sort = filters.sort ?? "rating_desc";

  const filtered = applyFilters(mockListings, filters);
  const sorted   = applySort(filtered, sort);
  const limited  = typeof filters.limit === "number" ? sorted.slice(0, filters.limit) : sorted;

  return limited.map(toCardData);
}

/**
 * Helpers for parsing URL search params into `BrowseFilters` so the
 * `/browse` page (or any page consuming this boundary) doesn't reinvent
 * the wheel. Kept colocated because the URL shape and the filter shape
 * evolve together.
 */
export const VALID_CATEGORIES: ProductCategory[] = [
  "iem",
  "headphone",
  "dac",
  "amp",
  "dac_amp",
  "cable",
  "source",
  "accessory",
  "other",
];

export const VALID_CONDITIONS: ConditionGrade[] = ["S", "A", "B", "C", "D"];

export const VALID_PRICE_BUCKETS: PriceBucket[] = [
  "under_5k",
  "5k_15k",
  "15k_30k",
  "30k_plus",
];

export const VALID_SORTS: BrowseSort[] = [
  "rating_desc",
  "newest",
  "price_asc",
  "price_desc",
  "most_viewed",
];

function parseList<T extends string>(raw: string | undefined, valid: readonly T[]): T[] {
  if (!raw) return [];
  const set = new Set<string>(valid);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is T => set.has(s));
}

/**
 * Parse the URL's `searchParams` into typed `BrowseFilters`.
 * Anything unrecognised is dropped silently — never trust client input.
 */
export function parseBrowseSearchParams(
  params: Record<string, string | string[] | undefined>
): BrowseFilters {
  const oneOf = <T extends string>(key: string, valid: readonly T[]): T | undefined => {
    const raw = params[key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v && (valid as readonly string[]).includes(v) ? (v as T) : undefined;
  };

  const list = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw.join(",") : raw;
  };

  return {
    categories:     parseList(list("category"),  VALID_CATEGORIES),
    conditions:     parseList(list("condition"), VALID_CONDITIONS),
    priceBucket:    oneOf("price", VALID_PRICE_BUCKETS),
    negotiableOnly: list("negotiable") === "1",
    sort:           oneOf("sort", VALID_SORTS),
  };
}
