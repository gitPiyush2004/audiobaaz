-- Lifecycle smoke test for migration 007 against a real Postgres.
-- Mirrors Scenario A from the runbook in pure SQL: fixture seller +
-- buyer + listing + an escrow_held order, then exercise the two new
-- RPCs and verify the audit trail matches reality at each step.
--
-- Wrapped in a transaction; ROLLBACK at the end so the test leaves
-- nothing behind. Run with:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/lifecycle_smoke.sql

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- Fixtures.
INSERT INTO users (id, phone, full_name, city, pincode)
  VALUES ('11111111-1111-1111-1111-111111111111', '+91-seller', 'Seller One', 'Mumbai', '400001'),
         ('22222222-2222-2222-2222-222222222222', '+91-buyer',  'Buyer One',  'Bangalore', '560001');

INSERT INTO products (id, name, brand, model, category)
  VALUES ('33333333-3333-3333-3333-333333333333', 'Test Product', 'TestBrand', 'T1', 'iem');

INSERT INTO listings (
  id, seller_id, product_id, brand, product_name, category, asking_price,
  is_negotiable, status, photos, condition_grade, slug, inclusions
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'TestBrand', 'Test Product', 'iem', 100000,
  false, 'approved', ARRAY['x'], 'A', 'test-1234', '{}'::jsonb
);

INSERT INTO orders (
  id, listing_id, buyer_id, seller_id,
  listing_price, paid_price, platform_fee, shipping_fee, seller_payout,
  delivery_name, delivery_phone, delivery_line1,
  delivery_city, delivery_pincode, delivery_state,
  status
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  100000, 100000, 10000, 0, 90000,
  'Buyer One', '+91-buyer', '1 Buyer Lane',
  'Bangalore', '560001', 'Karnataka',
  'escrow_held'
);

INSERT INTO order_events (order_id, event_name, actor_type, to_status)
  VALUES ('55555555-5555-5555-5555-555555555555', 'payment_captured', 'webhook', 'escrow_held');

UPDATE listings
   SET status = 'sold',
       sold_order_id = '55555555-5555-5555-5555-555555555555',
       sold_at = NOW()
 WHERE id = '44444444-4444-4444-4444-444444444444';

-- ── Step 1: record_shipment_created ──────────────────────────
SELECT '--- record_shipment_created ---' AS step;
SELECT * FROM record_shipment_created(
  '55555555-5555-5555-5555-555555555555',
  'mock',
  'TEST-AAAA-001',
  'mock_ship_001',
  'mock_order_001',
  'Mock Courier',
  (CURRENT_DATE + INTERVAL '5 days')::date,
  100000,
  'Mumbai',
  'Bangalore',
  '11111111-1111-1111-1111-111111111111'
);

SELECT 'orders.status' AS field, status FROM orders WHERE id = '55555555-5555-5555-5555-555555555555';
SELECT 'shipments' AS field, awb, status FROM shipments WHERE order_id = '55555555-5555-5555-5555-555555555555';
SELECT 'order_events' AS field, event_name, from_status, to_status, actor_type FROM order_events WHERE order_id = '55555555-5555-5555-5555-555555555555' ORDER BY created_at;
SELECT 'shipment_events' AS field, event_name, to_status FROM shipment_events;

-- ── Step 2: picked_up ────────────────────────────────────────
SELECT '--- picked_up ---' AS step;
SELECT * FROM record_shipment_status_change(
  'TEST-AAAA-001', 'picked_up', 'Picked up from seller', 'Mumbai hub',
  '11111111-1111-1111-1111-111111111111'
);

SELECT 'orders.status' AS field, status, shipped_at IS NOT NULL AS shipped_at_set FROM orders WHERE id = '55555555-5555-5555-5555-555555555555';
SELECT 'shipments' AS field, status, picked_up_at IS NOT NULL AS picked_up_at_set FROM shipments WHERE awb = 'TEST-AAAA-001';

-- ── Step 3: in_transit ───────────────────────────────────────
SELECT '--- in_transit ---' AS step;
SELECT * FROM record_shipment_status_change(
  'TEST-AAAA-001', 'in_transit', 'In transit', 'Highway',
  '11111111-1111-1111-1111-111111111111'
);
SELECT 'orders.status' AS field, status FROM orders WHERE id = '55555555-5555-5555-5555-555555555555';

