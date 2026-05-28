import { Star, MapPin, Calendar } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Public seller view-model for the listing detail surface.
 *
 * Strict subset — never accept a raw `User` row. The fields below are the
 * only public-facing data points. Internal trust scores (`seller_score`,
 * `buyer_score`), contact data (`phone`, `email`, `upi_id`,
 * `telegram_chat_id`), and admin/availability flags must never reach this
 * shape. The access boundary maps DB rows → `SellerCardData` and that is
 * the only place the conversion happens.
 */
export interface SellerCardData {
  full_name?:    string;
  city?:         string;
  /** Public 0–5 rating. Distinct from internal `seller_score` (0–200). */
  rating?:       number;
  rating_count?: number;
  /** ISO timestamp of when the user account was created. */
  member_since?: string;
}

export interface SellerCardProps {
  seller:    SellerCardData;
  className?: string;
}

/**
 * Compact seller summary used on the listing detail page. No rating yet?
 * Show "New seller" instead of a 0.0 — it's the truthful framing for an
 * account with no completed sales.
 *
 * Server component.
 */
export function SellerCard({ seller, className }: SellerCardProps) {
  const name = seller.full_name?.trim() || "Verified seller";
  const showRating  = typeof seller.rating === "number" && seller.rating > 0;
  const memberSince = seller.member_since ? formatMonthYear(seller.member_since) : undefined;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-surface p-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-heading text-sm font-bold text-muted-foreground"
          aria-hidden
        >
          {initials(name)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {name}
          </p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            {showRating ? (
              <>
                <Star className="h-3 w-3 fill-accent text-accent" aria-hidden />
                <span className="font-mono text-foreground">
                  {seller.rating!.toFixed(1)}
                </span>
                {typeof seller.rating_count === "number" && seller.rating_count > 0 && (
                  <span>({seller.rating_count})</span>
                )}
              </>
            ) : (
              <span>New seller</span>
            )}
          </div>
        </div>
      </div>

      {(seller.city || memberSince) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {seller.city && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" aria-hidden />
              {seller.city}
            </span>
          )}
          {memberSince && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" aria-hidden />
              Member since {memberSince}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year:  "numeric",
  }).format(new Date(iso));
}
