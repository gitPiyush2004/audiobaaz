-- ============================================================
-- AUDIOBAAZ — Phase 1 part 2: refund lifecycle
-- ============================================================
--
-- Adds first-class refund-lifecycle state to the `payments`
-- table. Without this, "did we refund this person?" is
-- unanswerable from the database alone.
--
-- Architecture references:
--   docs/context/payments-shipping.md
--     "Refund lifecycle as first-class state"
--   docs/reviews/payments-session-zero.md §4.5 (target contract),
--     OQ#7 (REFUND LIFECYCLE LOCKED 2026-05-30)
--
-- Lifecycle:
--
--   NULL → pending → processing → succeeded   (terminal)
--                              → failed       (recoverable)
--   failed → processing                        (admin-driven retry)
--
-- payments.status = 'refunded' is set only when refund_status =
-- 'succeeded'. Buyer-facing copy is gated on refund_status, not
-- on payments.status or orders.status.
--
-- Order-side state is unaffected by refund processing status:
-- a buyer-favourable dispute lands the order at 'refunded'
-- (verdict reached) regardless of where the gateway-side refund
-- stands. This mirrors the locked V1 contract's earlier
-- separation of disputes.resolution (verdict) from orders.status
-- (money outcome).
-- ============================================================


-- ============================================================
-- 1 — Schema additions on `payments`
-- ============================================================

ALTER TABLE payments
  ADD COLUMN refund_id              TEXT NULL,
  ADD COLUMN refund_reason          TEXT NULL CHECK (refund_reason IN (
    'race_loss',
    'dispute_buyer_favour',
    'dispute_partial',
    'manual_admin'
  )),
  ADD COLUMN refund_status          TEXT NULL CHECK (refund_status IN (
    'pending',
    'processing',
    'succeeded',
    'failed'
  )),
  ADD COLUMN refund_initiated_at    TIMESTAMPTZ NULL,
  ADD COLUMN refund_completed_at    TIMESTAMPTZ NULL,
  ADD COLUMN refund_failure_reason  TEXT NULL;

CREATE INDEX payments_order_id      ON payments(order_id);
CREATE INDEX payments_refund_status ON payments(refund_status)
  WHERE refund_status IS NOT NULL;


-- ============================================================
-- 2 — Validity invariants
-- ============================================================
--
-- Cross-column rules that the refund-state machine assumes.
-- Implemented as table-level CHECK constraints so violations
-- are caught at write time, not at read time.

ALTER TABLE payments
  ADD CONSTRAINT payments_refund_initiated_consistency
    CHECK (
      -- If a refund_status is set, the refund must have been initiated.
      (refund_status IS NULL  AND refund_initiated_at IS NULL  AND refund_id IS NULL AND refund_reason IS NULL)
      OR
      (refund_status IS NOT NULL AND refund_initiated_at IS NOT NULL)
    );

ALTER TABLE payments
  ADD CONSTRAINT payments_refund_completed_consistency
    CHECK (
      -- Terminal states (succeeded, failed) require completed_at.
      -- In-flight states (pending, processing) must NOT have completed_at.
      (refund_status IN ('pending', 'processing') AND refund_completed_at IS NULL)
      OR
      (refund_status IN ('succeeded', 'failed')   AND refund_completed_at IS NOT NULL)
      OR
      (refund_status IS NULL AND refund_completed_at IS NULL)
    );

ALTER TABLE payments
  ADD CONSTRAINT payments_refund_failure_reason_consistency
    CHECK (
      -- failure_reason is set if and only if refund_status = 'failed'
      (refund_status = 'failed'  AND refund_failure_reason IS NOT NULL)
      OR
      (refund_status != 'failed' AND refund_failure_reason IS NULL)
      OR
      (refund_status IS NULL     AND refund_failure_reason IS NULL)
    );


-- ============================================================
-- 3 — initiate_refund(...) RPC
-- ============================================================
--
-- Called by:
--   - The Razorpay webhook handler when finalize_winning_payment
--     returns result='conflict' (race-loser refund).
--   - The admin dispute-resolution route when the verdict awards
--     a refund (buyer-favour or partial).
--   - The admin retry route on refund_status='failed' rows.
--
-- The RPC ONLY writes our DB state — it does not call Razorpay.
-- The handler is responsible for calling Razorpay's refund API
-- after this RPC marks the refund as 'pending' (or 'processing'
-- if the handler calls Razorpay first and we want to record the
-- in-flight state directly).
--
-- This keeps the RPC's atomicity boundary clean: it owns DB
-- state; the handler owns gateway calls. Same pattern as
-- finalize_winning_payment.
-- ============================================================

