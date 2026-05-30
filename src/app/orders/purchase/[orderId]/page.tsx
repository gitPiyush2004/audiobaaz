import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { DisputeForm } from './DisputeForm';
import { AdvanceOrderButton } from './AdvanceOrderButton';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { ShipmentTracking } from '@/components/orders/ShipmentTracking';

interface Props {
  params: { orderId: string };
}

const STEPS = [
  { key: 'escrow_held',      label: 'Payment received',     sub: 'Funds held in escrow' },
  { key: 'seller_confirmed', label: 'Seller confirmed',     sub: 'Item packed and ready' },
  { key: 'shipped',          label: 'Shipped',              sub: 'In transit to you' },
  { key: 'inspection',       label: 'Delivered',            sub: '48hr inspection window' },
  { key: 'completed',        label: 'Completed',            sub: 'Payout released to seller' },
];

const STATUS_ORDER = ['escrow_held', 'seller_confirmed', 'shipped', 'inspection', 'completed'];

function stepState(stepKey: string, currentStatus: string): 'done' | 'active' | 'upcoming' {
  if (currentStatus === 'disputed' || currentStatus === 'refunded') {
    const disputedAt = STATUS_ORDER.indexOf('inspection');
    const stepIdx    = STATUS_ORDER.indexOf(stepKey);
    if (stepIdx < disputedAt) return 'done';
    if (stepIdx === disputedAt) return 'active';
    return 'upcoming';
  }
  const current = STATUS_ORDER.indexOf(currentStatus);
  const step    = STATUS_ORDER.indexOf(stepKey);
  if (step < current)  return 'done';
  if (step === current) return 'active';
  return 'upcoming';
}

function hoursLeft(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
}

export default async function OrderDetailPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (createAdminClient() as any)
    .from('orders')
    .select(`
      id, paid_price, platform_fee, seller_payout, shipping_fee,
      status, delivery_name, delivery_phone,
      delivery_line1, delivery_line2, delivery_city, delivery_pincode, delivery_state,
      delivered_at, inspection_expires_at, created_at,
      listings(brand, product_name, condition_grade, photos, slug)
    `)
    .eq('id', params.orderId)
    .eq('buyer_id', user.id)
    .single();

  if (!order) notFound();

  const listing       = Array.isArray(order.listings) ? order.listings[0] : order.listings;
  const isDev         = process.env.NODE_ENV !== 'production';
  const canDispute    = order.status === 'inspection' &&
    order.inspection_expires_at &&
    new Date(order.inspection_expires_at) > new Date();
  const isDisputed    = order.status === 'disputed' || order.status === 'refunded';
  const inspectHours  = order.inspection_expires_at ? hoursLeft(order.inspection_expires_at) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/orders/purchases"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        ← My Orders
      </Link>

      <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">Order details</h1>
      <p className="mb-6 font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>

      {/* Listing card */}
      {listing && (
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
            {listing.photos?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.photos[0]} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{listing.brand} {listing.product_name}</p>
            <p className="text-xs text-muted-foreground">Grade {listing.condition_grade}</p>
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold text-accent">
            {formatPrice(order.paid_price)}
          </span>
        </div>
      )}

      {/* Status timeline */}
      {!isDisputed ? (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</h2>
          <ol className="space-y-4">
            {STEPS.map((step, i) => {
              const state = stepState(step.key, order.status);
              return (
                <li key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      state === 'done'     ? 'bg-success text-black'          : '',
                      state === 'active'   ? 'bg-accent text-black'           : '',
                      state === 'upcoming' ? 'border border-border text-muted-foreground' : '',
                    ].join(' ')}>
                      {state === 'done' ? '✓' : i + 1}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={['mt-1 w-px flex-1 h-6', state === 'done' ? 'bg-success/40' : 'bg-border'].join(' ')} />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className={['text-sm font-medium', state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'].join(' ')}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.sub}</p>
                    {step.key === 'inspection' && state === 'active' && (
                      <p className="mt-0.5 text-xs text-warning font-medium">
                        {inspectHours > 0 ? `${inspectHours}h left to inspect` : 'Window expiring soon'}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-error/30 bg-error/5 p-5">
          <p className="font-semibold text-error">Dispute raised</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team is reviewing your case. We&apos;ll notify you once resolved.
          </p>
        </div>
      )}

      {/* Dispute action */}
      {canDispute && <div className="mb-6"><DisputeForm orderId={order.id} /></div>}

      {/* Shipment tracking (only when a shipment has been created) */}
      <div className="mb-6">
        <ShipmentTracking orderId={order.id} />
      </div>

      {/* Full audit timeline */}
      <div className="mb-6">
        <OrderTimeline orderId={order.id} />
      </div>

      {/* Price breakdown */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 text-sm space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Payment</h2>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Item price</span>
          <span className="font-mono text-foreground">{formatPrice(order.paid_price)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Platform fee (10%)</span>
          <span className="font-mono text-foreground">{formatPrice(order.platform_fee)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <span className="text-foreground">Total paid</span>
          <span className="font-mono text-accent">{formatPrice(order.paid_price)}</span>
        </div>
      </div>

      {/* Delivery address */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 text-sm space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Delivering to</h2>
        <p className="font-medium text-foreground">{order.delivery_name}</p>
        <p className="text-muted-foreground">{order.delivery_phone}</p>
        <p className="text-muted-foreground">{order.delivery_line1}</p>
        {order.delivery_line2 && <p className="text-muted-foreground">{order.delivery_line2}</p>}
        <p className="text-muted-foreground">
          {order.delivery_city}, {order.delivery_state} – {order.delivery_pincode}
        </p>
      </div>

      {/* Order meta */}
      <div className="rounded-xl border border-border bg-surface p-5 text-sm space-y-2 text-muted-foreground">
        <div className="flex justify-between">
          <span>Order placed</span>
          <span>{formatDate(order.created_at)}</span>
        </div>
        {order.delivered_at && (
          <div className="flex justify-between">
            <span>Delivered</span>
            <span>{formatDate(order.delivered_at)}</span>
          </div>
        )}
      </div>

      {/* Dev tools */}
      {isDev && (order.status === 'escrow_held' || order.status === 'seller_confirmed' || order.status === 'shipped') && (
        <div className="mt-8 rounded-xl border border-dashed border-warning/40 bg-warning/5 p-4">
          <p className="mb-3 text-xs font-semibold text-warning">⚡ Dev tools</p>
          <AdvanceOrderButton orderId={order.id} />
        </div>
      )}
    </div>
  );
}
