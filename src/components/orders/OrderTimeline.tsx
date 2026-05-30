import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/utils/formatting';

/**
 * OrderTimeline — server component rendering the merged audit history
 * for one order: order_events + shipment_events ordered by occurred_at.
 *
 * Source of truth is the audit tables (PR #2 marketplace_core +
 * migration 007 shipping_substrate), not the orders.status field. The
 * timeline shows what *happened*, in order, with timestamps — distinct
 * from the linear "stage" tracker on /orders/purchase/[orderId] which
 * shows where the order *is*. Both surfaces have a place; this one is
 * the debugging-and-trust surface.
 *
 * Used by:
 *   - Buyer order detail (/orders/purchase/[orderId])
 *   - Seller dashboard order detail (/dashboard/orders/[orderId])
 *   - Admin order monitor
 */

interface Props {
  orderId: string;
  /** When false, the shipment-event subset is hidden. Default true. */
  showShipmentEvents?: boolean;
}

interface OrderEventRow {
  event_name:  string;
  from_status: string | null;
  to_status:   string | null;
  created_at:  string;
}

interface ShipmentEventRow {
  event_name:  string;
  from_status: string | null;
  to_status:   string | null;
  description: string | null;
  location:    string | null;
  occurred_at: string;
}

interface TimelineEntry {
  kind:        'order' | 'shipment';
  occurredAt:  string;
  title:       string;
  detail:      string | null;
}

export async function OrderTimeline({ orderId, showShipmentEvents = true }: Props) {
  const admin = createAdminClient();

  const { data: orderEvents } = await admin
    .from('order_events')
    .select('event_name, from_status, to_status, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .returns<OrderEventRow[]>();

  let shipmentEvents: ShipmentEventRow[] | null = [];
  if (showShipmentEvents) {
    const { data: shipment } = await admin
      .from('shipments')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (shipment) {
      const { data } = await admin
        .from('shipment_events')
        .select('event_name, from_status, to_status, description, location, occurred_at')
        .eq('shipment_id', shipment.id)
        .order('occurred_at', { ascending: true })
        .returns<ShipmentEventRow[]>();
      shipmentEvents = data;
    }
  }

  const merged: TimelineEntry[] = [
    ...(orderEvents ?? []).map((e): TimelineEntry => ({
      kind:       'order',
      occurredAt: e.created_at,
      title:      orderEventTitle(e.event_name, e.from_status, e.to_status),
      detail:     statusTransition(e.from_status, e.to_status),
    })),
    ...(shipmentEvents ?? []).map((e): TimelineEntry => ({
      kind:       'shipment',
      occurredAt: e.occurred_at,
      title:      shipmentEventTitle(e.event_name, e.from_status, e.to_status),
      detail:     [e.description, e.location].filter(Boolean).join(' · ') || null,
    })),
  ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  if (merged.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground">
        No timeline events yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Timeline
      </h2>
      <ol className="space-y-4">
        {merged.map((entry, i) => (
          <li key={`${entry.kind}-${i}`} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  entry.kind === 'order'
                    ? 'bg-accent text-black'
                    : 'bg-success text-black',
                ].join(' ')}
                aria-hidden="true"
              >
                {entry.kind === 'order' ? '●' : '✦'}
              </div>
              {i < merged.length - 1 && (
                <div className="mt-1 h-6 w-px flex-1 bg-border" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-sm font-medium text-foreground">{entry.title}</p>
              {entry.detail && (
                <p className="text-xs text-muted-foreground">{entry.detail}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(entry.occurredAt)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Title helpers ─────────────────────────────────────────────

function orderEventTitle(
  name: string,
  from: string | null,
  to: string | null,
): string {
  switch (name) {
    case 'order_created':       return 'Order placed';
    case 'payment_captured':    return 'Payment captured';
    case 'payment_failed':      return 'Payment failed';
    case 'order_cancelled':     return 'Order cancelled';
    case 'shipment_created':    return 'Seller booked shipment';
    case 'shipped':             return 'Shipped';
    case 'delivered':           return 'Delivered';
    case 'inspection_started':  return 'Inspection window started';
    case 'completed':           return 'Order completed';
    case 'disputed':            return 'Dispute raised';
    case 'refunded':            return 'Refunded';
    case 'partially_refunded':  return 'Partially refunded';
    case 'admin_recovery_override': return 'Admin recovery override';
    default:
      if (to) return `Status: ${to}`;
      if (from) return `Was: ${from}`;
      return name.replace(/_/g, ' ');
  }
}

function shipmentEventTitle(
  name: string,
  _from: string | null,
  to: string | null,
): string {
  if (name === 'shipment_created') return 'Shipment booked';
  switch (to) {
    case 'picked_up':        return 'Picked up by courier';
    case 'in_transit':       return 'In transit';
    case 'out_for_delivery': return 'Out for delivery';
    case 'delivered':        return 'Delivered';
    case 'failed':           return 'Delivery failed';
    case 'cancelled':        return 'Shipment cancelled';
    default:                 return name.replace(/_/g, ' ');
  }
}

function statusTransition(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  if (from && to) return `${from} → ${to}`;
  return to ?? from;
}
