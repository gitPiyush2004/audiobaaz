import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/formatting";
import { ConditionBadge } from "./ConditionBadge";
import type { ConditionGrade } from "@/types";

/**
 * Minimum data shape the card needs to render.
 *
 * This is intentionally a structural type, not `Listing` directly, so callers
 * can use it with API responses that omit server-only fields like `floor_price`.
 * Whatever you pass MUST satisfy this contract — never spread a raw DB row that
 * could leak `floor_price`, `auto_accept_threshold`, or score fields.
 */
export interface ListingCardData {
  id:              string;
  slug?:           string;
  product_name:    string;
  brand:           string;
  condition_grade: ConditionGrade;
  /** Asking price in PAISE (₹ × 100). */
  asking_price:    number;
  is_negotiable:   boolean;
  /** Ordered photo URLs. First is the cover. */
  photos:          string[];
  seller?: {
    full_name?: string;
    city?:      string;
    /**
     * Public-facing seller rating (0–5). Distinct from the internal
     * `seller_score` (0–200) which is never exposed.
     */
    rating?:       number;
    rating_count?: number;
  };
}

export interface ListingCardProps {
  listing: ListingCardData;
  /** Render as priority/eager image — use only for above-the-fold cards. */
  priority?: boolean;
  className?: string;
}

/**
 * Card used wherever listings appear in a grid: homepage, browse, search,
 * similar listings, watchlist. Entire card is a single link to the detail
 * page. Photo is 4:3, condition badge overlays the top-right, asking price
 * is in mono accent, optional seller rating + city anchors the bottom.
 *
 * Server component. Client interactivity (watchlist save, etc.) should be
 * added as separate client islands rendered alongside the card, not baked in.
 */
export function ListingCard({ listing, priority = false, className }: ListingCardProps) {
  const href = `/listing/${listing.slug ?? listing.id}`;
  const cover = listing.photos[0];
  const sellerName  = listing.seller?.full_name?.trim();
  const sellerCity  = listing.seller?.city?.trim();
  const rating      = listing.seller?.rating;
  const ratingCount = listing.seller?.rating_count;
  const showRating  = typeof rating === "number" && rating > 0;

  return (
    <Link
      href={href}
      aria-label={`${listing.brand} ${listing.product_name} — ${formatPrice(listing.asking_price)}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-surface",
        "transition-all duration-150 hover:-translate-y-0.5 hover:border-border-2 hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className
      )}
    >
      {/* Cover photo — 4:3 keeps cards uniform regardless of source aspect. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
        {cover ? (
          <Image
            src={cover}
            alt={`${listing.brand} ${listing.product_name}`}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-dim-foreground">
            No photo
          </div>
        )}

        <div className="absolute right-2 top-2">
          <ConditionBadge grade={listing.condition_grade} size="sm" />
        </div>

        {listing.is_negotiable && (
          <div className="absolute left-2 top-2 rounded-md bg-bg/70 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-sm">
            Negotiable
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {listing.brand}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground group-hover:text-accent">
            {listing.product_name}
          </h3>
        </div>

        <p className="font-mono text-base font-semibold text-accent">
          {formatPrice(listing.asking_price)}
        </p>

        {(showRating || sellerCity || sellerName) && (
          <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
            <span className="truncate">
              {sellerName ?? "Verified seller"}
              {sellerCity ? ` · ${sellerCity}` : ""}
            </span>
            {showRating && (
              <span className="flex shrink-0 items-center gap-1 text-foreground">
                <Star className="h-3 w-3 fill-accent text-accent" aria-hidden />
                <span className="font-mono">{rating!.toFixed(1)}</span>
                {typeof ratingCount === "number" && ratingCount > 0 && (
                  <span className="text-muted-foreground">({ratingCount})</span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
