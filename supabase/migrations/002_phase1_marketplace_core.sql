-- ============================================================
-- AUDIOBAAZ — Phase 1: Marketplace Core (transactional correctness)
-- ============================================================
--
-- This migration lands the schema substrate the locked V1 architecture
-- requires for transactional correctness:
--
--   1. Audit tables (offer_events, order_events, webhook_events)
--   2. Lifetime invariant column (listings.sold_offer_id UUID UNIQUE NULL)
--   3. Enum amendments (offers + orders) per the locked V1 contract
--   4. Drop reserve_listing trigger (Decision 6: listing stays approved
--      until capture)
--   5. The atomic finalize_winning_payment(...) RPC — single transaction
--      that commits the entire winner cascade or rolls back
--
-- Refund-lifecycle columns on payments and the checkout_locks table
-- are deliberately NOT in this migration — they follow as subsequent
-- migrations (Phase 1 priorities 3 and 4 respectively). The Phase 1
-- four-scenario acceptance tests in supabase/tests/phase1_scenarios.sql
-- prove this migration's correctness before refunds and locks land.
--
-- Architecture references:
--   docs/context/payments-shipping.md
--     "Order state machine — locked V1 contract (OQ#1 resolved)"
--     "The lifetime invariant"
--     "OQ#4 mechanism — locked"
--     "Refunded-winner rule (immutability of sold_offer_id)"
--   docs/reviews/payments-session-zero.md §4.7 (RPC contract)
-- ============================================================


-- ============================================================
-- 0 — PORTABILITY SHIMS for non-Supabase Postgres
-- ============================================================
--
-- Supabase provisions the `service_role` role and the `auth` schema
-- (with `auth.uid()`) on every project. A vanilla Postgres
-- (Docker postgres:15, fresh `apt install`, CI service container)
-- has neither. These shims make the migrations apply cleanly on
-- both, so verification can run anywhere with `psql`.
--
-- On a real Supabase project these statements are idempotent
-- no-ops — the role/schema/function already exist.

-- service_role: create if missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

-- auth schema + auth.uid(): create stub if missing.
-- The stub returns NULL, which is the correct behaviour for any
-- non-authenticated session (e.g. tests run as the postgres
-- superuser). Real Supabase auth.uid() reads the JWT from the
-- request context; tests don't have one.
--
-- CRITICAL: this MUST be `IF NOT EXISTS` semantics, not
-- CREATE OR REPLACE. On a real Supabase project, auth.uid()
-- is the production implementation and we must not clobber it.
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE 'CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS ''SELECT NULL::UUID;'' ';
  END IF;
END
$$;


-- ============================================================
-- 1 — ENUM AMENDMENTS
-- ============================================================
--
-- offers.status: add 'lost' (locked OQ#2). Reached only via
-- system_listing_sold cascade from a verified capture.
--
-- orders.status: add 'cancelled' (locked V1 contract branch:
-- payment_pending → cancelled).

ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers ADD CONSTRAINT offers_status_check
  CHECK (status IN (
    'pending', 'accepted', 'declined', 'expired',
    'paid', 'cancelled', 'lost'
  ));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'payment_pending', 'payment_failed', 'escrow_held',
    'seller_confirmed', 'shipped', 'delivered', 'inspection',
    'completed', 'disputed', 'refunded', 'partially_refunded',
    'cancelled'
  ));


-- ============================================================
-- 2 — DROP reserve_listing TRIGGER
-- ============================================================
--
-- Decision 6 of the locked V1 contract: listing remains available
-- (status = 'approved') until capture. The listing flips
-- approved → sold atomically with escrow_held inside the RPC,
-- never at order INSERT. The reserve_listing trigger flipped
-- approved → reserved on order INSERT — exactly the behaviour we
-- are eliminating.

DROP TRIGGER IF EXISTS orders_reserve_listing ON orders;
DROP FUNCTION IF EXISTS reserve_listing();


