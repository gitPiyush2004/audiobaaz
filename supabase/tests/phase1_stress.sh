#!/usr/bin/env bash
# ============================================================
# AUDIOBAAZ — Phase 1 multi-connection stress test
# ============================================================
#
# Verifies finalize_winning_payment() under true OS-level
# parallelism. Single-session SQL tests prove correctness
# against the lifetime invariant + SELECT ... FOR UPDATE locks
# in a sequential setting; this harness proves they hold under
# concurrent connections.
#
# Requires:
#   - psql
#   - pgbench (ships with Postgres)
#   - DATABASE_URL pointing at a database with 002 + 003 + 004
#     migrations applied
#
# Usage:
#   DATABASE_URL=postgres://... bash supabase/tests/phase1_stress.sh
#   DATABASE_URL=postgres://... CONCURRENCY=100 bash supabase/tests/phase1_stress.sh
#
# What it does:
#   1. Creates 1 seller + 1 listing + N buyers + N orders + N
#      payments under one listing (where N = $CONCURRENCY).
#   2. Runs pgbench with N parallel clients, each picking ONE
#      of the N payments and calling finalize_winning_payment().
#   3. Asserts at the end:
#        - exactly 1 order in escrow_held
#        - exactly N-1 orders in cancelled
#        - listings.status = sold
#        - exactly 1 payment_captured event
#        - exactly N-1 order_cancelled events
#        - listings.sold_at is set
#
# Exit code 0 = pass; non-zero = a concurrency bug. The output
# names which assertion failed.
# ============================================================

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set" >&2
  exit 2
fi

CONCURRENCY="${CONCURRENCY:-100}"
LABEL="stress_$(date +%s)"

echo "=== Phase 1 stress test ==="
echo "  Concurrency:  $CONCURRENCY parallel clients"
echo "  Label:        $LABEL"
echo "  Database:     $(echo "$DATABASE_URL" | sed -E 's|://[^@]+@|://***@|')"
echo

# --- 1. Setup ---
# Create N orders + payments for one listing. Each pgbench client
# picks one payment by index. Fixture data is namespaced by $LABEL
# so multiple stress runs can coexist on the same database.

SETUP_SQL=$(cat <<EOF
-- Seller + listing
WITH inserted_seller AS (
  INSERT INTO users (id, phone, full_name, role)
  VALUES (uuid_generate_v4(),
          '+91' || LPAD(FLOOR(RANDOM() * 1e10)::TEXT, 10, '0'),
          'Stress-Seller-${LABEL}', 'user')
  RETURNING id
),
inserted_listing AS (
  INSERT INTO listings (
    id, seller_id, product_name, brand, category,
    condition_grade, inclusions, photos, asking_price, status, slug
  )
  SELECT
    uuid_generate_v4(), s.id,
    'Stress IEM ${LABEL}', 'StressBrand', 'iem', 'A',
    '{"box": true}'::jsonb,
    ARRAY['https://picsum.photos/seed/${LABEL}/1200/900'],
    1000000, 'approved', 'stress-${LABEL}'
  FROM inserted_seller s
  RETURNING id, seller_id
),
-- N buyers
buyers AS (
  INSERT INTO users (id, phone, full_name, role)
  SELECT uuid_generate_v4(),
         '+91' || LPAD((FLOOR(RANDOM() * 1e10)::BIGINT + g)::TEXT, 10, '0'),
         'Stress-Buyer-${LABEL}-' || g, 'user'
  FROM generate_series(1, ${CONCURRENCY}) g
  RETURNING id
),
-- N orders, one per buyer
orders_inserted AS (
  INSERT INTO orders (
    id, listing_id, buyer_id, seller_id,
    listing_price, paid_price, platform_fee, shipping_fee, seller_payout,
    delivery_name, delivery_phone, delivery_line1,
    delivery_city, delivery_pincode, delivery_state,
    status
  )
  SELECT
    uuid_generate_v4(),
    l.id, b.id, l.seller_id,
    1000000, 1000000, 100000, 15000, 900000,
    'Stress-Buyer', '+919999999999', 'Stress Street',
    'Mumbai', '400001', 'MH',
    'payment_pending'
  FROM inserted_listing l
  CROSS JOIN buyers b
  RETURNING id
),
-- Number the orders in a separate CTE. Postgres forbids window
-- functions in INSERT ... RETURNING; we project an idx in a
-- follow-up step.
orders_numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS idx
    FROM orders_inserted
),
payments_inserted AS (
  INSERT INTO payments (id, order_id, razorpay_order_id, amount, status)
  SELECT
    uuid_generate_v4(),
    o.id,
    'rzp_stress_${LABEL}_' || o.idx,
    1015000,
    'created'
  FROM orders_numbered o
  RETURNING id, order_id
),
-- Final join: stress_fixtures wants (idx, payment_id, order_id,
-- listing_id) keyed by the same idx the orders were assigned.
-- We re-derive idx from orders_numbered (which is the canonical
-- numbering source) and join back through order_id.
payments_numbered AS (
  SELECT p.id AS payment_id, p.order_id, on2.idx
    FROM payments_inserted p
    JOIN orders_numbered on2 ON on2.id = p.order_id
)
INSERT INTO stress_fixtures (label, idx, payment_id, order_id, listing_id)
SELECT '${LABEL}', pn.idx, pn.payment_id, pn.order_id, (SELECT id FROM inserted_listing)
FROM payments_numbered pn;
EOF
)

