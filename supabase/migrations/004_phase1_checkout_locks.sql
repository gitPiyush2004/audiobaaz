-- ============================================================
-- AUDIOBAAZ — Phase 1 part 3: checkout_locks
-- ============================================================
--
-- Optimisation, not correctness.
--
-- Decision 6 of the locked V1 contract makes the listing remain
-- 'approved' until capture. That means simultaneous captures
-- are an *expected* outcome under contention; the DB invariant
-- (listings.sold_offer_id UNIQUE) and atomic RPC are what
-- guarantee correctness.
--
-- checkout_locks reduces the rate of loser refunds by serialising
-- /api/payments/create calls per listing for a short TTL. If
-- this table fails or is bypassed, the system still behaves
-- correctly — it just generates more loser refunds and more
-- support volume. There is NO scenario in which a checkout_locks
-- failure produces ownership corruption.
--
-- Architecture references:
--   docs/context/payments-shipping.md
--     "Race-loser refund flow (three layers)" — Layer 1
--     Hard Prerequisite #8
--   docs/reviews/payments-session-zero.md OQ#6
-- ============================================================


CREATE TABLE checkout_locks (
  listing_id   UUID PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id     UUID NOT NULL REFERENCES users(id),
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX checkout_locks_expires_at ON checkout_locks(expires_at);


-- ============================================================
-- acquire_checkout_lock(...) — soft lock for /api/payments/create
-- ============================================================
--
-- Returns:
--   { "result": "acquired",  ... }  → caller proceeds to issue Razorpay order
--   { "result": "held_by_other", "expires_at": ... }
--                                    → caller returns "another buyer is checking
--                                       out — try again in N seconds"
--
-- Idempotency: if the same (listing_id, buyer_id) holds an
-- unexpired lock, returns 'acquired' (the buyer can re-attempt
-- their own checkout). Re-acquisition does NOT extend the TTL —
-- the original expires_at is preserved to bound the lock window
-- regardless of retries.
-- ============================================================

CREATE OR REPLACE FUNCTION acquire_checkout_lock(
  p_listing_id UUID,
  p_buyer_id   UUID,
  p_ttl_minutes INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing checkout_locks%ROWTYPE;
  v_now      TIMESTAMPTZ := NOW();
  v_expires  TIMESTAMPTZ := NOW() + (p_ttl_minutes || ' minutes')::INTERVAL;
BEGIN
  SELECT * INTO v_existing
  FROM checkout_locks
  WHERE listing_id = p_listing_id
  FOR UPDATE;

  IF FOUND THEN
    -- Existing lock: expired → take it; same buyer → idempotent;
    -- different buyer + unexpired → conflict.
    IF v_existing.expires_at <= v_now THEN
      UPDATE checkout_locks
         SET buyer_id    = p_buyer_id,
             acquired_at = v_now,
             expires_at  = v_expires
       WHERE listing_id = p_listing_id;
      RETURN jsonb_build_object(
        'result',     'acquired',
        'reason',     'reclaimed_expired_lock',
        'expires_at', v_expires
      );
    END IF;

    IF v_existing.buyer_id = p_buyer_id THEN
      RETURN jsonb_build_object(
        'result',     'acquired',
        'reason',     'idempotent_same_buyer',
        'expires_at', v_existing.expires_at
      );
    END IF;

    RETURN jsonb_build_object(
      'result',     'held_by_other',
      'expires_at', v_existing.expires_at
    );
  END IF;

  INSERT INTO checkout_locks (listing_id, buyer_id, acquired_at, expires_at)
  VALUES (p_listing_id, p_buyer_id, v_now, v_expires);

  RETURN jsonb_build_object(
    'result',     'acquired',
    'reason',     'fresh_lock',
    'expires_at', v_expires
  );
END;
$$;

ALTER FUNCTION acquire_checkout_lock(UUID, UUID, INTEGER)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION acquire_checkout_lock(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION acquire_checkout_lock(UUID, UUID, INTEGER) TO service_role;


-- ============================================================
-- release_checkout_lock(...)
-- ============================================================
--
-- Called when a checkout completes (capture succeeded → lock
-- redundant) or is abandoned (buyer closed the modal → free
-- the lock for the next buyer instead of waiting for TTL).
-- Idempotent: missing lock or wrong buyer is a no-op.
-- ============================================================

CREATE OR REPLACE FUNCTION release_checkout_lock(
  p_listing_id UUID,
  p_buyer_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM checkout_locks
  WHERE listing_id = p_listing_id
    AND buyer_id   = p_buyer_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'result',  CASE WHEN v_deleted = 0 THEN 'noop' ELSE 'released' END,
    'deleted', v_deleted
  );
END;
$$;

ALTER FUNCTION release_checkout_lock(UUID, UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION release_checkout_lock(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION release_checkout_lock(UUID, UUID) TO service_role;


-- ============================================================
-- Note on cleanup
-- ============================================================
--
-- Expired locks are reclaimed lazily at acquire time (see the
-- expired-branch in acquire_checkout_lock above). A scheduled
-- cleanup job is NOT required for V1 — the table size is
-- bounded by the number of unique listings under active
-- checkout, and each row self-clears on next contention. If
-- the table ever grows unbounded in production, add pg_cron:
--
--   DELETE FROM checkout_locks WHERE expires_at < NOW();
--
-- Until then, this remains the simplest implementation that
-- satisfies the optimisation goal.
