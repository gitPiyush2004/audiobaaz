/**
 * ShippingProvider — abstraction over the courier integration.
 *
 * V1 has two implementations:
 *
 *   - MockShippingProvider (src/lib/shipping/mock.ts)
 *     Returns deterministic synthetic AWBs and tracking states.
 *     Default in non-production environments and any deploy that
 *     hasn't configured Shiprocket credentials. Lets us build the
 *     entire shipment + delivery + escrow-release lifecycle without
 *     real Shiprocket access.
 *
 *   - ShiprocketProvider (not yet built)
 *     Real Shiprocket integration. Drops in once SHIPROCKET_EMAIL +
 *     SHIPROCKET_PASSWORD are configured. No caller-side changes —
 *     route handlers call provider.createShipment() and
 *     provider.getTracking() exactly the same way.
 *
 * The interface is intentionally narrow: only the operations the
 * routes actually invoke. createShipment, getTracking,
 * advanceTracking (mock-only). New providers add an implementation;
 * the routes don't change.
 */

export interface CreateShipmentInput {
  /** Audiobaaz order id — round-tripped into provider notes for forensics. */
  orderId: string;
  /** Pickup address (seller). */
  pickup: ShipmentAddress;
  /** Drop-off address (buyer — copied from orders.delivery_*). */
  delivery: ShipmentAddress;
  /** Item description for courier paperwork. */
  itemName: string;
  /** Declared value in paise (matches orders.paid_price). */
  declaredValuePaise: number;
}

export interface ShipmentAddress {
  name:    string;
  phone:   string;
  line1:   string;
  line2?:  string | null;
  city:    string;
  pincode: string;
  state:   string;
}

export interface ShipmentRecord {
  /** AWB / tracking number. Unique per shipment within the provider. */
  awb: string;
  /** Provider-side shipment id (e.g. Shiprocket shipment_id). May equal awb. */
  providerShipmentId: string;
  /** Provider-side order id (e.g. Shiprocket order_id). May be empty for mock. */
  providerOrderId: string;
  /** Courier company name (e.g. "Delhivery", or "Mock Courier"). */
  courier: string;
  /** Initial status when the shipment is created. */
  status: ShipmentStatus;
  /** Estimated delivery date (ISO date string, YYYY-MM-DD). Null if unknown. */
  estimatedDelivery: string | null;
}

export type ShipmentStatus =
  | 'created'         // shipment booked at courier
  | 'picked_up'       // courier picked up from seller
  | 'in_transit'      // package moving through courier network
  | 'out_for_delivery'// final mile started
  | 'delivered'       // package delivered to buyer
  | 'failed'          // delivery failed (RTO, refused, lost)
  | 'cancelled';      // shipment cancelled before pickup

/**
 * A snapshot of where a shipment is right now, plus the audit trail
 * of state transitions. Returned by getTracking().
 */
export interface TrackingSnapshot {
  awb: string;
  status: ShipmentStatus;
  /** Current location string (e.g. "Mumbai Hub"). May be empty. */
  location: string | null;
  /** Provider-attributed timestamp of the latest event (ISO). */
  lastUpdatedAt: string;
  /** Estimated delivery date if known (ISO date). */
  estimatedDelivery: string | null;
  /** Full event history, oldest → newest. */
  history: TrackingEvent[];
}

export interface TrackingEvent {
  status:    ShipmentStatus;
  /** ISO timestamp the event occurred. */
  occurredAt: string;
  /** Provider-supplied description of what happened. */
  description: string;
  /** Location string if available. */
  location: string | null;
}

export interface ShippingProvider {
  /** Provider name for logging / audit. 'mock' | 'shiprocket'. */
  readonly name: string;

  /** True for mock; false for real couriers. */
  readonly isSynthetic: boolean;

  /** Create a shipment at the courier. */
  createShipment(input: CreateShipmentInput): Promise<ShipmentRecord>;

  /** Get the latest tracking snapshot for an AWB. */
  getTracking(awb: string): Promise<TrackingSnapshot | null>;

  /**
   * Mock-only: advance an in-progress shipment to a target status
   * (and record an intermediate event for the timeline). Throws on
   * real providers — only the courier can move a real shipment.
   *
   * The dev advance-shipment endpoint exposes this for development.
   */
  advanceTracking?(awb: string, toStatus: ShipmentStatus): Promise<TrackingSnapshot>;
}
