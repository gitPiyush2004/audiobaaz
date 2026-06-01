-- ============================================================
-- AUDIOBAAZ — Phase 1 fix: ownership anchor moves to sold_order_id
-- ============================================================
--
-- Real bug surfaced by PR #2 CI Scenario A:
--
--   "second capture should be conflict, got winner"
--
-- Root cause: the lifetime invariant was anchored to
-- listings.sold_offer_id, which is NULL for direct buy-now orders
-- (no offer involved). UNIQUE on a NULL allows multiple NULL rows
-- per Postgres standard semantics, so two simultaneous direct
-- buy-now captures both wrote the same NULL and both won.
--
-- The marketplace is order-centric, not offer-centric. Ownership
-- belongs on the order, not on the (optional) offer. This migration
-- introduces sold_order_id as the new ownership anchor; sold_offer_id
-- is demoted to informational metadata.
--
-- This is a real-bug exception to the Phase 1 schema freeze. Scope
-- is intentionally minimal:
--   - Add listings.sold_order_id UUID UNIQUE NULL REFERENCES orders(id).
--   - Modify finalize_winning_payment(): conflict check on sold_order_id;
--     winner write always sets sold_order_id; sold_offer_id continues
--     to be set when offer-backed (informational).
--   - Add an immutability trigger for sold_order_id (matching the
--     existing one for sold_offer_id).
--   - No backfill, no data migration, no schema deletions. The live
--     Supabase project has zero captures today, so the column starts
--     empty everywhere.
--
-- Not changing in this migration:
--   - Application routes (/api/payments/*). They don't read either
--     ownership column; the RPC handles ownership writes.
--   - Refund lifecycle (003).
--   - checkout_locks (004).
--   - The status-no-regression trigger (005's second guard).
-- ============================================================


-- ============================================================
-- 1 — Add sold_order_id column on listings
-- ============================================================

ALTER TABLE listings
  ADD COLUMN sold_order_id UUID UNIQUE NULL REFERENCES orders(id);

CREATE INDEX listings_sold_order_id ON listings(sold_order_id)
  WHERE sold_order_id IS NOT NULL;


-- ============================================================
-- 2 — Replace finalize_winning_payment() with order-anchored RPC
-- ============================================================
--
-- Behaviour change scope:
--   Step 3 — conflict check reads sold_order_id (was sold_offer_id).
--   Step 6 — winner write sets sold_order_id = v_order.id (always),
--            and sold_offer_id = v_order.offer_id (when present,
--            for informational/audit purposes).
--
-- Everything else (lock ordering, idempotency, cascade logic, audit
-- writes, error codes) is unchanged.

CREATE OR REPLACE FUNCTION finalize_winning_payment(
  p_payment_id          UUID,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT,
  p_method              TEXT,
  p_actor_id            UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment       payments%ROWTYPE;
  v_order         orders%ROWTYPE;
  v_listing_owner UUID;
  v_losers_count  INTEGER;
  v_now           TIMESTAMPTZ := NOW();
BEGIN
  -- Step 1 — lock the payment row
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found: %', p_payment_id USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status = 'captured' THEN
    RETURN jsonb_build_object(
      'result',     'noop',
      'reason',     'payment_already_captured',
      'payment_id', v_payment.id
    );
  END IF;

  IF v_payment.status NOT IN ('created', 'authorized') THEN
    RAISE EXCEPTION 'payment in unexpected status %: %', v_payment.status, p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Step 2 — lock the order
  SELECT * INTO v_order FROM orders WHERE id = v_payment.order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found for payment %: order_id=%', p_payment_id, v_payment.order_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status NOT IN ('payment_pending', 'payment_failed') THEN
    RAISE EXCEPTION 'order in unexpected status % for capture: %', v_order.status, v_order.id
      USING ERRCODE = 'P0001';
  END IF;

  -- Step 3 — lifetime-invariant check, anchored on sold_order_id.
  -- The UNIQUE constraint on listings.sold_order_id is the definitive
  -- guard; we read first so we can return a typed conflict result.
  SELECT sold_order_id INTO v_listing_owner
    FROM listings WHERE id = v_order.listing_id FOR UPDATE;

  IF v_listing_owner IS NOT NULL THEN
    UPDATE orders
       SET status     = 'cancelled',
           updated_at = v_now
     WHERE id = v_order.id;

    INSERT INTO order_events (
      order_id, event_name, actor_type, actor_id,
      from_status, to_status, metadata
    ) VALUES (
      v_order.id, 'order_cancelled',
      CASE WHEN p_actor_id IS NULL THEN 'webhook' ELSE 'system' END,
      p_actor_id,
      v_order.status, 'cancelled',
      jsonb_build_object(
        'reason',              'listing_already_sold',
        'winning_order_id',    v_listing_owner,
        'razorpay_payment_id', p_razorpay_payment_id
      )
    );

    RETURN jsonb_build_object(
      'result',           'conflict',
      'reason',           'listing_already_sold',
      'order_id',         v_order.id,
      'listing_id',       v_order.listing_id,
      'winning_order_id', v_listing_owner
    );
  END IF;

  -- Step 4 — payments → captured
  UPDATE payments
     SET status              = 'captured',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = p_razorpay_signature,
         method              = p_method,
         updated_at          = v_now
   WHERE id = p_payment_id;

  -- Step 5 — orders → escrow_held + audit
  UPDATE orders
     SET status         = 'escrow_held',
         escrow_held_at = v_now,
         updated_at     = v_now
   WHERE id = v_order.id;

  INSERT INTO order_events (
    order_id, event_name, actor_type, actor_id,
    from_status, to_status, metadata
  ) VALUES (
    v_order.id, 'payment_captured',
    CASE WHEN p_actor_id IS NULL THEN 'webhook' ELSE 'system' END,
    p_actor_id,
    v_order.status, 'escrow_held',
    jsonb_build_object(
      'payment_id',          p_payment_id,
      'razorpay_payment_id', p_razorpay_payment_id
    )
  );

  -- Step 6 — listings → sold + ownership anchor.
  -- sold_order_id is the invariant anchor (always set).
  -- sold_offer_id is informational (set only when offer-backed; the
  -- existing UNIQUE constraint still protects against rewrites of
  -- a non-NULL value via migration 005's immutability trigger).
  UPDATE listings
     SET status        = 'sold',
         sold_order_id = v_order.id,
         sold_offer_id = v_order.offer_id,
         sold_at       = v_now,
         updated_at    = v_now
   WHERE id = v_order.listing_id;

  -- Step 7 — winner offer (when offer-backed) → paid + audit
  IF v_order.offer_id IS NOT NULL THEN
    UPDATE offers
       SET status     = 'paid',
           updated_at = v_now
     WHERE id = v_order.offer_id;

    INSERT INTO offer_events (
      offer_id, event_name, actor_type, actor_id,
      from_status, to_status, metadata
    ) VALUES (
      v_order.offer_id, 'buyer_pay',
      CASE WHEN p_actor_id IS NULL THEN 'webhook' ELSE 'system' END,
      p_actor_id,
      'accepted', 'paid',
      jsonb_build_object(
        'order_id',   v_order.id,
        'payment_id', p_payment_id
      )
    );
  END IF;

  -- Step 8 — cascade: every other open offer on this listing → 'lost'
  v_losers_count := 0;
  DECLARE
    rec RECORD;
  BEGIN
    FOR rec IN
      SELECT id, status AS from_status
        FROM offers
       WHERE listing_id = v_order.listing_id
         AND status IN ('pending', 'accepted')
         AND (v_order.offer_id IS NULL OR id != v_order.offer_id)
       FOR UPDATE
    LOOP
      UPDATE offers
         SET status     = 'lost',
             updated_at = v_now
       WHERE id = rec.id;

      INSERT INTO offer_events (
        offer_id, event_name, actor_type, actor_id,
        from_status, to_status, metadata
      ) VALUES (
        rec.id, 'system_listing_sold',
        CASE WHEN p_actor_id IS NULL THEN 'webhook' ELSE 'system' END,
        p_actor_id,
        rec.from_status, 'lost',
        jsonb_build_object(
          'winning_order_id', v_order.id,
          'winning_offer_id', v_order.offer_id,
          'listing_id',       v_order.listing_id
        )
      );

      v_losers_count := v_losers_count + 1;
    END LOOP;
  END;

  RETURN jsonb_build_object(
    'result',           'winner',
    'winner_order_id',  v_order.id,
    'winner_offer_id',  v_order.offer_id,
    'listing_id',       v_order.listing_id,
    'losers_count',     v_losers_count
  );
END;
$$;

ALTER FUNCTION finalize_winning_payment(UUID, TEXT, TEXT, TEXT, UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION finalize_winning_payment(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION finalize_winning_payment(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;


-- ============================================================
-- 3 — Immutability guard for sold_order_id
-- ============================================================
--
-- Mirrors migration 005's enforce_sold_offer_id_immutable: once
-- sold_order_id is set on a listing, it cannot change. The UNIQUE
-- constraint catches concurrent contention; this trigger catches
-- direct UPDATE attempts (admin tooling, rogue routes, etc.).

CREATE OR REPLACE FUNCTION enforce_sold_order_id_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sold_order_id IS NOT NULL
     AND NEW.sold_order_id IS DISTINCT FROM OLD.sold_order_id
  THEN
    RAISE EXCEPTION 'listings.sold_order_id is immutable once set; cannot change % → %',
      OLD.sold_order_id, NEW.sold_order_id
      USING ERRCODE = 'check_violation',
            HINT = 'Re-listing requires a new listings row. Ownership anchor cannot be reassigned.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_sold_order_id_immutable
  BEFORE UPDATE OF sold_order_id ON listings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_sold_order_id_immutable();
