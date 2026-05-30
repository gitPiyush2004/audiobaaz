-- ============================================================
-- Migration 007 — Shipping substrate
-- ============================================================
--
-- Purpose: substrate for the ShippingProvider abstraction.
--   - mock_shipments table: durable storage for the
--     MockShippingProvider so tracking persists across requests.
--   - shipments table: provider-agnostic shipment records linked
--     to orders (1:1 today; 1:N possible if a single order ever
--     splits into multiple parcels).
--   - Status enum aligned with src/lib/shipping/provider.ts
--     ShipmentStatus.
--
-- Order-side shipping columns (orders.tracking_number, courier_name,
-- shiprocket_*) are kept for backward compatibility but are now
-- denormalised projections of the canonical shipments row.
--
-- This migration is additive only — no changes to listings, orders,
-- payments, offers, or any of the locked Phase 1 invariants.
-- ============================================================


-- ── shipments ─────────────────────────────────────────────────
-- Canonical shipment record. One row per shipment booking. Real
-- couriers and the mock provider both write here.
--
-- A shipment is created when the seller initiates "Create shipment"
-- on an escrow_held order. It moves through the lifecycle (created
-- → picked_up → in_transit → out_for_delivery → delivered) via
-- courier-event ingestion (real provider) or admin/dev advance-tracking
-- (mock provider).

CREATE TABLE shipments (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id                UUID NOT NULL UNIQUE REFERENCES orders(id),
  provider                TEXT NOT NULL CHECK (provider IN ('mock', 'shiprocket')),
  awb                     TEXT NOT NULL UNIQUE,
  provider_shipment_id    TEXT NOT NULL,
  provider_order_id       TEXT,
  courier                 TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created', 'picked_up', 'in_transit',
      'out_for_delivery', 'delivered', 'failed', 'cancelled'
    )),
  estimated_delivery      DATE,
  declared_value_paise    INTEGER NOT NULL,
  pickup_city             TEXT NOT NULL,
  delivery_city           TEXT NOT NULL,
  -- Audit timestamps (denormalised for UI; canonical history lives
  -- in shipment_events).
  picked_up_at            TIMESTAMPTZ,
  delivered_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX shipments_order_id ON shipments(order_id);
CREATE INDEX shipments_status   ON shipments(status);
CREATE INDEX shipments_awb      ON shipments(awb);


-- ── shipment_events ───────────────────────────────────────────
-- Audit trail of shipment state transitions. Mirrors order_events
-- in shape — every status change emits one row.

CREATE TABLE shipment_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id  UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  event_name   TEXT NOT NULL,
  from_status  TEXT,
  to_status    TEXT,
  description  TEXT,
  location     TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id     UUID REFERENCES users(id),
  raw_payload  JSONB
);

CREATE INDEX shipment_events_shipment_id ON shipment_events(shipment_id);
CREATE INDEX shipment_events_occurred_at ON shipment_events(occurred_at);


-- ── mock_shipments ────────────────────────────────────────────
-- Backing store for the MockShippingProvider's tracking history.
-- Distinct from `shipments` because mock_shipments is provider-private
-- state (synthesized AWBs, fake courier events). A real
-- ShiprocketProvider would never write here.
--
-- The application-level shipments row (above) holds the canonical
-- handle the rest of the marketplace cares about; mock_shipments
-- holds the synthetic detail the mock provider needs to answer
-- getTracking() calls.

CREATE TABLE mock_shipments (
  awb                  TEXT PRIMARY KEY,
  provider_order_id    TEXT NOT NULL,
  provider_shipment_id TEXT NOT NULL,
  courier              TEXT NOT NULL DEFAULT 'Mock Courier',
  order_id             UUID REFERENCES orders(id),
  status               TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created', 'picked_up', 'in_transit',
      'out_for_delivery', 'delivered', 'failed', 'cancelled'
    )),
  estimated_delivery   DATE,
  pickup_city          TEXT,
  delivery_city        TEXT,
  declared_value_paise INTEGER NOT NULL,
  events               JSONB NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX mock_shipments_order_id ON mock_shipments(order_id);


-- ── RLS — service-role only ────────────────────────────────────
-- Direct access is service-role only. Buyer/seller/admin reads go
-- through the application layer (shipping API routes / order detail
-- pages) which scope to participants. Mock data is purely
-- application-internal.

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_shipments ENABLE ROW LEVEL SECURITY;

-- (No policies = service-role only.)


-- ── Touch updated_at on row update ─────────────────────────────

