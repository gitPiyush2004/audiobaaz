import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { pickOne } from '@/lib/utils/relations';
import { ResolveActions } from './ResolveActions';

type ListingRow = { product_name: string; brand: string; photos: string[] | null };
type OrderRow = {
  id: string;
  paid_price: number;
  listing_price: number;
  shipping_fee: number;
  status: string | null;
  listings: ListingRow | ListingRow[] | null;
};
type PartyRow = {
  full_name: string | null;
  city: string | null;
  buyer_score?: number | null;
  seller_score?: number | null;
};

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

  const order   = pickOne<OrderRow>(dispute.orders);
  const listing = pickOne<ListingRow>(order?.listings);
  const buyer   = pickOne<PartyRow>(dispute.buyers);
  const seller  = pickOne<PartyRow>(dispute.sellers);

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
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                      <Image
                        src={url}
                        alt={`Evidence ${i + 1}`}
                        fill
                        className="object-cover transition-opacity hover:opacity-80"
                      />
                    </div>
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
                  <Image
                    src={listing.photos[0]}
                    alt={listing.product_name}
                    width={56}
                    height={56}
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
            {([
              { label: 'Buyer',  person: buyer,  score: buyer?.buyer_score   ?? null },
              { label: 'Seller', person: seller, score: seller?.seller_score ?? null },
            ] as const).map(({ label, person, score }) => (
              <div key={label} className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-2">{label}</p>
                <p className="font-medium text-foreground">{person?.full_name ?? 'Unknown'}</p>
                {person?.city && <p className="text-sm text-text-2">{person.city}</p>}
                <p className="mt-2 text-xs text-text-2">
                  Score: <span className="font-mono font-bold text-foreground">{score ?? '—'}</span>
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
