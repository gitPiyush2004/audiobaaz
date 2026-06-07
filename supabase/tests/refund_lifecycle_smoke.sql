-- Exercise the race-loser refund path: finalize_winning_payment
-- (conflict result) + initiate_refund + record_refund_outcome.
-- This is what /api/payments/verify does on the conflict branch.
--
-- ROLLBACK at the end leaves the test DB clean.

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- Fixtures: one listing, two buyers, two payments. Buyer A wins; Buyer B
-- gets the conflict result and a refund.
INSERT INTO users (id, phone, full_name, city, pincode)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '+91-seller', 'Seller', 'Mumbai', '400001'),
         ('aaaaaaaa-0000-0000-0000-000000000002', '+91-buyer-a', 'Buyer A', 'BLR', '560001'),
         ('aaaaaaaa-0000-0000-0000-000000000003', '+91-buyer-b', 'Buyer B', 'DEL', '110001');

INSERT INTO products (id, name, brand, model, category)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000004', 'P', 'B', 'M', 'iem');

INSERT INTO listings (id, seller_id, product_id, brand, product_name, category, asking_price,
                     is_negotiable, status, photos, condition_grade, slug, inclusions)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000005',
          'aaaaaaaa-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000004',
          'B', 'P', 'iem', 100000,
          false, 'approved', ARRAY['x'], 'A', 'race-test', '{}'::jsonb);

-- Two competing payment_pending orders, each with a created payment.
INSERT INTO orders (id, listing_id, buyer_id, seller_id,
                    listing_price, paid_price, platform_fee, shipping_fee, seller_payout,
                    delivery_name, delivery_phone, delivery_line1,
                    delivery_city, delivery_pincode, delivery_state, status)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000006',
          'aaaaaaaa-0000-0000-0000-000000000005',
          'aaaaaaaa-0000-0000-0000-000000000002',
          'aaaaaaaa-0000-0000-0000-000000000001',
          100000, 100000, 10000, 0, 90000,
          'Buyer A', '+91-buyer-a', 'A1', 'BLR', '560001', 'KA', 'payment_pending'),
         ('aaaaaaaa-0000-0000-0000-000000000007',
          'aaaaaaaa-0000-0000-0000-000000000005',
          'aaaaaaaa-0000-0000-0000-000000000003',
          'aaaaaaaa-0000-0000-0000-000000000001',
          100000, 100000, 10000, 0, 90000,
          'Buyer B', '+91-buyer-b', 'B1', 'DEL', '110001', 'DL', 'payment_pending');

INSERT INTO payments (id, order_id, razorpay_order_id, amount, currency, status)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000008',
          'aaaaaaaa-0000-0000-0000-000000000006',
          'dev_order_buyer_a', 100000, 'INR', 'created'),
         ('aaaaaaaa-0000-0000-0000-000000000009',
          'aaaaaaaa-0000-0000-0000-000000000007',
          'dev_order_buyer_b', 100000, 'INR', 'created');

-- ── Buyer A wins ─────────────────────────────────────────────
SELECT '--- Buyer A wins ---' AS step;
SELECT finalize_winning_payment(
  'aaaaaaaa-0000-0000-0000-000000000008',
  'dev_payment_a', 'sigA', 'card',
  'aaaaaaaa-0000-0000-0000-000000000002'
) ->> 'result' AS result;

SELECT 'orders A' AS field, status FROM orders WHERE id = 'aaaaaaaa-0000-0000-0000-000000000006';
SELECT 'listings' AS field, status, sold_order_id IS NOT NULL AS sold_order_id_set FROM listings WHERE id = 'aaaaaaaa-0000-0000-0000-000000000005';

-- ── Buyer B captures (conflict) ──────────────────────────────
SELECT '--- Buyer B captures (should conflict) ---' AS step;
SELECT finalize_winning_payment(
  'aaaaaaaa-0000-0000-0000-000000000009',
  'dev_payment_b', 'sigB', 'card',
  'aaaaaaaa-0000-0000-0000-000000000003'
) ->> 'result' AS result;

SELECT 'orders B' AS field, status FROM orders WHERE id = 'aaaaaaaa-0000-0000-0000-000000000007';

-- ── Application-layer step: the verify route marks the losing
-- payment as captured before calling initiate_refund. This is
-- what /api/payments/verify and /api/payments/webhook both do
-- on the conflict branch.
UPDATE payments
   SET status              = 'captured',
       razorpay_payment_id = 'dev_payment_b',
       razorpay_signature  = 'sigB',
       method              = 'card',
       updated_at          = NOW()
 WHERE id = 'aaaaaaaa-0000-0000-0000-000000000009';

-- ── initiate_refund for B ────────────────────────────────────
SELECT '--- initiate_refund for B ---' AS step;
SELECT initiate_refund(
  'aaaaaaaa-0000-0000-0000-000000000009',
  'race_loss',
  'aaaaaaaa-0000-0000-0000-000000000003'
) AS payload;

SELECT 'payments B' AS field, status, refund_status, refund_initiated_at IS NOT NULL AS initiated_at_set
  FROM payments WHERE id = 'aaaaaaaa-0000-0000-0000-000000000009';

-- ── record_refund_outcome: pending → succeeded (dev provider path) ──
SELECT '--- record_refund_outcome pending → succeeded ---' AS step;
SELECT record_refund_outcome(
  'aaaaaaaa-0000-0000-0000-000000000009',
  'succeeded',
  'dev_refund_001',
  NULL,
  'aaaaaaaa-0000-0000-0000-000000000003'
) AS payload;

SELECT 'payments B' AS field, status AS payment_status, refund_status, refund_completed_at IS NOT NULL AS completed_at_set
  FROM payments WHERE id = 'aaaaaaaa-0000-0000-0000-000000000009';

-- ── Replay the same outcome (idempotent) ─────────────────────
SELECT '--- record_refund_outcome replay (should noop) ---' AS step;
SELECT record_refund_outcome(
  'aaaaaaaa-0000-0000-0000-000000000009',
  'succeeded', 'dev_refund_001', NULL,
  'aaaaaaaa-0000-0000-0000-000000000003'
) AS payload;

-- ── initiate_refund replay (should noop) ─────────────────────
SELECT '--- initiate_refund replay (should noop) ---' AS step;
SELECT initiate_refund(
  'aaaaaaaa-0000-0000-0000-000000000009',
  'race_loss',
  'aaaaaaaa-0000-0000-0000-000000000003'
) AS payload;

ROLLBACK;