CREATE OR REPLACE FUNCTION touch_shipment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipments_touch
BEFORE UPDATE ON shipments
FOR EACH ROW EXECUTE FUNCTION touch_shipment_updated_at();

CREATE TRIGGER mock_shipments_touch
BEFORE UPDATE ON mock_shipments
FOR EACH ROW EXECUTE FUNCTION touch_shipment_updated_at();


-- ============================================================
-- record_shipment_created — atomic insert + order-side update
-- ============================================================
--
-- Called by /api/shipping/create after the ShippingProvider returns
-- a successful createShipment result. Atomically:
--   1. Inserts shipments row.
--   2. Inserts shipment_events 'created' row.
--   3. Updates orders.status: escrow_held → seller_confirmed.
--      (We treat "shipment booked" as the seller's confirmation
--       that they're going to fulfil the order.)
--   4. Inserts order_events 'shipment_created' row.
--   5. Denormalises tracking_number, courier_name onto orders.
--
-- Returns: { shipment_id, awb, status }
--
-- Hardened: rejects if order is not escrow_held, or if seller_id
-- does not match p_actor_id. SECURITY DEFINER + service-role-only
-- EXECUTE keeps the invariant tight.
-- ============================================================

CREATE OR REPLACE FUNCTION record_shipment_created(
  p_order_id              UUID,
  p_provider              TEXT,
  p_awb                   TEXT,
  p_provider_shipment_id  TEXT,
  p_provider_order_id     TEXT,
  p_courier               TEXT,
  p_estimated_delivery    DATE,
  p_declared_value_paise  INTEGER,
  p_pickup_city           TEXT,
  p_delivery_city         TEXT,
  p_actor_id              UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order      RECORD;
  v_shipment_id UUID;
BEGIN
  -- ── Lock + validate the order ──────────────────────────────
  SELECT id, seller_id, status, listing_id
    INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found: %', p_order_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.seller_id <> p_actor_id THEN
    RAISE EXCEPTION 'only the seller may create a shipment for this order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_order.status NOT IN ('escrow_held', 'seller_confirmed') THEN
    RAISE EXCEPTION 'order is not in a shippable state (status=%)', v_order.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Insert shipment ────────────────────────────────────────
  INSERT INTO shipments (
    order_id, provider, awb, provider_shipment_id, provider_order_id,
    courier, status, estimated_delivery, declared_value_paise,
    pickup_city, delivery_city
  ) VALUES (
    p_order_id, p_provider, p_awb, p_provider_shipment_id, p_provider_order_id,
    p_courier, 'created', p_estimated_delivery, p_declared_value_paise,
    p_pickup_city, p_delivery_city
  )
  RETURNING id INTO v_shipment_id;

  INSERT INTO shipment_events (
    shipment_id, event_name, from_status, to_status, description, occurred_at, actor_id
  ) VALUES (
    v_shipment_id, 'shipment_created', NULL, 'created', 'Shipment booked', NOW(), p_actor_id
  );

  -- ── Move order forward ─────────────────────────────────────
  IF v_order.status = 'escrow_held' THEN
    UPDATE orders
       SET status = 'seller_confirmed',
           tracking_number = p_awb,
           courier_name = p_courier,
           shiprocket_order_id = p_provider_order_id,
           shiprocket_shipment_id = p_provider_shipment_id,
           estimated_delivery = p_estimated_delivery,
           updated_at = NOW()
     WHERE id = p_order_id;

    INSERT INTO order_events (
      order_id, event_name, from_status, to_status, actor_id, occurred_at
    ) VALUES (
      p_order_id, 'shipment_created', 'escrow_held', 'seller_confirmed', p_actor_id, NOW()
    );
  ELSE
    -- Order was already seller_confirmed (rare retry path); just
    -- denormalise the new tracking info without re-emitting an event.
    UPDATE orders
       SET tracking_number = p_awb,
           courier_name = p_courier,
           shiprocket_order_id = p_provider_order_id,
           shiprocket_shipment_id = p_provider_shipment_id,
           estimated_delivery = p_estimated_delivery,
           updated_at = NOW()
     WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'shipment_id', v_shipment_id,
    'awb',         p_awb,
    'status',      'created'
  );
END;
$$;

ALTER FUNCTION record_shipment_created(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INTEGER, TEXT, TEXT, UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION record_shipment_created(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INTEGER, TEXT, TEXT, UUID)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION record_shipment_created(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INTEGER, TEXT, TEXT, UUID)
  TO service_role;


-- ============================================================
-- record_shipment_status_change — courier-event ingestion
-- ============================================================
--
-- Called by:
--   - /api/shipping/webhook on real-courier events
--   - /api/dev/shipping/advance for the mock provider
--
-- Atomically:
--   1. Updates shipments.status (validated against the lifecycle).
--   2. Inserts a shipment_events row.
--   3. Triggers order-side state transitions where applicable:
--      - to_status='picked_up'        → orders.shipped_at, status → 'shipped'
--      - to_status='delivered'        → orders.delivered_at + 48h inspection window
--   4. Inserts the corresponding order_events row.
--
-- Order-side transitions guard against the "shipment delivered but
-- order still says payment_pending" class of bug — every shipment
-- transition forces the order forward.
-- ============================================================

CREATE OR REPLACE FUNCTION record_shipment_status_change(
  p_awb         TEXT,
  p_to_status   TEXT,
  p_description TEXT,
  p_location    TEXT,
  p_actor_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_shipment    RECORD;
  v_order       RECORD;
  v_now         TIMESTAMPTZ := NOW();
  v_inspection_expires TIMESTAMPTZ;
BEGIN
  SELECT *
    INTO v_shipment
    FROM shipments
    WHERE awb = p_awb
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'shipment not found: %', p_awb
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotency: same status arriving twice is a noop, not an error.
  IF v_shipment.status = p_to_status THEN
    RETURN jsonb_build_object(
      'shipment_id', v_shipment.id,
      'awb',         p_awb,
      'status',      p_to_status,
      'replay',      true
    );
  END IF;

  -- Validate transition.
  IF NOT (
    (v_shipment.status = 'created'          AND p_to_status IN ('picked_up', 'cancelled')) OR
    (v_shipment.status = 'picked_up'        AND p_to_status IN ('in_transit', 'failed'))   OR
    (v_shipment.status = 'in_transit'       AND p_to_status IN ('out_for_delivery', 'failed')) OR
    (v_shipment.status = 'out_for_delivery' AND p_to_status IN ('delivered', 'failed'))
  ) THEN
    RAISE EXCEPTION 'invalid shipment transition: % → %', v_shipment.status, p_to_status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Update the shipment.
  UPDATE shipments
     SET status = p_to_status,
         picked_up_at = CASE WHEN p_to_status = 'picked_up' THEN v_now ELSE picked_up_at END,
         delivered_at = CASE WHEN p_to_status = 'delivered' THEN v_now ELSE delivered_at END,
         updated_at = v_now
   WHERE id = v_shipment.id;

  INSERT INTO shipment_events (
    shipment_id, event_name, from_status, to_status, description, location, occurred_at, actor_id
  ) VALUES (
    v_shipment.id, 'status_change', v_shipment.status, p_to_status,
    p_description, p_location, v_now, p_actor_id
  );

  -- Order-side cascades.
  SELECT id, status INTO v_order FROM orders WHERE id = v_shipment.order_id FOR UPDATE;

  IF p_to_status = 'picked_up' AND v_order.status = 'seller_confirmed' THEN
    UPDATE orders
       SET status = 'shipped',
           shipped_at = v_now,
           updated_at = v_now
     WHERE id = v_order.id;
    INSERT INTO order_events (order_id, event_name, from_status, to_status, actor_id, occurred_at)
      VALUES (v_order.id, 'shipment_picked_up', 'seller_confirmed', 'shipped', p_actor_id, v_now);
  END IF;

  IF p_to_status = 'delivered' AND v_order.status IN ('shipped', 'seller_confirmed') THEN
    -- 48h inspection window. Buyer can dispute up to v_inspection_expires;
    -- after that, escrow_release tooling can mark the order completed.
    v_inspection_expires := v_now + INTERVAL '48 hours';
    UPDATE orders
       SET status = 'delivered',
           delivered_at = v_now,
           inspection_expires_at = v_inspection_expires,
           updated_at = v_now
     WHERE id = v_order.id;
    INSERT INTO order_events (order_id, event_name, from_status, to_status, actor_id, occurred_at)
      VALUES (v_order.id, 'shipment_delivered', v_order.status, 'delivered', p_actor_id, v_now);
  END IF;

  RETURN jsonb_build_object(
    'shipment_id', v_shipment.id,
    'awb',         p_awb,
    'status',      p_to_status,
    'replay',      false
  );
END;
$$;

ALTER FUNCTION record_shipment_status_change(TEXT, TEXT, TEXT, TEXT, UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION record_shipment_status_change(TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION record_shipment_status_change(TEXT, TEXT, TEXT, TEXT, UUID)
  TO service_role;