-- ============================================================
-- 3 — LIFETIME INVARIANT — listings.sold_offer_id
-- ============================================================
--
-- OQ#4 mechanism locked. Set once inside finalize_winning_payment()
-- at the moment of escrow_held; never unset, never updated. The
-- UNIQUE constraint enforces lifetime exclusivity:
--
--   "A listing can have at most one winning offer."
--
-- Refunded-winner rule: a fully-refunded winning order leaves both
-- listings.status = 'sold' and listings.sold_offer_id intact.
-- Re-listing requires a new listings row.

ALTER TABLE listings
  ADD COLUMN sold_offer_id UUID UNIQUE NULL REFERENCES offers(id);

CREATE INDEX listings_sold_offer_id ON listings(sold_offer_id)
  WHERE sold_offer_id IS NOT NULL;


-- ============================================================
-- 4 — AUDIT TABLES
-- ============================================================
--
-- Append-only event logs. Every offer/order state transition writes
-- one row. webhook_events is the idempotency table for inbound
-- provider events (Razorpay, Shiprocket, future).

CREATE TABLE offer_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id     UUID NOT NULL REFERENCES offers(id),
  event_name   TEXT NOT NULL CHECK (event_name IN (
    'seller_accept', 'seller_decline', 'buyer_cancel',
    'buyer_pay', 'system_expire_seller', 'system_expire_buyer',
    'system_listing_sold'
  )),
  actor_type   TEXT NOT NULL CHECK (actor_type IN (
    'buyer', 'seller', 'system', 'webhook', 'admin'
  )),
  actor_id     UUID REFERENCES users(id),  -- NULL for system / webhook
  from_status  TEXT NOT NULL,
  to_status    TEXT NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX offer_events_offer_id   ON offer_events(offer_id);
CREATE INDEX offer_events_event_name ON offer_events(event_name);
CREATE INDEX offer_events_created_at ON offer_events(created_at);


CREATE TABLE order_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES orders(id),
  event_name   TEXT NOT NULL CHECK (event_name IN (
    'order_created', 'payment_captured', 'payment_failed',
    'order_cancelled', 'shipment_created', 'shipped', 'delivered',
    'inspection_started', 'completed', 'disputed', 'refunded',
    'partially_refunded', 'admin_recovery_override'
  )),
  actor_type   TEXT NOT NULL CHECK (actor_type IN (
    'buyer', 'seller', 'system', 'webhook', 'admin'
  )),
  actor_id     UUID REFERENCES users(id),
  from_status  TEXT,                       -- NULL for the initial order_created event
  to_status    TEXT NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_events_order_id   ON order_events(order_id);
CREATE INDEX order_events_event_name ON order_events(event_name);
CREATE INDEX order_events_created_at ON order_events(created_at);


CREATE TABLE webhook_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider            TEXT NOT NULL CHECK (provider IN ('razorpay', 'shiprocket')),
  provider_event_id   TEXT NOT NULL,
  event_type          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'failed', 'replayed')),
  raw_payload         JSONB NOT NULL,
  signature_verified  BOOLEAN NOT NULL,
  error_message       TEXT,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX webhook_events_status      ON webhook_events(status);
CREATE INDEX webhook_events_received_at ON webhook_events(received_at);


-- ============================================================
-- 5 — RLS on audit tables
-- ============================================================
--
-- Audit tables: parties read their own; admin reads all; no INSERT
-- or UPDATE from user roles (writes happen exclusively from RPCs
-- and service-role webhook handlers). Append-only by convention —
-- there is no UPDATE or DELETE policy, so even admins cannot
-- rewrite history through the standard API.
--
-- webhook_events: service-role only. No user-role policies.

ALTER TABLE offer_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- offer_events: parties read their own; admin reads all
CREATE POLICY "offer_events_read_parties_or_admin" ON offer_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM offers o
      WHERE o.id = offer_events.offer_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- order_events: parties read their own; admin reads all
