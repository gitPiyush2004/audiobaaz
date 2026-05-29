import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { ResolveActions } from './ResolveActions';

const reasonLabels: Record<string, string> = {
  condition_mismatch:  'Condition mismatch',
  non_functional:      'Non-functional',
  missing_accessory:   'Missing accessory',
  not_received:        'Not received',
  wrong_item:          'Wrong item',
};

export default async function AdminDisputeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const { data: dispute } = await supabase
    .from('disputes')
    .select(`
      id, reason, description, evidence_urls, status, admin_notes,
      resolution, refund_amount, created_at,
      orders!order_id (
        id, paid_price, listing_price, shipping_fee, status,
        listings!listing_id ( product_name, brand, photos )
      ),
      buyers:users!buyer_id   ( full_name, city, buyer_score ),
      sellers:users!seller_id ( full_name, city, seller_score )
    `)
    .eq('id', params.id)
    .in('status', ['open', 'under_review'])
    .single();

  if (!dispute) notFound();

  const order   = (Array.isArray(dispute.orders)  ? dispute.orders[0]  : dispute.orders)  as any;
  const listing = (Array.isArray(order?.listings) ? order.listings[0]  : order?.listings) as any;
  const buyer   = (Array.isArray(dispute.buyers)  ? dispute.buyers[0]  : dispute.buyers)  as any;
  const seller  = (Array.isArray(dispute.sellers) ? dispute.sellers[0] : dispute.sellers) as any;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/disputes" className="text-sm text-text-2 hover:text-foreground">
          ← Back to disputes
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: dispute details */}
        <div className="space-y-6">
          {/* Claim */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h1 className="mb-1 font-heading text-xl font-bold text-foreground">
              {reasonLabels[dispute.reason] ?? dispute.reason}
            </h1>
            <p className="mb-4 text-xs text-text-2">Raised {formatDate(dispute.created_at)}</p>
            <p className="text-sm text-foreground">{dispute.description}</p>
          </div>

          {/* Evidence */}
          {dispute.evidence_urls?.length ? (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Evidence</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {dispute.evidence_urls.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`Evidence ${i + 1}`}
                      className="aspect-square w-full rounded-lg object-cover transition-opacity hover:opacity-80"
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-2 font-heading text-lg font-semibold text-foreground">Evidence</h2>
              <p className="text-sm text-text-2">No evidence submitted.</p>
            </div>
          )}

          {/* Order details */}
          {order && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Order</h2>
              <div className="flex items-center gap-3">
                {listing?.photos?.[0] && (
                  <img
                    src={listing.photos[0]}
                    alt={listing.product_name}
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-foreground">{listing?.product_name}</p>
                  <p className="text-sm text-text-2">{listing?.brand}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-xs text-text-2">Paid price</p>
                  <p className="font-mono font-bold text-foreground">{formatPrice(order.paid_price)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-2">Shipping</p>
                  <p className="font-mono font-bold text-foreground">{formatPrice(order.shipping_fee)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-2">Order status</p>
                  <p className="text-sm capitalize text-foreground">{order.status?.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            {[{ label: 'Buyer', person: buyer, scoreKey: 'buyer_score' }, { label: 'Seller', person: seller, scoreKey: 'seller_score' }].map(({ label, person, scoreKey }) => (
              <div key={label} className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-2">{label}</p>
                <p className="font-medium text-foreground">{person?.full_name ?? 'Unknown'}</p>
                {person?.city && <p className="text-sm text-text-2">{person.city}</p>}
                <p className="mt-2 text-xs text-text-2">
                  Score: <span className="font-mono font-bold text-foreground">{person?.[scoreKey] ?? '—'}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: resolve */}
        <ResolveActions disputeId={dispute.id} paidPrice={order?.paid_price ?? 0} />
      </div>
    </div>
  );
}