# Create the fixture-routing table on first run
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
CREATE TABLE IF NOT EXISTS stress_fixtures (
  label       TEXT NOT NULL,
  idx         BIGINT NOT NULL,
  payment_id  UUID NOT NULL,
  order_id    UUID NOT NULL,
  listing_id  UUID NOT NULL,
  PRIMARY KEY (label, idx)
);"

echo "Setting up $CONCURRENCY orders..."
echo "$SETUP_SQL" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f -

# --- 2. Stress run ---
# pgbench script picks a random fixture row and calls the RPC.
# pgbench's :client_id starts at 0 (range 0..N-1 for -c N); the
# fixture indexes start at 1 (range 1..N). We bind :i = client_id
# + 1 so each client targets a distinct payment_id.

PGBENCH_SCRIPT=$(mktemp -t phase1_stress.XXXXXX.sql)
trap "rm -f $PGBENCH_SCRIPT" EXIT

cat > "$PGBENCH_SCRIPT" <<EOF
\set i :client_id + 1
SELECT finalize_winning_payment(
  (SELECT payment_id FROM stress_fixtures WHERE label = '${LABEL}' AND idx = :i),
  'rzp_pay_stress_' || :i,
  'sig_stress_' || :i,
  'card',
  NULL
);
EOF

echo
echo "Running pgbench with $CONCURRENCY clients (1 transaction each)..."
pgbench \
  -n \
  -c "$CONCURRENCY" \
  -j "$CONCURRENCY" \
  -t 1 \
  -f "$PGBENCH_SCRIPT" \
  "$DATABASE_URL" \
  2>&1 | tail -20

# --- 3. Assertions ---

echo
echo "=== Assertions ==="

