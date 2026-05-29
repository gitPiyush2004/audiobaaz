/**
 * Browse — buyer inventory surface.
 *
 * Server component. Reads filters and sort from the URL search params
 * (so the page is shareable, back-button friendly, and SSR-cacheable later).
 * All listing reads go through the access boundary `getBrowseListings()` —
 * no direct mock or Supabase access in this file.
 *
 * Filter sidebar is anchor-based (no client JS yet) — every interactive
 * filter is a Link that updates the URL. Client-side interactivity (debounced
 * search, multi-select chips, keyboard nav) can be added later as client
 * islands without changing this file's contract.
 */

import Link from "next/link";
import {
  getBrowseListings,
  parseBrowseSearchParams,
  VALID_CATEGORIES,
  VALID_CONDITIONS,
  VALID_PRICE_BUCKETS,
  VALID_SORTS,
} from "@/lib/listings/browse";
import type { BrowseSort, PriceBucket } from "@/lib/listings/types";
import { ListingCard } from "@/components/listing/ListingCard";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { cn } from "@/lib/utils/cn";
import type { ConditionGrade, ProductCategory } from "@/types";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Browse — Audiobaaz",
  description: "Browse condition-graded, escrow-protected secondhand audio gear.",
};

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  iem:       "IEM",
  headphone: "Headphone",
  dac:       "DAC",
  amp:       "Amp",
  dac_amp:   "DAC + Amp",
  cable:     "Cable",
  source:    "Source",
  accessory: "Accessory",
  other:     "Other",
};

const PRICE_LABEL: Record<PriceBucket, string> = {
  under_5k:  "Under ₹5,000",
  "5k_15k":  "₹5,000 – ₹15,000",
  "15k_30k": "₹15,000 – ₹30,000",
  "30k_plus":"₹30,000+",
};

const SORT_LABEL: Record<BrowseSort, string> = {
  rating_desc: "Seller rating",
  newest:      "Newest",
  price_asc:   "Price ↑",
  price_desc:  "Price ↓",
  most_viewed: "Most viewed",
};

interface BrowsePageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const filters = parseBrowseSearchParams(searchParams);
  const listings = await getBrowseListings(filters);

  // Helpers for building filter links — preserve everything else, toggle one key.
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string> = {};

    // Re-emit the current filters back into the URL.
    if (filters.categories && filters.categories.length > 0) {
      merged.category = filters.categories.join(",");
    }
    if (filters.conditions && filters.conditions.length > 0) {
      merged.condition = filters.conditions.join(",");
    }
    if (filters.priceBucket) merged.price = filters.priceBucket;
    if (filters.negotiableOnly) merged.negotiable = "1";
    if (filters.sort && filters.sort !== "rating_desc") merged.sort = filters.sort;

    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) {
        delete merged[k];
      } else {
        merged[k] = v;
      }
    }

    const qs = new URLSearchParams(merged).toString();
    return qs ? `/browse?${qs}` : "/browse";
  };

  // Toggling a multi-select category or condition.
  const toggleInList = (current: string[], value: string) =>
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

  const categoryHref = (c: ProductCategory) => {
    const next = toggleInList(filters.categories ?? [], c);
    return buildHref({ category: next.length ? next.join(",") : undefined });
  };
  const conditionHref = (g: ConditionGrade) => {
    const next = toggleInList(filters.conditions ?? [], g);
    return buildHref({ condition: next.length ? next.join(",") : undefined });
  };
  const priceHref = (b: PriceBucket | undefined) => buildHref({ price: b });
  const sortHref  = (s: BrowseSort) => buildHref({ sort: s === "rating_desc" ? undefined : s });
  const negotiableHref = () => buildHref({ negotiable: filters.negotiableOnly ? undefined : "1" });
  const clearAllHref   = () => "/browse";

  const activeSort = filters.sort ?? "rating_desc";
  const hasAnyFilter =
    (filters.categories?.length ?? 0) > 0 ||
    (filters.conditions?.length ?? 0) > 0 ||
    !!filters.priceBucket ||
    !!filters.negotiableOnly;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Browse listings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {listings.length} {listings.length === 1 ? "listing" : "listings"}
            {hasAnyFilter ? " match your filters" : " live right now"}.
          </p>
        </div>

        {/* Sort */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
          {VALID_SORTS.map((s) => {
            const isActive = activeSort === s;
            return (
              <Link
                key={s}
                href={sortHref(s)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                  isActive
                    ? "bg-accent text-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {SORT_LABEL[s]}
              </Link>
            );
          })}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          {hasAnyFilter && (
            <Link
              href={clearAllHref()}
              className="text-xs font-medium text-accent hover:underline"
            >
              Clear all filters
            </Link>
          )}

          <FilterGroup title="Category">
            <div className="flex flex-wrap gap-1.5">
              {VALID_CATEGORIES.map((c) => {
                const isActive = filters.categories?.includes(c);
                return (
                  <Link
                    key={c}
                    href={categoryHref(c)}
                    className={chipClass(isActive)}
                  >
                    {CATEGORY_LABEL[c]}
                  </Link>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup title="Condition">
            <div className="flex flex-wrap gap-1.5">
              {VALID_CONDITIONS.map((g) => {
                const isActive = filters.conditions?.includes(g);
                return (
                  <Link
                    key={g}
                    href={conditionHref(g)}
                    className={chipClass(isActive)}
                  >
                    {g}
                  </Link>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup title="Price">
            <div className="flex flex-col gap-1">
              <Link
                href={priceHref(undefined)}
                className={priceItemClass(!filters.priceBucket)}
              >
                Any price
              </Link>
              {VALID_PRICE_BUCKETS.map((b) => (
                <Link
                  key={b}
                  href={priceHref(b)}
                  className={priceItemClass(filters.priceBucket === b)}
                >
                  {PRICE_LABEL[b]}
                </Link>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Other">
            <Link
              href={negotiableHref()}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                filters.negotiableOnly
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "h-3 w-3 rounded-sm border",
                  filters.negotiableOnly
                    ? "border-accent bg-accent"
                    : "border-border"
                )}
                aria-hidden
              />
              Negotiable only
            </Link>
          </FilterGroup>
        </aside>

        {/* Grid */}
        <ListingGrid>
          {listings.map((l, i) => (
            <ListingCard key={l.id} listing={l} priority={i < 4} />
          ))}
        </ListingGrid>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function chipClass(active: boolean | undefined): string {
  return cn(
    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
    active
      ? "border-accent bg-accent/10 text-accent"
      : "border-border bg-surface text-muted-foreground hover:text-foreground"
  );
}

function priceItemClass(active: boolean): string {
  return cn(
    "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
    active
      ? "bg-accent/10 text-accent"
      : "text-muted-foreground hover:bg-surface hover:text-foreground"
  );
}