CREATE POLICY "order_events_read_parties_or_admin" ON order_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_events.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- webhook_events: no user-role policies → deny all by default;
-- service-role bypasses RLS.


-- ============================================================
-- 6 — finalize_winning_payment(...) — atomic RPC
-- ============================================================
--
-- The single transaction that commits the entire winner cascade.
-- Either every write below commits together, or none commit.
--
-- Inputs:
--   p_payment_id           — the payments row representing the verified capture
--   p_razorpay_payment_id  — Razorpay payment_id (verified, signature already checked)
--   p_razorpay_signature   — verified signature (stored for audit)
--   p_method               — Razorpay payment method (card, upi, etc.)
--   p_actor_id             — the auth.uid() of the buyer; NULL for webhook ingress
--
-- Returns JSONB with one of:
--   { "result": "winner",   "winner_order_id": ..., "listing_id": ..., "losers_count": N }
--   { "result": "conflict", "reason": "listing_already_sold", ... }
--   { "result": "noop",     "reason": "payment_already_captured", ... }
--
-- The webhook handler interprets:
--   - "winner"   → notify seller, await Shiprocket flow
--   - "conflict" → enqueue race-loser refund (Phase 1 priority 3)
--   - "noop"     → idempotent replay; do nothing
--
-- Caller responsibilities (NOT done inside this RPC):
--   - Verify Razorpay webhook signature (before calling)
--   - Insert into webhook_events with status='received' (before calling)
--   - On "conflict" result, initiate the Razorpay refund
--   - On any result, update webhook_events.status='processed'
--
-- This separation keeps the RPC's atomicity boundary clean:
-- the RPC owns marketplace state; the handler owns gateway calls.
-- ============================================================

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
  v_payment      payments%ROWTYPE;
  v_order        orders%ROWTYPE;
  v_listing_sold UUID;
  v_losers_count INTEGER;
  v_now          TIMESTAMPTZ := NOW();
