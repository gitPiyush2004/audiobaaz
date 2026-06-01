import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Orders — Audiobaaz' };

const TIMELINE = [
  { key: 'escrow_held',      label: 'Payment received' },
  { key: 'seller_confirmed', label: 'Shipment booked' },
  { key: 'shipped',          label: 'Shipped' },
  { key: 'delivered',        label: 'Delivered' },
  { key: 'inspection',       label: 'Buyer inspection' },
  { key: 'completed',        label: 'Completed' },
];

function stepIndex(status: string): number {
  return TIMELINE.findIndex(s => s.key === status);
}

const statusColor: Record<string, string> = {
  payment_pending: 'text-warning',
  escrow_held:     'text-info',
  shipped:         'text-info',
  delivered:       'text-info',
  inspection:      'text-warning',
  completed:       'text-success',
  disputed:        'text-error',
  refunded:        'text-error',
};

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, paid_price, seller_payout, created_at, shipped_at, tracking_number, courier_name, listings!listing_id(product_name, brand)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Orders appear here after a buyer pays. Pack, ship, and record a packing video before handing off.
      </p>

      <div className="mt-8">
        {!orders?.length ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No orders yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Orders are created when a buyer pays for an accepted offer.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings;
              const current = stepIndex(order.status);
              return (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {listing?.brand} {listing?.product_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-accent">{formatPrice(order.seller_payout)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">your payout</p>
                    </div>
                  </div>

                  {/* status badge */}
                  <p className={`mt-3 text-xs font-semibold uppercase tracking-wide ${statusColor[order.status] ?? 'text-muted-foreground'}`}>
                    {order.status.replace(/_/g, ' ')}
                  </p>

                  {/* timeline */}
                  <div className="mt-4 flex items-center gap-0">
                    {TIMELINE.map((step, i) => {
                      const done    = i <= current;
                      const active  = i === current;
                      return (
                        <div key={step.key} className="flex flex-1 flex-col items-start">
                          <div className="flex w-full items-center">
                            <div className={[
                              'h-2.5 w-2.5 shrink-0 rounded-full border-2',
                              active ? 'border-accent bg-accent' : done ? 'border-accent/40 bg-accent/20' : 'border-border bg-bg',
                            ].join(' ')} />
                            {i < TIMELINE.length - 1 && (
                              <div className={['h-px flex-1', done ? 'bg-accent/30' : 'bg-border'].join(' ')} />
                            )}
                          </div>
                          <p className={['mt-2 text-[10px] leading-tight pr-2', active ? 'text-foreground' : 'text-dim-foreground'].join(' ')}>
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* tracking info */}
                  {order.tracking_number && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      {order.courier_name} · {order.tracking_number}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
