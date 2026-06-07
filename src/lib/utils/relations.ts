/**
 * Supabase nested-relation results can come back as either a single object
 * or a one-element array depending on the FK cardinality and the query
 * shape. `pickOne` normalises that to a single typed object (or null).
 *
 * Usage:
 *   const buyer = pickOne<BuyerRow>(dispute.buyers);
 *
 * Prefer this over `as any` casts so we keep the no-explicit-any rule on.
 */
export function pickOne<T>(rel: unknown): T | null {
  if (rel == null) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}
