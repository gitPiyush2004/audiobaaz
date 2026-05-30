import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/utils/formatting';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { ShipmentTracking } from '@/components/orders/ShipmentTracking';
import { CreateShipmentButton } from './CreateShipmentButton';
import { AdvanceShipmentButton } from './AdvanceShipmentButton';

interface Props {
  params: { orderId: string };
}

const statusColor: Record<string, string> = {
  payment_pending:    'text-warning',
  payment_failed:     'text-error',
  escrow_held:        'text-info',
  seller_confirmed:   'text-info',
  shipped:            'text-info',
  delivered:          'text-info',
  inspection:         'text-warning',
  completed:          'text-success',
  disputed:           'text-error',
  refunded:           'text-error',
  cancelled:          'text-muted-foreground',
};

export default async function SellerOrderDetailPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select(`
      id, status, paid_price, platform_fee, seller_payout, shipping_fee,
      delivery_name, delivery_phone, delivery_line1, delivery_line2,
      delivery_city, delivery_pincode, delivery_state,
      tracking_number, courier_name, estimated_delivery,
      escrow_held_at, shipped_at, delivered_at, inspection_expires_at,
      created_at,
      listings(brand, product_name, condition_grade, photos)
    `)
    .eq('id', params.orderId)
    .eq('seller_id', user.id)
    .single();

  if (!order) notFound();

  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings;

  // Look up shipment for the dev advance buttons.
  const { data: shipment } = await admin
    .from('shipments')
    .select('awb, status')
    .eq('order_id', order.id)
    .maybeSingle();

  const isDev = process.env.NODE_ENV !== 'production';
  const canCreateShipment =
    order.status === 'escrow_held' && !shipment;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard/orders"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        ← All orders
      </Link>

      <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">Order details</h1>
      <p className="mb-6 font-mono text-xs text-muted-foreground">
        #{order.id.slice(0, 8).toUpperCase()}
      </p>

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
            <p className="truncate font-medium text-foreground">
              {listing.brand} {listing.product_name}
            </p>
            <p className="text-xs text-muted-foreground">Grade {listing.condition_grade}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-semibold text-accent">
              {formatPrice(order.seller_payout)}
            </p>
            <p className="text-[10px] text-muted-foreground">your payout</p>
          </div>
        </div>
      )}

      {/* Status badge */}
      <p className={`mb-6 text-sm font-semibold uppercase tracking-wide ${statusColor[order.status] ?? 'text-muted-foreground'}`}>
        {order.status.replace(/_/g, ' ')}
      </p>

      {/* Action: Create shipment */}
      {canCreateShipment && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
          <h2 className="text-sm font-semibold text-foreground">Ship this order</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pack the item with care. Recording a packing video is recommended.
            Once you book the shipment, the buyer will receive tracking info.
          </p>
          <div className="mt-4">
            <CreateShipmentButton orderId={order.id} />
          </div>
        </div>
      )}

      {/* Shipment tracking */}
      {shipment && (
        <div className="mb-6">
          <ShipmentTracking orderId={order.id} />
        </div>
      )}

      {/* Dev tools — advance the mock shipment */}
      {isDev && shipment && shipment.status !== 'delivered' && shipment.status !== 'failed' && shipment.status !== 'cancelled' && (
        <div className="mb-6 rounded-xl border border-dashed border-warning/40 bg-warning/5 p-4">
          <p className="mb-3 text-xs font-semibold text-warning">⚡ Dev tools — advance mock shipment</p>
          <AdvanceShipmentButton awb={shipment.awb} currentStatus={shipment.status} />
        </div>
      )}

      {/* Full audit timeline */}
      <div className="mb-6">
        <OrderTimeline orderId={order.id} />
      </div>

      {/* Delivery address */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 text-sm space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Ship to
        </h2>
        <p className="font-medium text-foreground">{order.delivery_name}</p>
        <p className="text-muted-foreground">{order.delivery_phone}</p>
        <p className="text-muted-foreground">{order.delivery_line1}</p>
        {order.delivery_line2 && <p className="text-muted-foreground">{order.delivery_line2}</p>}
        <p className="text-muted-foreground">
          {order.delivery_city}, {order.delivery_state} – {order.delivery_pincode}
        </p>
      </div>

      {/* Payout summary */}
      <div className="rounded-xl border border-border bg-surface p-5 text-sm space-y-2">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Payout
        </h2>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Buyer paid</span>
          <span className="font-mono text-foreground">{formatPrice(order.paid_price)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Platform fee (10%)</span>
          <span className="font-mono text-foreground">−{formatPrice(order.platform_fee)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <span className="text-foreground">Your payout</span>
          <span className="font-mono text-accent">{formatPrice(order.seller_payout)}</span>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          Released after the buyer&apos;s 48h inspection window expires without dispute.
        </p>
      </div>
    </div>
  );
}