CREATE OR REPLACE FUNCTION initiate_refund(
  p_payment_id    UUID,
  p_reason        TEXT,                  -- one of the refund_reason CHECK values
  p_actor_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_now     TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_payment FROM payments
   WHERE id = p_payment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found: %', p_payment_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency: if a refund is already in flight or terminal,
  -- return the current state without re-initiating.
  IF v_payment.refund_status IS NOT NULL THEN
    RETURN jsonb_build_object(
      'result',         'noop',
      'reason',         'refund_already_in_progress_or_terminal',
      'refund_status',  v_payment.refund_status,
      'payment_id',     v_payment.id
    );
  END IF;

  -- Refund only makes sense for captured payments. Pre-capture
  -- failures don't need a refund (no money was taken).
  IF v_payment.status != 'captured' THEN
    RAISE EXCEPTION 'cannot refund payment in status %: %', v_payment.status, p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE payments
     SET refund_status       = 'pending',
         refund_reason       = p_reason,
         refund_initiated_at = v_now,
         updated_at          = v_now
   WHERE id = p_payment_id;

  -- Order-side audit row: the refund verdict is recorded against
  -- the order, not the payment, so support tooling can find it
  -- via the standard order timeline.
  INSERT INTO order_events (
    order_id, event_name, actor_type, actor_id,
    from_status, to_status, metadata
  )
  SELECT
    v_payment.order_id,
    -- The marketplace verdict transition (e.g. disputed→refunded)
    -- has its own event written by whoever drives that transition;
    -- here we record only the refund-process initiation.
    'refunded',
    CASE WHEN p_actor_id IS NULL THEN 'webhook' ELSE 'admin' END,
    p_actor_id,
    o.status, o.status,                  -- no order-status change here
    jsonb_build_object(
      'payment_id', v_payment.id,
      'refund_reason', p_reason,
      'refund_status', 'pending'
    )
  FROM orders o WHERE o.id = v_payment.order_id;

  RETURN jsonb_build_object(
    'result',        'initiated',
    'payment_id',    v_payment.id,
    'order_id',      v_payment.order_id,
    'refund_status', 'pending'
  );
END;
$$;

ALTER FUNCTION initiate_refund(UUID, TEXT, UUID) SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION initiate_refund(UUID, TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION initiate_refund(UUID, TEXT, UUID) TO service_role;


-- ============================================================
-- 4 — record_refund_outcome(...) RPC
-- ============================================================
--
-- Called by the Razorpay refund webhook (or the synchronous
-- handler after the refund API call returns) to advance
-- refund_status:
--
--   pending    → processing  (Razorpay accepted the refund request)
--   processing → succeeded   (Razorpay confirms money returned)
--   processing → failed      (Razorpay rejects or repeatedly errors)
--   failed     → processing  (admin-driven retry; resets the failure_reason)
--
-- payments.status flips to 'refunded' only on 'succeeded'.
-- ============================================================

CREATE OR REPLACE FUNCTION record_refund_outcome(
  p_payment_id     UUID,
  p_new_status     TEXT,                 -- 'processing' | 'succeeded' | 'failed'
  p_refund_id      TEXT DEFAULT NULL,    -- Razorpay refund_id
  p_failure_reason TEXT DEFAULT NULL,
  p_actor_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment    payments%ROWTYPE;
  v_now        TIMESTAMPTZ := NOW();
  v_terminal   BOOLEAN;
BEGIN
  IF p_new_status NOT IN ('processing', 'succeeded', 'failed') THEN
    RAISE EXCEPTION 'invalid refund outcome: %', p_new_status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_payment FROM payments
   WHERE id = p_payment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found: %', p_payment_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.refund_status IS NULL THEN
    RAISE EXCEPTION 'no refund initiated for payment %', p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Allowed transitions:
  --   pending    → processing | succeeded | failed
  --   processing → succeeded  | failed
  --   failed     → processing                (retry)
  --   succeeded  → (none — terminal)
  IF v_payment.refund_status = 'succeeded' THEN
    -- Idempotent replay of the success event.
    RETURN jsonb_build_object(
      'result',        'noop',
      'reason',        'refund_already_succeeded',
      'refund_status', 'succeeded'
    );
  END IF;

  IF v_payment.refund_status = 'failed' AND p_new_status != 'processing' THEN
    RAISE EXCEPTION 'failed refund can only retry via processing, got %', p_new_status
      USING ERRCODE = 'P0001';
  END IF;

  v_terminal := p_new_status IN ('succeeded', 'failed');

  UPDATE payments
     SET refund_status         = p_new_status,
         refund_id             = COALESCE(p_refund_id, v_payment.refund_id),
         refund_failure_reason = CASE
           WHEN p_new_status = 'failed' THEN p_failure_reason
           ELSE NULL                                              -- retry clears prior failure_reason
         END,
         refund_completed_at   = CASE WHEN v_terminal THEN v_now ELSE NULL END,
         status                = CASE
           WHEN p_new_status = 'succeeded' THEN 'refunded'
           ELSE v_payment.status
         END,
         updated_at            = v_now
   WHERE id = p_payment_id;

  INSERT INTO order_events (
    order_id, event_name, actor_type, actor_id,
    from_status, to_status, metadata
  )
  SELECT
    v_payment.order_id,
    CASE WHEN p_new_status = 'succeeded' THEN 'refunded' ELSE 'refunded' END,
    CASE WHEN p_actor_id IS NULL THEN 'webhook' ELSE 'admin' END,
    p_actor_id,
    o.status, o.status,
    jsonb_build_object(
      'payment_id', v_payment.id,
      'refund_status_from', v_payment.refund_status,
      'refund_status_to',   p_new_status,
      'refund_id',          p_refund_id,
      'failure_reason',     p_failure_reason
    )
  FROM orders o WHERE o.id = v_payment.order_id;

  RETURN jsonb_build_object(
    'result',        'recorded',
    'payment_id',    v_payment.id,
    'refund_status', p_new_status
  );
END;
$$;

ALTER FUNCTION record_refund_outcome(UUID, TEXT, TEXT, TEXT, UUID) SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION record_refund_outcome(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION record_refund_outcome(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
