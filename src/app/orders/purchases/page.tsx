export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice, formatDate } from '@/lib/utils/formatting';

export const metadata = { title: 'My Orders — Audiobaaz' };

const STATUS_LABEL: Record<string, string> = {
  payment_pending:  'Pending payment',
  escrow_held:      'Paid · Awaiting shipment',
  seller_confirmed: 'Seller confirmed',
  shipped:          'Shipped',
  delivered:        'Delivered',
  inspection:       'Under inspection',
  completed:        'Completed',
  disputed:         'Disputed',
  refunded:         'Refunded',
};

const STATUS_COLOR: Record<string, string> = {
  escrow_held:      'text-warning',
  seller_confirmed: 'text-warning',
  shipped:          'text-info',
  delivered:        'text-info',
  inspection:       'text-warning',
  completed:        'text-success',
  disputed:         'text-error',
  refunded:         'text-muted-foreground',
};

export default async function PurchasesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/orders/purchases');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = await (createAdminClient() as any)
    .from('orders')
    .select('id, paid_price, status, created_at, listings!listing_id(brand, product_name, condition_grade, photos, slug)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-2xl font-bold text-foreground">My Orders</h1>

      {!orders?.length ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">You haven&apos;t bought anything yet.</p>
          <Link
            href="/browse"
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-black transition-all hover:bg-accent-hover"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: {
            id: string;
            paid_price: number;
            status: string;
            created_at: string;
            listings: { brand: string; product_name: string; condition_grade: string; photos: string[]; slug: string } | null;
          }) => {
            const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings;
            return (
              <Link
                key={order.id}
                href={`/orders/purchase/${order.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                  {listing?.photos?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.photos[0]} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {listing ? `${listing.brand} ${listing.product_name}` : 'Listing unavailable'}
                  </p>
                  <p className={`mt-0.5 text-xs ${STATUS_COLOR[order.status] ?? 'text-muted-foreground'}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                  {formatPrice(order.paid_price)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