BEGIN
  -- ----------------------------------------------------------
  -- Step 1 — Lock the payment row and the order row in a
  -- consistent order. SELECT ... FOR UPDATE serialises any
  -- concurrent finalize calls for the same payment.
  -- ----------------------------------------------------------
  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found: %', p_payment_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency: replay of an already-processed event is a no-op.
  IF v_payment.status = 'captured' THEN
    RETURN jsonb_build_object(
      'result', 'noop',
      'reason', 'payment_already_captured',
      'payment_id', v_payment.id
    );
  END IF;

  IF v_payment.status NOT IN ('created', 'authorized') THEN
    RAISE EXCEPTION 'payment in unexpected status %: %', v_payment.status, p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ----------------------------------------------------------
  -- Step 2 — Lock the order. Required because we will update
  -- orders.status and emit an order_events row.
  -- ----------------------------------------------------------
  SELECT * INTO v_order
  FROM orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found for payment %: order_id=%', p_payment_id, v_payment.order_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status NOT IN ('payment_pending', 'payment_failed') THEN
    RAISE EXCEPTION 'order in unexpected status % for capture: %', v_order.status, v_order.id
      USING ERRCODE = 'P0001';
  END IF;

  -- ----------------------------------------------------------
  -- Step 3 — Lifetime-invariant check.
  -- The UNIQUE constraint on listings.sold_offer_id is the
  -- definitive guard, but we read first so we can return a
  -- typed conflict result instead of a constraint-violation
  -- error to the caller.
  -- ----------------------------------------------------------
  SELECT sold_offer_id INTO v_listing_sold
  FROM listings
  WHERE id = v_order.listing_id
  FOR UPDATE;

  IF v_listing_sold IS NOT NULL THEN
    -- Another order won. Mark this order as cancelled (terminal
    -- pre-winner state); caller initiates the gateway refund.
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
        'reason', 'listing_already_sold',
        'winning_offer_id', v_listing_sold,
        'razorpay_payment_id', p_razorpay_payment_id
      )
    );

    RETURN jsonb_build_object(
      'result',           'conflict',
      'reason',           'listing_already_sold',
      'order_id',         v_order.id,
      'listing_id',       v_order.listing_id,
      'winning_offer_id', v_listing_sold
    );
  END IF;

  -- ----------------------------------------------------------
  -- Step 4 — Update payments → captured.
  -- ----------------------------------------------------------
  UPDATE payments
     SET status              = 'captured',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = p_razorpay_signature,
         method              = p_method,
         updated_at          = v_now
   WHERE id = p_payment_id;

  -- ----------------------------------------------------------
  -- Step 5 — Update orders → escrow_held.
  -- ----------------------------------------------------------
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
      'payment_id', p_payment_id,
      'razorpay_payment_id', p_razorpay_payment_id
    )
  );

  -- ----------------------------------------------------------
  -- Step 6 — Update listings → sold + sold_offer_id.
  -- The UNIQUE constraint on sold_offer_id will fire here if
  -- a concurrent transaction won the race; if so, this UPDATE
  -- raises a unique_violation that rolls the entire RPC back.
  -- The handler will retry-by-replay; on retry, Step 3 sees
  -- the listing is sold and returns "conflict" cleanly.
  --
  -- We intentionally do NOT guard on listings.status here
  -- (e.g. WHERE status = 'approved'). The buyer-flow API
  -- already validates listing.status = 'approved' before
  -- creating an order, and Step 3 has already verified
  -- sold_offer_id IS NULL. If a listing somehow reaches this
  -- step in 'delisted' or 'archived' state, the right
  -- response is still "claim it as sold" — overruling a
  -- delisting once money has been captured prevents seller
  -- abuse (delist mid-checkout to avoid a sale).
  -- ----------------------------------------------------------
  UPDATE listings
     SET status        = 'sold',
         sold_offer_id = v_order.offer_id,
         sold_at       = v_now,
         updated_at    = v_now
   WHERE id = v_order.listing_id;

  -- ----------------------------------------------------------
  -- Step 7 — Winner offer (if this is a negotiated purchase) →
  -- accepted → paid. Direct buy-now orders have offer_id = NULL.
  -- ----------------------------------------------------------
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
        'order_id', v_order.id,
        'payment_id', p_payment_id
      )
    );
  END IF;

  -- ----------------------------------------------------------
  -- Step 8 — Cascade: every other open offer on this listing
  -- becomes 'lost' via system_listing_sold. This is the only
  -- path to the 'lost' status.
  --
  -- We FOR UPDATE-lock each loser, capture its pre-update status,
  -- then update + emit the event. A single UPDATE ... RETURNING
  -- would return post-update status only; we need the pre-update
  -- value to write a faithful from_status into offer_events.
  -- ----------------------------------------------------------
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
          'listing_id', v_order.listing_id
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


-- ============================================================
-- 7 — RLS bypass for the RPC
-- ============================================================
--
-- finalize_winning_payment is invoked from the Razorpay webhook
-- handler with the service-role client (bypasses RLS by design).
-- The function itself runs with the caller's privileges; we mark
-- it SECURITY DEFINER so it can write to RLS-protected tables
-- when called via service-role anyway. SECURITY DEFINER is
-- intentional and SAFE here because:
--   1. The function is only callable by service-role contexts
--      (no user-role policies grant EXECUTE).
--   2. Inputs are typed and validated; no SQL is built from text.
--   3. The function has a single well-defined purpose with no
--      free-form parameters.
--   4. search_path is pinned to (public, pg_temp) so a malicious
--      schema higher in the user's search path cannot shadow our
--      tables/functions and execute under elevated privileges.
--      This is the standard hardening for SECURITY DEFINER and
--      catches the entire class of CVE-2018-1058-style bugs.

ALTER FUNCTION finalize_winning_payment(UUID, TEXT, TEXT, TEXT, UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION finalize_winning_payment(UUID, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION finalize_winning_payment(UUID, TEXT, TEXT, TEXT, UUID)
  TO service_role;
