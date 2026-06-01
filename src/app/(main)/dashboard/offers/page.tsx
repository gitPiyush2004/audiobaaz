import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { redirect } from 'next/navigation';
import { OfferActions } from './OfferActions';

export const metadata = { title: 'Offers — Audiobaaz' };

function timeRemaining(deadline: string | null): string | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

const statusColor: Record<string, string> = {
  pending:   'text-warning',
  accepted:  'text-success',
  declined:  'text-error',
  expired:   'text-dim-foreground',
  paid:      'text-info',
  cancelled: 'text-dim-foreground',
};

export default async function OffersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: offers } = await supabase
    .from('offers')
    .select('id, offered_price, status, created_at, seller_must_respond_by, listings!listing_id(product_name, brand)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  const pending = offers?.filter(o => o.status === 'pending') ?? [];
  const past    = offers?.filter(o => o.status !== 'pending') ?? [];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Offers</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You have 24 hours to respond to each offer. First buyer to pay after acceptance wins.
      </p>

      {/* pending offers */}
      <div className="mt-8">
        <h2 className="mb-4 font-heading text-base font-semibold text-foreground">
          Pending <span className="ml-1 text-muted-foreground">({pending.length})</span>
        </h2>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">No pending offers.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(o => {
              const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings;
              const remaining = timeRemaining(o.seller_must_respond_by);
              return (
                <div key={o.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {listing?.brand} {listing?.product_name}
                      </p>
                      <p className="mt-1 font-mono text-lg font-bold text-accent">
                        {formatPrice(o.offered_price)}
                      </p>
                      {remaining && (
                        <p className="mt-1 text-xs text-warning">{remaining} to respond</p>
                      )}
                    </div>
                    <OfferActions offerId={o.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* past offers */}
      {past.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 font-heading text-base font-semibold text-foreground">Past offers</h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {past.map(o => {
              const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings;
              return (
                <div key={o.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {listing?.brand} {listing?.product_name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-mono text-sm text-foreground">{formatPrice(o.offered_price)}</span>
                    <span className={`text-xs font-medium capitalize ${statusColor[o.status] ?? 'text-muted-foreground'}`}>
                      {o.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
