import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/formatting";
import type { ListingCardData } from "@/lib/listings/types";

export interface ListingCardProps {
  listing: ListingCardData;
  priority?: boolean;
  className?: string;
}

const GRADE_STYLE: Record<string, { background: string; color: string }> = {
  S: { background: '#DBEAFE', color: '#1D4ED8' },
  A: { background: '#DCFCE7', color: '#15803D' },
  B: { background: '#FEF9C3', color: '#A16207' },
  C: { background: '#FEF3C7', color: '#92400E' },
  D: { background: '#FEE2E2', color: '#B91C1C' },
};

export function ListingCard({ listing, priority = false, className }: ListingCardProps) {
  const href  = `/listing/${listing.slug ?? listing.id}`;
  const cover = listing.photos[0];
  const grade = GRADE_STYLE[listing.condition_grade] ?? GRADE_STYLE.D;

  return (
    <Link
      href={href}
      aria-label={`${listing.brand} ${listing.product_name} — ${formatPrice(listing.asking_price)}`}
      className={cn("group block", className)}
      style={{ borderRight: '1px solid #E8E8E8', borderBottom: '1px solid #E8E8E8' }}
    >
      {/* Square photo */}
      <div
        style={{ aspectRatio: '1/1', background: '#F5F5F5', position: 'relative', overflow: 'hidden' }}
      >
        {cover ? (
          <Image
            src={cover}
            alt={`${listing.brand} ${listing.product_name}`}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '10px', color: '#999' }}>
            No photo
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '12px' }}>
        {/* Brand */}
        <p style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '2px' }} className="truncate">
          {listing.brand}
        </p>

        {/* Product name */}
        <h3
          style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase', color: '#0a0a0a', marginBottom: '8px', lineHeight: 1.2 }}
          className="line-clamp-2"
        >
          {listing.product_name}
        </h3>

        {/* Price + grade */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <p
            style={{ fontFamily: 'var(--font-mono), "JetBrains Mono", monospace', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0a0a0a' }}
          >
            {formatPrice(listing.asking_price)}
          </p>
          <span
            style={{
              ...grade,
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 0,
              flexShrink: 0,
              letterSpacing: '0.04em',
            }}
          >
            {listing.condition_grade}
          </span>
        </div>
      </div>
    </Link>
  );
}
