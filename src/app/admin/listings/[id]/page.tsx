import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { ReviewActions } from './ReviewActions';

const conditionColors: Record<string, string> = {
  S: 'text-accent border-accent',
  A: 'text-success border-success',
  B: 'text-blue-400 border-blue-400',
  C: 'text-warning border-warning',
  D: 'text-error border-error',
};

const conditionLabels: Record<string, string> = {
  S: 'Sealed',
  A: 'Mint',
  B: 'Excellent',
  C: 'Good',
  D: 'Fair',
};

export default async function AdminListingReviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: listing } = await supabase
    .from('listings')
    .select(`
      id, product_name, brand, category, condition_grade, condition_notes,
      known_defects, inclusions, photos, asking_price, floor_price,
      is_negotiable, auto_accept_threshold, ownership_proof_type,
      ownership_proof_url, status, created_at,
      users!seller_id ( id, full_name, city, seller_score, created_at )
    `)
    .eq('id', params.id)
    .eq('status', 'pending')
    .single();

  if (!listing) notFound();

  const sellerRaw = Array.isArray(listing.users) ? listing.users[0] : listing.users;
  const seller = sellerRaw as {
    id: string;
    full_name: string | null;
    city: string | null;
    seller_score: number;
    created_at: string;
  } | null;

  const inclusions = listing.inclusions as Record<string, boolean>;
  const includedItems = Object.entries(inclusions).filter(([, v]) => v).map(([k]) => k);
  const excludedItems = Object.entries(inclusions).filter(([, v]) => !v).map(([k]) => k);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/listings" className="text-sm text-text-2 hover:text-foreground">
          ← Back to queue
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: listing details */}
        <div className="space-y-6">
          {/* Photos */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Photos</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {listing.photos.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="aspect-square w-full rounded-lg object-cover transition-opacity hover:opacity-80"
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Core details */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-heading text-xl font-bold text-foreground">{listing.product_name}</h1>
                <p className="text-sm text-text-2">{listing.brand} · {listing.category.replace('_', '+')}</p>
              </div>
              <div className={['rounded-lg border px-3 py-1 text-center', conditionColors[listing.condition_grade]].join(' ')}>
                <p className="font-mono text-xl font-bold">{listing.condition_grade}</p>
                <p className="text-xs">{conditionLabels[listing.condition_grade]}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-text-2">Asking price</p>
                <p className="font-mono font-bold text-accent">{formatPrice(listing.asking_price)}</p>
              </div>
              <div>
                <p className="text-xs text-text-2">Floor price</p>
                <p className="font-mono font-bold text-foreground">
                  {listing.floor_price ? formatPrice(listing.floor_price) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-2">Negotiable</p>
                <p className="text-sm font-medium text-foreground">{listing.is_negotiable ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {listing.condition_notes && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-1 text-xs text-text-2">Condition notes</p>
                <p className="text-sm text-foreground">{listing.condition_notes}</p>
              </div>
            )}

            {listing.known_defects && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-1 text-xs text-text-2">Known defects</p>
                <p className="text-sm text-error">{listing.known_defects}</p>
              </div>
            )}
          </div>

          {/* Inclusions */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Inclusions</h2>
            <div className="space-y-1.5">
              {includedItems.map((item) => (
                <p key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="text-success">✓</span> {item}
                </p>
              ))}
              {excludedItems.map((item) => (
                <p key={item} className="flex items-center gap-2 text-sm text-text-2">
                  <span className="text-error">✗</span> {item}
                </p>
              ))}
            </div>
          </div>

          {/* Ownership proof */}
          {listing.ownership_proof_type && listing.ownership_proof_type !== 'none' && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Ownership Proof</h2>
              <p className="mb-2 text-sm text-text-2 capitalize">{listing.ownership_proof_type}</p>
              {listing.ownership_proof_url && (
                <a
                  href={listing.ownership_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent underline hover:no-underline"
                >
                  View proof document →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right: seller info + review actions */}
        <div className="space-y-6">
          {/* Seller card */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Seller</h2>
            <p className="font-medium text-foreground">{seller?.full_name ?? 'Unknown'}</p>
            {seller?.city && <p className="text-sm text-text-2">{seller.city}</p>}
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
              <div>
                <p className="text-xs text-text-2">Seller score</p>
                <p className="font-mono font-bold text-foreground">{seller?.seller_score ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-2">Member since</p>
                <p className="text-sm text-foreground">
                  {seller?.created_at ? formatDate(seller.created_at) : '—'}
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs text-text-2">Submitted</p>
              <p className="text-sm text-foreground">{formatDate(listing.created_at)}</p>
            </div>
          </div>

          <ReviewActions listingId={listing.id} />
        </div>
      </div>
    </div>
  );
}
