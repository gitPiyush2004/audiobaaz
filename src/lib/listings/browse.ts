import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BrowseFilters,
  BrowseSort,
  ListingCardData,
  PriceBucket,
} from "@/lib/listings/types";
import type { ConditionGrade, ProductCategory } from "@/types";

const PRICE_BUCKETS: Record<PriceBucket, { min: number; max: number }> = {
  under_5k:   { min: 0,         max: 500_000 },
  "5k_15k":   { min: 500_000,   max: 1_500_000 },
  "15k_30k":  { min: 1_500_000, max: 3_000_000 },
  "30k_plus": { min: 3_000_000, max: Number.POSITIVE_INFINITY },
};

export async function getBrowseListings(
  filters: BrowseFilters = {}
): Promise<ListingCardData[]> {
  const supabase = createAdminClient();
  const sort = filters.sort ?? "rating_desc";

  let query = supabase
    .from("listings")
    .select(
      "id, slug, product_name, brand, category, condition_grade, asking_price, is_negotiable, photos, view_count, seller_id, users!seller_id(full_name, city, created_at)"
    )
    .eq("status", "approved");

  if (filters.categories?.length) query = query.in("category", filters.categories);
  if (filters.conditions?.length)  query = query.in("condition_grade", filters.conditions);
  if (filters.negotiableOnly)      query = query.eq("is_negotiable", true);

  if (filters.priceBucket) {
    const { min, max } = PRICE_BUCKETS[filters.priceBucket];
    query = query.gte("asking_price", min);
    if (max !== Number.POSITIVE_INFINITY) query = query.lt("asking_price", max);
  }

  if (sort === "newest")      query = query.order("created_at",   { ascending: false });
  else if (sort === "price_asc")   query = query.order("asking_price", { ascending: true  });
  else if (sort === "price_desc")  query = query.order("asking_price", { ascending: false });
  else if (sort === "most_viewed") query = query.order("view_count",   { ascending: false });

  if (filters.limit) query = query.limit(filters.limit);

  const { data: rows } = await query;
  if (!rows?.length) return [];

  // Batch-fetch seller ratings for all sellers in one query
  const sellerIds = Array.from(new Set(rows.map((r) => r.seller_id as string)));
  const { data: ratingRows } = await supabase
    .from("seller_ratings")
    .select("seller_id, average_rating, total_ratings")
    .in("seller_id", sellerIds);

  const ratingMap = new Map(
    (ratingRows ?? []).map((r) => [r.seller_id as string, r])
  );

  const listings: ListingCardData[] = rows.map((row) => {
    const seller = Array.isArray(row.users) ? row.users[0] : row.users;
    const r = ratingMap.get(row.seller_id as string);
    return {
      id:              row.id,
      slug:            row.slug ?? undefined,
      product_name:    row.product_name,
      brand:           row.brand,
      condition_grade: row.condition_grade as ConditionGrade,
      asking_price:    row.asking_price,
      is_negotiable:   row.is_negotiable,
      photos:          (row.photos as string[]) ?? [],
      seller: seller ? {
        full_name:    (seller as { full_name: string | null }).full_name   ?? undefined,
        city:         (seller as { city: string | null }).city             ?? undefined,
        rating:       r ? Number(r.average_rating) : undefined,
        rating_count: r ? Number(r.total_ratings)  : undefined,
        member_since: (seller as { created_at: string }).created_at,
      } : undefined,
    };
  });

  // rating_desc sort happens in-memory after merging rating data
  if (sort === "rating_desc") {
    listings.sort((a, b) => {
      const ra = a.seller?.rating ?? -1;
      const rb = b.seller?.rating ?? -1;
      if (rb !== ra) return rb - ra;
      const ca = a.seller?.rating_count ?? 0;
      const cb = b.seller?.rating_count ?? 0;
      if (cb !== ca) return cb - ca;
      return 0;
    });
  }

  return listings;
}

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