-- ── Step 4: out_for_delivery ─────────────────────────────────
SELECT '--- out_for_delivery ---' AS step;
SELECT * FROM record_shipment_status_change(
  'TEST-AAAA-001', 'out_for_delivery', 'Out for delivery', 'Bangalore hub',
  '11111111-1111-1111-1111-111111111111'
);

-- ── Step 5: delivered → trigger should rewrite to inspection ─
SELECT '--- delivered (trigger should rewrite to inspection) ---' AS step;
SELECT * FROM record_shipment_status_change(
  'TEST-AAAA-001', 'delivered', 'Delivered', 'Bangalore',
  '11111111-1111-1111-1111-111111111111'
);

SELECT 'orders.status' AS field, status, delivered_at IS NOT NULL AS delivered_at_set,
       inspection_expires_at IS NOT NULL AS inspection_expires_set
  FROM orders WHERE id = '55555555-5555-5555-5555-555555555555';
SELECT 'shipments.status' AS field, status, delivered_at IS NOT NULL AS delivered_at_set FROM shipments WHERE awb = 'TEST-AAAA-001';

SELECT '--- final order_events ---' AS step;
SELECT event_name, from_status, to_status, actor_type FROM order_events WHERE order_id = '55555555-5555-5555-5555-555555555555' ORDER BY created_at;

SELECT '--- final shipment_events ---' AS step;
SELECT event_name, from_status, to_status, description FROM shipment_events ORDER BY occurred_at;

-- ── Idempotent replay ────────────────────────────────────────
SELECT '--- replay delivered (should return replay=true) ---' AS step;
SELECT * FROM record_shipment_status_change(
  'TEST-AAAA-001', 'delivered', 'Delivered (replay)', 'Bangalore',
  '11111111-1111-1111-1111-111111111111'
);
SELECT 'shipment_events count after replay' AS field, COUNT(*) FROM shipment_events;

-- ── Invalid transition ───────────────────────────────────────
SELECT '--- invalid transition (delivered → in_transit) ---' AS step;
DO $$
BEGIN
  PERFORM record_shipment_status_change(
    'TEST-AAAA-001', 'in_transit', 'illegal', 'somewhere',
    '11111111-1111-1111-1111-111111111111'
  );
  RAISE NOTICE 'BUG: invalid transition was accepted';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: invalid transition correctly rejected: %', SQLERRM;
END;
$$;

-- ── Non-seller tries to create shipment ──────────────────────
INSERT INTO users (id, phone, full_name, city, pincode)
  VALUES ('66666666-6666-6666-6666-666666666666', '+91-other-seller', 'Other Seller', 'Delhi', '110001');

INSERT INTO listings (id, seller_id, product_id, brand, product_name, category, asking_price, is_negotiable, status, photos, condition_grade, slug, inclusions)
  VALUES ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666',
          '33333333-3333-3333-3333-333333333333', 'TestBrand', 'Other Product', 'iem', 50000,
          false, 'approved', ARRAY['x'], 'A', 'test-other-9999', '{}'::jsonb);

INSERT INTO orders (
  id, listing_id, buyer_id, seller_id,
  listing_price, paid_price, platform_fee, shipping_fee, seller_payout,
  delivery_name, delivery_phone, delivery_line1, delivery_city, delivery_pincode, delivery_state,
  status
) VALUES (
  '88888888-8888-8888-8888-888888888888',
  '77777777-7777-7777-7777-777777777777',
  '22222222-2222-2222-2222-222222222222',
  '66666666-6666-6666-6666-666666666666',
  50000, 50000, 5000, 0, 45000,
  'Buyer One', '+91-buyer', '1 Buyer Lane', 'Bangalore', '560001', 'Karnataka',
  'escrow_held'
);

UPDATE listings SET status = 'sold', sold_order_id = '88888888-8888-8888-8888-888888888888', sold_at = NOW() WHERE id = '77777777-7777-7777-7777-777777777777';

SELECT '--- non-seller tries to create shipment (should error) ---' AS step;
DO $$
BEGIN
  PERFORM record_shipment_created(
    '88888888-8888-8888-8888-888888888888', 'mock', 'TEST-BBBB-002',
    'm2', 'm2', 'Mock Courier', (CURRENT_DATE + INTERVAL '5 days')::date,
    50000, 'Delhi', 'Bangalore',
    '11111111-1111-1111-1111-111111111111'
  );
  RAISE NOTICE 'BUG: non-seller accepted';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: non-seller correctly rejected: %', SQLERRM;
END;
$$;

ROLLBACK;
