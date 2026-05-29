import { createAdminClient } from "@/lib/supabase/admin";
import type { ConditionGrade, ProductCategory } from "@/types";
import type { ListingDetailData } from "@/lib/listings/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RawRow = {
  id: string;
  slug: string | null;
  product_name: string;
  brand: string;
  category: string;
  condition_grade: string;
  asking_price: number;
  is_negotiable: boolean;
  photos: string[] | null;
  condition_notes: string | null;
  known_defects: string | null;
  inclusions: Record<string, boolean> | null;
  seller_id: string;
  users: { full_name: string | null; city: string | null; created_at: string } | null;
};

export async function getListingDetail(
  idOrSlug: string
): Promise<ListingDetailData | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  const supabase = createAdminClient();
  const col = UUID_RE.test(trimmed) ? "id" : "slug";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: raw } = await (supabase as any)
    .from("listings")
    .select(
      "id, slug, product_name, brand, category, condition_grade, asking_price, is_negotiable, photos, condition_notes, known_defects, inclusions, seller_id, users!seller_id(full_name, city, created_at)"
    )
    .eq("status", "approved")
    .eq(col, trimmed)
    .single();

  const row = raw as RawRow | null;
  if (!row) return null;

  const seller = Array.isArray(row.users) ? row.users[0] : row.users;

  const { data: ratingRaw } = await supabase
    .from("seller_ratings")
    .select("average_rating, total_ratings")
    .eq("seller_id", row.seller_id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ratingData = ratingRaw as any;

  return {
    id:              row.id,
    slug:            row.slug ?? undefined,
    product_name:    row.product_name,
    brand:           row.brand,
    category:        row.category as ProductCategory,
    condition_grade: row.condition_grade as ConditionGrade,
    asking_price:    row.asking_price,
    is_negotiable:   row.is_negotiable,
    photos:          row.photos ?? [],
    condition_notes: row.condition_notes ?? undefined,
    known_defects:   row.known_defects   ?? undefined,
    inclusions:      row.inclusions ?? {},
    seller: seller ? {
      full_name:    seller.full_name    ?? undefined,
      city:         seller.city         ?? undefined,
      rating:       ratingData ? Number(ratingData.average_rating) : undefined,
      rating_count: ratingData ? Number(ratingData.total_ratings)  : undefined,
      member_since: seller.created_at,
    } : undefined,
  };
}
