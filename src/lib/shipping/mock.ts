import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CreateShipmentInput,
  ShipmentRecord,
  ShipmentStatus,
  ShippingProvider,
  TrackingEvent,
  TrackingSnapshot,
} from './provider';

/**
 * MockShippingProvider — synthetic courier for V1 validation without
 * Shiprocket credentials.
 *
 * Persists shipment records in the `mock_shipments` table (added by
 * migration 007) so tracking is durable across requests. Real
 * Shiprocket integration will swap to API calls; consumers don't
 * change.
 *
 * Selection: the factory in factory.ts returns this whenever
 * SHIPROCKET_EMAIL is unset OR SHIPPING_PROVIDER=mock.
 */
export class MockShippingProvider implements ShippingProvider {
  readonly name = 'mock';
  readonly isSynthetic = true;

  async createShipment(input: CreateShipmentInput): Promise<ShipmentRecord> {
    const admin = createAdminClient();
    const awb = generateAwb();
    const now = new Date().toISOString();
    // Estimate 5 days out — enough that "estimated_delivery" feels
    // realistic in the order timeline without being arbitrary.
    const eta = isoDate(addDays(new Date(), 5));

    const initialEvent: TrackingEvent = {
      status:      'created',
      occurredAt:  now,
      description: 'Shipment booked. Awaiting pickup.',
      location:    `${input.pickup.city} hub`,
    };

    const { error } = await admin.from('mock_shipments').insert({
      awb,
      provider_order_id:    `mock_order_${randomHex(8)}`,
      provider_shipment_id: `mock_ship_${randomHex(8)}`,
      courier:              'Mock Courier',
      order_id:             input.orderId,
      status:               'created',
      estimated_delivery:   eta,
      pickup_city:          input.pickup.city,
      delivery_city:        input.delivery.city,
      declared_value_paise: input.declaredValuePaise,
      events:               [initialEvent],
    });

    if (error) throw new Error(`mock_shipments insert failed: ${error.message}`);

    return {
      awb,
      providerShipmentId: `mock_ship_${awb}`,
      providerOrderId:    `mock_order_${awb}`,
      courier:            'Mock Courier',
      status:             'created',
      estimatedDelivery:  eta,
    };
  }

  async getTracking(awb: string): Promise<TrackingSnapshot | null> {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('mock_shipments')
      .select('awb, status, estimated_delivery, events, updated_at')
      .eq('awb', awb)
      .maybeSingle();

    if (!row) return null;

    const events = (row.events ?? []) as TrackingEvent[];
    const latest = events[events.length - 1];

    return {
      awb:               row.awb,
      status:            row.status as ShipmentStatus,
      location:          latest?.location ?? null,
      lastUpdatedAt:     row.updated_at ?? latest?.occurredAt ?? new Date().toISOString(),
      estimatedDelivery: row.estimated_delivery ?? null,
      history:           events,
    };
  }

  async advanceTracking(awb: string, toStatus: ShipmentStatus): Promise<TrackingSnapshot> {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('mock_shipments')
      .select('awb, status, events, delivery_city')
      .eq('awb', awb)
      .single();

    if (!row) throw new Error(`mock shipment not found: ${awb}`);

    const events: TrackingEvent[] = (row.events ?? []) as TrackingEvent[];
    if (!isValidTransition(row.status as ShipmentStatus, toStatus)) {
      throw new Error(
        `invalid mock-shipment transition: ${row.status} → ${toStatus}`,
      );
    }

    const now = new Date().toISOString();
    const newEvent: TrackingEvent = {
      status:      toStatus,
      occurredAt:  now,
      description: descriptionFor(toStatus),
      location:    locationFor(toStatus, row.delivery_city ?? 'destination'),
    };

    const updatedEvents = [...events, newEvent];

    const { error } = await admin
      .from('mock_shipments')
      .update({
        status:     toStatus,
        events:     updatedEvents,
        updated_at: now,
      })
      .eq('awb', awb);

    if (error) throw new Error(`mock_shipments update failed: ${error.message}`);

    return {
      awb,
      status:            toStatus,
      location:          newEvent.location,
      lastUpdatedAt:     now,
      estimatedDelivery: null, // unchanged from create; getTracking re-reads
      history:           updatedEvents,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function generateAwb(): string {
  // Format: TEST-XXXXXXXX-YYY  (uppercase hex + 3-digit suffix).
  // Distinguishable from any real courier AWB but uniquely structured
  // so it can be tracked.
  const main = randomHex(4).toUpperCase();
  const tail = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `TEST-${main}-${tail}`;
}

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Mock shipment lifecycle — same shape as a real courier so the
 * timeline and admin tooling don't have to know it's synthetic.
 */
const TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  created:          ['picked_up', 'cancelled'],
  picked_up:        ['in_transit', 'failed'],
  in_transit:       ['out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  delivered:        [],
  failed:           [],
  cancelled:        [],
};

function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

function descriptionFor(status: ShipmentStatus): string {
  switch (status) {
    case 'picked_up':        return 'Picked up from seller';
    case 'in_transit':       return 'In transit through courier network';
    case 'out_for_delivery': return 'Out for delivery';
    case 'delivered':        return 'Delivered';
    case 'failed':           return 'Delivery failed';
    case 'cancelled':        return 'Shipment cancelled';
    case 'created':          return 'Shipment booked';
  }
}

function locationFor(status: ShipmentStatus, deliveryCity: string): string {
  switch (status) {
    case 'picked_up':        return 'Origin hub';
    case 'in_transit':       return 'In transit';
    case 'out_for_delivery': return `${deliveryCity} delivery hub`;
    case 'delivered':        return deliveryCity;
    case 'failed':           return 'Courier hub';
    case 'cancelled':        return 'Courier hub';
    case 'created':          return 'Origin hub';
  }
}
