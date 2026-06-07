import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/utils/formatting';

/**
 * ShipmentTracking — server component summarising the current shipment
 * state for an order. Reads `shipments` directly; for live courier
 * snapshots use /api/shipping/track from a client component.
 *
 * Renders nothing if the order has no shipment yet (e.g. still in
 * payment_pending or escrow_held).
 */

interface Props {
  orderId: string;
}

interface Row {
  awb: string;
  courier: string;
  status: string;
  estimated_delivery: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}

export async function ShipmentTracking({ orderId }: Props) {
  const admin = createAdminClient();
  const { data: shipment } = await admin
    .from('shipments')
    .select('awb, courier, status, estimated_delivery, picked_up_at, delivered_at')
    .eq('order_id', orderId)
    .maybeSingle<Row>();

  if (!shipment) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 text-sm space-y-2">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Shipping
      </h2>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Courier</span>
        <span className="text-foreground">{shipment.courier}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Tracking #</span>
        <span className="font-mono text-foreground">{shipment.awb}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Status</span>
        <span className="text-foreground">{humanStatus(shipment.status)}</span>
      </div>
      {shipment.estimated_delivery && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Estimated delivery</span>
          <span className="text-foreground">{formatDate(shipment.estimated_delivery)}</span>
        </div>
      )}
    </div>
  );
}

function humanStatus(s: string): string {
  switch (s) {
    case 'created':          return 'Booked, awaiting pickup';
    case 'picked_up':        return 'Picked up';
    case 'in_transit':       return 'In transit';
    case 'out_for_delivery': return 'Out for delivery';
    case 'delivered':        return 'Delivered';
    case 'failed':           return 'Delivery failed';
    case 'cancelled':        return 'Cancelled';
    default:                 return s;
  }
}
