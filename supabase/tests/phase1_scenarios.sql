-- ============================================================
-- AUDIOBAAZ — Phase 1 acceptance: four scenarios at the DB layer
-- ============================================================
--
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase1_scenarios.sql
--
-- Or against a local Supabase:
--   supabase db reset                        # apply schema + 002 migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/phase1_scenarios.sql
--
-- The script runs each scenario inside a SAVEPOINT so a failure in
-- one does not poison subsequent scenarios. Every assertion uses
-- RAISE EXCEPTION on failure so the script exits non-zero on the
-- first violation.
--
-- The scenarios mirror docs/context/payments-shipping.md
-- "Phase 1 acceptance criteria — four scenarios at the database
-- layer".
-- ============================================================

\set ON_ERROR_STOP on
\timing off


-- ============================================================
-- Test fixtures helper
-- ============================================================
--
-- Each scenario calls phase1_test_setup(scenario_label) which
-- creates a fresh seller, two buyers, an approved listing, and
-- two competing payment_pending orders. Returns the IDs as JSONB
-- so each scenario can pluck what it needs.
--
-- Fixtures live in a temporary schema scoped to this script run;
-- they vanish when the session ends.

DROP FUNCTION IF EXISTS phase1_test_setup(TEXT);
CREATE OR REPLACE FUNCTION phase1_test_setup(label TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_seller   UUID := uuid_generate_v4();
  v_buyer_a  UUID := uuid_generate_v4();
  v_buyer_b  UUID := uuid_generate_v4();
  v_listing  UUID := uuid_generate_v4();
  v_order_a  UUID := uuid_generate_v4();
  v_order_b  UUID := uuid_generate_v4();
  v_payment_a UUID := uuid_generate_v4();
  v_payment_b UUID := uuid_generate_v4();
BEGIN
  -- Seller + two buyers
  INSERT INTO users (id, phone, full_name, role) VALUES
    (v_seller,  '+91' || LPAD(FLOOR(RANDOM() * 1e10)::TEXT, 10, '0'), 'Test Seller ' || label, 'user'),
    (v_buyer_a, '+91' || LPAD(FLOOR(RANDOM() * 1e10)::TEXT, 10, '0'), 'Test Buyer A ' || label, 'user'),
    (v_buyer_b, '+91' || LPAD(FLOOR(RANDOM() * 1e10)::TEXT, 10, '0'), 'Test Buyer B ' || label, 'user');

  -- Approved listing
  INSERT INTO listings (
    id, seller_id, product_name, brand, category,
    condition_grade, inclusions, photos, asking_price, status, slug
  ) VALUES (
    v_listing, v_seller, 'Test IEM ' || label, 'TestBrand', 'iem',
    'A', '{"box": true, "cable": true}'::jsonb,
    ARRAY['https://picsum.photos/seed/' || label || '/1200/900'],
    1000000, 'approved', 'test-' || lower(label) || '-' || substr(v_listing::TEXT, 1, 8)
  );

  -- Two competing orders (direct buy-now, no offer_id)
  INSERT INTO orders (
    id, listing_id, buyer_id, seller_id,
    listing_price, paid_price, platform_fee, shipping_fee, seller_payout,
    delivery_name, delivery_phone, delivery_line1,
    delivery_city, delivery_pincode, delivery_state,
    status
  ) VALUES
    (v_order_a, v_listing, v_buyer_a, v_seller,
     1000000, 1000000, 100000, 15000, 900000,
     'Buyer A', '+919999999999', '1 Test Street',
     'Mumbai', '400001', 'MH', 'payment_pending'),
    (v_order_b, v_listing, v_buyer_b, v_seller,
     1000000, 1000000, 100000, 15000, 900000,
     'Buyer B', '+919999999998', '2 Test Street',
     'Bangalore', '560001', 'KA', 'payment_pending');

  -- Two competing payments (status = created)
  INSERT INTO payments (id, order_id, razorpay_order_id, amount, status)
  VALUES
    (v_payment_a, v_order_a, 'rzp_order_' || label || '_a', 1015000, 'created'),
    (v_payment_b, v_order_b, 'rzp_order_' || label || '_b', 1015000, 'created');

  RETURN jsonb_build_object(
    'seller',    v_seller,
    'buyer_a',   v_buyer_a,
    'buyer_b',   v_buyer_b,
    'listing',   v_listing,
    'order_a',   v_order_a,
    'order_b',   v_order_b,
    'payment_a', v_payment_a,
    'payment_b', v_payment_b
  );
END;
$$;


-- ============================================================
-- SCENARIO A — Concurrent captures, one winner
-- ============================================================
-- Two captures for the same listing → exactly one marketplace
-- winner. The second call returns 'conflict' and marks its order
-- 'cancelled'. Listing has exactly one sold_offer_id (NULL,
-- because these are direct buy-now orders without offers — but
-- listings.status is 'sold' and the winning order is in
-- escrow_held).

\echo
\echo '=== Scenario A — Concurrent captures, one winner ==='

SAVEPOINT scenario_a;

DO $a$
DECLARE
  ids        JSONB := phase1_test_setup('A');
  result_a   JSONB;
  result_b   JSONB;
  winners    INTEGER;
  cancelled  INTEGER;
  listing    RECORD;
BEGIN
  -- Buyer A captures first
  result_a := finalize_winning_payment(
    (ids->>'payment_a')::UUID,
    'rzp_pay_a_xyz',
    'sig_a',
    'card',
    (ids->>'buyer_a')::UUID
  );

  IF result_a->>'result' != 'winner' THEN
    RAISE EXCEPTION 'Scenario A: first capture should be winner, got %', result_a;
  END IF;

  -- Buyer B captures second — should conflict
  result_b := finalize_winning_payment(
    (ids->>'payment_b')::UUID,
    'rzp_pay_b_xyz',
    'sig_b',
    'card',
    (ids->>'buyer_b')::UUID
  );

  IF result_b->>'result' != 'conflict' THEN
    RAISE EXCEPTION 'Scenario A: second capture should be conflict, got %', result_b;
  END IF;

  IF result_b->>'reason' != 'listing_already_sold' THEN
    RAISE EXCEPTION 'Scenario A: conflict reason should be listing_already_sold, got %', result_b;
  END IF;

  -- Listing-side state assertions
  SELECT * INTO listing FROM listings WHERE id = (ids->>'listing')::UUID;
  IF listing.status != 'sold' THEN
    RAISE EXCEPTION 'Scenario A: listing.status should be sold, got %', listing.status;
  END IF;
  IF listing.sold_offer_id IS NOT NULL THEN
    -- direct buy-now: offer_id is NULL, sold_offer_id remains NULL
    RAISE EXCEPTION 'Scenario A: direct buy-now → sold_offer_id should remain NULL';
  END IF;

  -- Order-side: exactly one in winning lineage, exactly one cancelled
  SELECT COUNT(*) INTO winners FROM orders
   WHERE listing_id = (ids->>'listing')::UUID
     AND status = 'escrow_held';
  IF winners != 1 THEN
    RAISE EXCEPTION 'Scenario A: expected 1 escrow_held order, got %', winners;
  END IF;

  SELECT COUNT(*) INTO cancelled FROM orders
   WHERE listing_id = (ids->>'listing')::UUID
     AND status = 'cancelled';
  IF cancelled != 1 THEN
    RAISE EXCEPTION 'Scenario A: expected 1 cancelled order, got %', cancelled;
  END IF;

  -- Audit trail: payment_captured and order_cancelled both recorded
  IF (SELECT COUNT(*) FROM order_events
       WHERE event_name = 'payment_captured'
         AND order_id = (ids->>'order_a')::UUID) != 1 THEN
    RAISE EXCEPTION 'Scenario A: missing payment_captured event for winner';
  END IF;
  IF (SELECT COUNT(*) FROM order_events
       WHERE event_name = 'order_cancelled'
         AND order_id = (ids->>'order_b')::UUID) != 1 THEN
    RAISE EXCEPTION 'Scenario A: missing order_cancelled event for loser';
  END IF;

  RAISE NOTICE 'Scenario A PASSED';
END;
$a$;

ROLLBACK TO SAVEPOINT scenario_a;


-- ============================================================
-- SCENARIO B — Mid-cascade crash, no split brain
-- ============================================================
-- The hardest gate. We simulate a crash mid-cascade by:
--   1. Starting a transaction
--   2. Calling the RPC
--   3. Raising an exception AFTER the RPC returns but BEFORE
--      the outer transaction commits
--   4. Asserting NO state changed: payment.status still
--      'created', order.status still 'payment_pending',
--      listing.status still 'approved', no audit events written
--
-- This test only proves the OUTER transaction wrapping the RPC
-- is honoured. The RPC itself is one statement (a function
-- call); PL/pgSQL's implicit transaction means partial commits
-- inside the function are also impossible — any RAISE EXCEPTION
-- mid-function rolls back everything written so far.

\echo
\echo '=== Scenario B — Mid-cascade crash, no split brain ==='

SAVEPOINT scenario_b;

DO $b$
DECLARE
  ids       JSONB := phase1_test_setup('B');
  payment   RECORD;
  ord       RECORD;
  lst       RECORD;
  events    INTEGER;
BEGIN
  -- Sub-savepoint we'll rollback to simulate an outer-tx abort
  -- after the RPC has written its rows.
  BEGIN
    PERFORM finalize_winning_payment(
      (ids->>'payment_a')::UUID,
      'rzp_pay_b_a_xyz',
      'sig_b_a',
      'card',
      (ids->>'buyer_a')::UUID
    );
    -- Caller (e.g. webhook handler) crashes / errors *after* the
    -- RPC returns successfully but before its own transaction
    -- commits. PL/pgSQL exception inside this BEGIN block rolls
    -- back to the outer SAVEPOINT scenario_b — modelling a
    -- handler crash between RPC return and webhook_events
    -- update.
    RAISE EXCEPTION 'simulated handler crash after RPC';
  EXCEPTION WHEN OTHERS THEN
    -- Swallow only this synthetic exception; rethrow anything else.
    IF SQLERRM != 'simulated handler crash after RPC' THEN
      RAISE;
    END IF;
  END;

  -- Assertions: nothing committed.
  SELECT * INTO payment FROM payments WHERE id = (ids->>'payment_a')::UUID;
  IF payment.status != 'created' THEN
    RAISE EXCEPTION 'Scenario B: payment.status should be created (rolled back), got %', payment.status;
  END IF;

  SELECT * INTO ord FROM orders WHERE id = (ids->>'order_a')::UUID;
  IF ord.status != 'payment_pending' THEN
    RAISE EXCEPTION 'Scenario B: order.status should be payment_pending (rolled back), got %', ord.status;
  END IF;

  SELECT * INTO lst FROM listings WHERE id = (ids->>'listing')::UUID;
  IF lst.status != 'approved' THEN
    RAISE EXCEPTION 'Scenario B: listing.status should be approved (rolled back), got %', lst.status;
  END IF;
  IF lst.sold_offer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Scenario B: listing.sold_offer_id should be NULL (rolled back)';
  END IF;

  SELECT COUNT(*) INTO events FROM order_events WHERE order_id = (ids->>'order_a')::UUID;
  IF events != 0 THEN
    RAISE EXCEPTION 'Scenario B: order_events should be empty (rolled back), got %', events;
  END IF;

  RAISE NOTICE 'Scenario B PASSED — no split brain';
END;
$b$;

ROLLBACK TO SAVEPOINT scenario_b;


-- ============================================================
-- SCENARIO C — Refunded winner immutability
-- ============================================================
-- After a buyer-favourable dispute marks the order 'refunded',
-- the listing remains 'sold' and sold_offer_id is unchanged.
-- A new attempt to capture for any other order on the same
-- listing must return 'conflict' (the listing is still owned).
--
-- Setup uses an offer-backed order (not direct buy-now) so
-- listings.sold_offer_id receives a real UUID and we can prove
-- that UUID is preserved across the refund.

\echo
\echo '=== Scenario C — Refunded winner immutability ==='

SAVEPOINT scenario_c;

DO $c$
DECLARE
  ids                JSONB := phase1_test_setup('C');
  v_offer_a          UUID := uuid_generate_v4();
  result_a           JSONB;
  result_b_post      JSONB;
  pre_listing        RECORD;
  post_listing       RECORD;
  pre_sold_offer_id  UUID;
  post_sold_offer_id UUID;
BEGIN
  -- Create an accepted offer for buyer A and link it to order A,
  -- so the RPC's offer-aware path sets sold_offer_id to a real UUID.
  INSERT INTO offers (
    id, listing_id, buyer_id, seller_id, offered_price, status
  ) VALUES (
    v_offer_a,
    (ids->>'listing')::UUID,
    (ids->>'buyer_a')::UUID,
    (ids->>'seller')::UUID,
    1000000, 'accepted'
  );

  UPDATE orders SET offer_id = v_offer_a WHERE id = (ids->>'order_a')::UUID;

  -- Buyer A captures, becomes winner
  result_a := finalize_winning_payment(
    (ids->>'payment_a')::UUID,
    'rzp_pay_c_a',
    'sig_c_a',
    'card',
    (ids->>'buyer_a')::UUID
  );
  IF result_a->>'result' != 'winner' THEN
    RAISE EXCEPTION 'Scenario C: setup capture should be winner, got %', result_a;
  END IF;

  -- Snapshot pre-refund listing state. sold_offer_id should now
  -- equal v_offer_a (set by the RPC at step 6).
  SELECT * INTO pre_listing FROM listings WHERE id = (ids->>'listing')::UUID;
  pre_sold_offer_id := pre_listing.sold_offer_id;

  IF pre_sold_offer_id IS NULL THEN
    RAISE EXCEPTION 'Scenario C: sold_offer_id should be set after capture, got NULL';
  END IF;
  IF pre_sold_offer_id != v_offer_a THEN
    RAISE EXCEPTION 'Scenario C: sold_offer_id should equal v_offer_a (% vs %)',
      pre_sold_offer_id, v_offer_a;
  END IF;

  -- Simulate the order progressing all the way to a buyer-favourable
  -- dispute resolution. We bypass the inspection trigger by setting
  -- delivered_at + inspection_expires_at directly so the trigger's
  -- guard (status changing to 'delivered') does not fire.
  UPDATE orders SET status = 'seller_confirmed' WHERE id = (ids->>'order_a')::UUID;
  UPDATE orders SET status = 'shipped'          WHERE id = (ids->>'order_a')::UUID;
  UPDATE orders SET status = 'inspection',
                    delivered_at = NOW(),
                    inspection_expires_at = NOW() + INTERVAL '48 hours'
   WHERE id = (ids->>'order_a')::UUID;
  UPDATE orders SET status = 'disputed' WHERE id = (ids->>'order_a')::UUID;
  UPDATE orders SET status = 'refunded' WHERE id = (ids->>'order_a')::UUID;

  -- Listing state must be unchanged: still sold, sold_offer_id
  -- still points at the same UUID.
  SELECT * INTO post_listing FROM listings WHERE id = (ids->>'listing')::UUID;
  post_sold_offer_id := post_listing.sold_offer_id;

  IF post_listing.status != 'sold' THEN
    RAISE EXCEPTION 'Scenario C: listing.status should remain sold after refund, got %', post_listing.status;
  END IF;
  IF post_sold_offer_id IS DISTINCT FROM pre_sold_offer_id THEN
    RAISE EXCEPTION 'Scenario C: sold_offer_id changed after refund (immutability violation): % → %',
      pre_sold_offer_id, post_sold_offer_id;
  END IF;

  -- A new capture attempt for the second order must conflict.
  result_b_post := finalize_winning_payment(
    (ids->>'payment_b')::UUID,
    'rzp_pay_c_b',
    'sig_c_b',
    'card',
    (ids->>'buyer_b')::UUID
  );
  IF result_b_post->>'result' != 'conflict' THEN
    RAISE EXCEPTION 'Scenario C: post-refund capture must conflict (listing still sold), got %', result_b_post;
  END IF;

  RAISE NOTICE 'Scenario C PASSED — sold_offer_id immutable post-refund';
END;
$c$;

ROLLBACK TO SAVEPOINT scenario_c;


-- ============================================================
-- SCENARIO D — High-concurrency race + auditability
-- ============================================================
-- 10 simultaneous captures; exactly 1 winner, 9 losers, full
-- audit trail discoverable from the database alone (no Razorpay
-- dashboard needed).
--
-- "Simultaneous" in a single-session psql script means
-- "interleaved within the same transaction." This proves the
-- correctness of the invariant + RPC against sequential calls
-- in one connection. True multi-connection concurrency is
-- proven indirectly by the SELECT ... FOR UPDATE locks in the
-- RPC — those serialise concurrent callers per (payment, order,
-- listing). A pgbench-style multi-connection test belongs in
-- a separate CI job.

\echo
\echo '=== Scenario D — 10 captures, 1 winner, full audit trail ==='

SAVEPOINT scenario_d;

DO $d$
DECLARE
  v_seller       UUID := uuid_generate_v4();
  v_listing      UUID := uuid_generate_v4();
  v_buyer        UUID;
  v_order        UUID;
  v_payment      UUID;
  v_result       JSONB;
  i              INTEGER;
  winners        INTEGER;
  cancelled      INTEGER;
  cancel_events  INTEGER;
  capture_events INTEGER;
  audit_complete BOOLEAN;
BEGIN
  -- Seller + listing
  INSERT INTO users (id, phone, full_name, role) VALUES
    (v_seller, '+91' || LPAD(FLOOR(RANDOM() * 1e10)::TEXT, 10, '0'), 'D-Seller', 'user');

  INSERT INTO listings (
    id, seller_id, product_name, brand, category,
    condition_grade, inclusions, photos, asking_price, status, slug
  ) VALUES (
    v_listing, v_seller, 'D Test IEM', 'TestBrand', 'iem',
    'A', '{"box": true}'::jsonb,
    ARRAY['https://picsum.photos/seed/d/1200/900'],
    1000000, 'approved', 'test-d-' || substr(v_listing::TEXT, 1, 8)
  );

  -- 10 buyers, 10 orders, 10 payments
  FOR i IN 1..10 LOOP
    v_buyer   := uuid_generate_v4();
    v_order   := uuid_generate_v4();
    v_payment := uuid_generate_v4();

    INSERT INTO users (id, phone, full_name, role) VALUES
      (v_buyer, '+91' || LPAD(FLOOR(RANDOM() * 1e10)::TEXT, 10, '0'), 'D-Buyer-' || i, 'user');

    INSERT INTO orders (
      id, listing_id, buyer_id, seller_id,
      listing_price, paid_price, platform_fee, shipping_fee, seller_payout,
      delivery_name, delivery_phone, delivery_line1,
      delivery_city, delivery_pincode, delivery_state,
      status
    ) VALUES (
      v_order, v_listing, v_buyer, v_seller,
      1000000, 1000000, 100000, 15000, 900000,
      'D-Buyer-' || i, '+919999900000', i || ' Test Street',
      'Mumbai', '400001', 'MH', 'payment_pending'
    );

    INSERT INTO payments (id, order_id, razorpay_order_id, amount, status)
    VALUES (v_payment, v_order, 'rzp_order_d_' || i, 1015000, 'created');

    -- Capture in sequence; first wins, rest conflict
    v_result := finalize_winning_payment(
      v_payment,
      'rzp_pay_d_' || i,
      'sig_d_' || i,
      'card',
      v_buyer
    );

    IF i = 1 AND v_result->>'result' != 'winner' THEN
      RAISE EXCEPTION 'Scenario D: first capture should be winner, got %', v_result;
    END IF;
    IF i > 1 AND v_result->>'result' != 'conflict' THEN
      RAISE EXCEPTION 'Scenario D: capture #% should be conflict, got %', i, v_result;
    END IF;
  END LOOP;

  -- Marketplace state assertions
  SELECT COUNT(*) INTO winners FROM orders
   WHERE listing_id = v_listing AND status = 'escrow_held';
  IF winners != 1 THEN
    RAISE EXCEPTION 'Scenario D: expected 1 winner, got %', winners;
  END IF;

  SELECT COUNT(*) INTO cancelled FROM orders
   WHERE listing_id = v_listing AND status = 'cancelled';
  IF cancelled != 9 THEN
    RAISE EXCEPTION 'Scenario D: expected 9 cancelled, got %', cancelled;
  END IF;

  -- Auditability assertion: every loser has an order_cancelled
  -- event with reason=listing_already_sold and metadata pointing
  -- at the winning offer/listing.
  SELECT COUNT(*) INTO cancel_events FROM order_events
   WHERE event_name = 'order_cancelled'
     AND metadata->>'reason' = 'listing_already_sold';
  IF cancel_events != 9 THEN
    RAISE EXCEPTION 'Scenario D: expected 9 order_cancelled events, got %', cancel_events;
  END IF;

  -- Capture event recorded for the winner
  SELECT COUNT(*) INTO capture_events FROM order_events
   WHERE event_name = 'payment_captured'
     AND order_id IN (SELECT id FROM orders WHERE listing_id = v_listing);
  IF capture_events != 1 THEN
    RAISE EXCEPTION 'Scenario D: expected 1 payment_captured event, got %', capture_events;
  END IF;

  -- The full discoverability promise: from the DB alone we can
  -- answer "which won, which lost, when, why" by joining orders +
  -- order_events. Confirm the join is non-empty for every loser.
  SELECT bool_and(joined.has_event) INTO audit_complete
  FROM (
    SELECT o.id,
           EXISTS (
             SELECT 1 FROM order_events oe
             WHERE oe.order_id = o.id
               AND oe.event_name = 'order_cancelled'
           ) AS has_event
    FROM orders o
    WHERE o.listing_id = v_listing
      AND o.status = 'cancelled'
  ) joined;

  IF NOT audit_complete THEN
    RAISE EXCEPTION 'Scenario D: not every loser has a discoverable order_cancelled event';
  END IF;

  RAISE NOTICE 'Scenario D PASSED — 1 winner, 9 losers, 0 ownership corruption, full audit trail';
END;
$d$;

ROLLBACK TO SAVEPOINT scenario_d;


-- ============================================================
-- Cleanup
-- ============================================================

DROP FUNCTION IF EXISTS phase1_test_setup(TEXT);

\echo
\echo '=== ALL FOUR SCENARIOS PASSED ==='