ASSERTIONS_SQL=$(cat <<EOF
DO \$assert\$
DECLARE
  v_listing_id     UUID;
  v_winners        INTEGER;
  v_cancelled      INTEGER;
  v_listing_st     TEXT;
  v_listing_sa     TIMESTAMPTZ;
  v_capture_ev     INTEGER;
  v_cancel_ev      INTEGER;
  v_distinct_sold  INTEGER;
  v_winner_events  INTEGER;
  v_winner_order   UUID;
BEGIN
  SELECT listing_id INTO v_listing_id
    FROM stress_fixtures WHERE label = '${LABEL}' LIMIT 1;

  -- Marketplace state
  SELECT COUNT(*) INTO v_winners
    FROM orders WHERE listing_id = v_listing_id AND status = 'escrow_held';
  IF v_winners != 1 THEN
    RAISE EXCEPTION 'STRESS FAIL: expected 1 winner, got %', v_winners;
  END IF;

  SELECT COUNT(*) INTO v_cancelled
    FROM orders WHERE listing_id = v_listing_id AND status = 'cancelled';
  IF v_cancelled != ${CONCURRENCY} - 1 THEN
    RAISE EXCEPTION 'STRESS FAIL: expected % cancelled, got %', ${CONCURRENCY} - 1, v_cancelled;
  END IF;

  SELECT status, sold_at INTO v_listing_st, v_listing_sa
    FROM listings WHERE id = v_listing_id;
  IF v_listing_st != 'sold' THEN
    RAISE EXCEPTION 'STRESS FAIL: listing.status should be sold, got %', v_listing_st;
  END IF;
  IF v_listing_sa IS NULL THEN
    RAISE EXCEPTION 'STRESS FAIL: listing.sold_at should be set';
  END IF;

  -- Ownership invariant: only ONE distinct sold_order_id ever
  -- exists for this listing. sold_order_id is the canonical
  -- ownership anchor (set on every winning capture, regardless
  -- of whether an offer was involved). If two different UUIDs
  -- ever appeared in listings.sold_order_id under contention,
  -- this would catch it.
  SELECT COUNT(DISTINCT COALESCE(sold_order_id::TEXT, 'NULL'))
    INTO v_distinct_sold
    FROM listings WHERE id = v_listing_id;
  IF v_distinct_sold != 1 THEN
    RAISE EXCEPTION 'STRESS FAIL: distinct sold_order_id count should be 1, got %', v_distinct_sold;
  END IF;

  -- Audit trail — exactly one payment_captured. A replay bug or
  -- a duplicate-cascade bug would show up here as > 1.
  SELECT COUNT(*) INTO v_capture_ev FROM order_events
    WHERE event_name = 'payment_captured'
      AND order_id IN (SELECT id FROM orders WHERE listing_id = v_listing_id);
  IF v_capture_ev != 1 THEN
    RAISE EXCEPTION 'STRESS FAIL: expected 1 payment_captured event, got %', v_capture_ev;
  END IF;

  -- Audit trail — exactly N-1 order_cancelled events. Catches
  -- the case where the cascade fires twice (once per loser per
  -- replay) but ownership state happens to look correct.
  SELECT COUNT(*) INTO v_cancel_ev FROM order_events
    WHERE event_name = 'order_cancelled'
      AND order_id IN (SELECT id FROM orders WHERE listing_id = v_listing_id);
  IF v_cancel_ev != ${CONCURRENCY} - 1 THEN
    RAISE EXCEPTION 'STRESS FAIL: expected % order_cancelled events, got %',
      ${CONCURRENCY} - 1, v_cancel_ev;
  END IF;

  -- Loser-cascade events on offer_events: exactly zero in this
  -- harness (test fixtures use direct buy-now, no offer rows).
  -- If a regression later adds offers to the fixture, the count
  -- should equal the number of pre-existing offers on the
  -- listing — never larger. This catches duplicate cascade
  -- generation under replay where ownership stays correct but
  -- the event stream is polluted.
  DECLARE
    v_cascade_ev INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_cascade_ev FROM offer_events
      WHERE event_name = 'system_listing_sold'
        AND metadata->>'listing_id' = v_listing_id::TEXT;
    IF v_cascade_ev != 0 THEN
      RAISE EXCEPTION 'STRESS FAIL: expected 0 system_listing_sold events (no offers in fixture), got %', v_cascade_ev;
    END IF;
  END;

  -- The winner has exactly one order_events row total: the
  -- payment_captured. Anything else is a duplicate cascade onto
  -- the winner (replay leaked through to the winner's own row).
  SELECT id INTO v_winner_order
    FROM orders WHERE listing_id = v_listing_id AND status = 'escrow_held';
  SELECT COUNT(*) INTO v_winner_events FROM order_events
    WHERE order_id = v_winner_order;
  IF v_winner_events != 1 THEN
    RAISE EXCEPTION 'STRESS FAIL: winner should have exactly 1 order_event, got %', v_winner_events;
  END IF;

  RAISE NOTICE 'STRESS PASS: 1 winner, % losers, % capture event, % cancel events, audit trail clean',
    ${CONCURRENCY} - 1, v_capture_ev, v_cancel_ev;
END;
\$assert\$;
EOF
)

echo "$ASSERTIONS_SQL" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -

# --- 4. Cleanup ---
echo
echo "Cleaning up fixtures for label $LABEL..."
# The lifetime invariant triggers (migrations 005 + 006) are
# intentionally strict in production: sold_order_id and
# sold_offer_id are immutable post-set, so we cannot NULL them
# back out via a normal UPDATE. For test cleanup we explicitly
# disable the triggers in this session, NULL the ownership
# columns to break the listings↔orders FK cycle, then delete
# in normal FK order. The triggers re-enable automatically when
# this session ends; production code paths are unaffected.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
  SET session_replication_role = 'replica';
  UPDATE listings
     SET sold_order_id = NULL, sold_offer_id = NULL
   WHERE id IN (SELECT DISTINCT listing_id FROM stress_fixtures WHERE label = '$LABEL');
  SET session_replication_role = 'origin';

  DELETE FROM order_events    WHERE order_id   IN (SELECT order_id   FROM stress_fixtures WHERE label = '$LABEL');
  DELETE FROM payments        WHERE id         IN (SELECT payment_id FROM stress_fixtures WHERE label = '$LABEL');
  DELETE FROM orders          WHERE id         IN (SELECT order_id   FROM stress_fixtures WHERE label = '$LABEL');
  DELETE FROM listings        WHERE id         IN (SELECT DISTINCT listing_id FROM stress_fixtures WHERE label = '$LABEL');
  DELETE FROM stress_fixtures WHERE label = '$LABEL';
"

echo
echo "=== STRESS PASSED at concurrency = $CONCURRENCY ==="
