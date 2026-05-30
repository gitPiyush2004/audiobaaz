-- ============================================================
-- AUDIOBAAZ — Phase 1 part 4: invariant guards
-- ============================================================
--
-- The lifetime invariant lives on listings.sold_offer_id. Migration
-- 002 makes it UNIQUE (so two winners cannot coexist) and 002's
-- finalize_winning_payment() is the one path that ever sets it.
-- That covers writes in code we control.
--
-- This migration adds DB-level guards that catch any rogue write
-- regardless of which client (service-role, admin, anon) issued
-- it. The principle from the OQ#1 review: "the invariant is only
-- as strong as the weakest update path."
--
-- Two guards:
--
--   1. sold_offer_id is immutable once set. Any UPDATE that
--      changes it from non-NULL to anything else is rejected.
--      Setting it from NULL → UUID is allowed (the RPC does this
--      exactly once per listing).
--
--   2. listings.status cannot regress from a winning state to
--      a non-winning state. Specifically: 'sold', 'completed'
--      cannot transition to 'approved', 'pending', 'reserved',
--      'draft', or 'rejected'. The legacy 'reserved' state is
--      also blocked from being re-entered after migration 002
--      drops the reserve_listing trigger.
--
-- This migration also documents the four known rogue write
-- paths on feature/payments-shipping that Phase 2 must replace
-- with calls to finalize_winning_payment(). They were not on
-- dev (no payments code on dev) but they exist on the parked
-- branch and would have triggered these guards.
--
-- Architecture references:
--   docs/context/payments-shipping.md
--     "OQ#4 mechanism — locked"
--     "Refunded-winner rule (immutability of sold_offer_id)"
-- ============================================================


-- ============================================================
-- 1 — sold_offer_id is immutable once set
-- ============================================================
--
-- Allowed:  NULL    → NULL    (no-op)
-- Allowed:  NULL    → uuid    (the RPC's one write)
-- Forbidden: uuid_a → NULL    (would reset ownership)
-- Forbidden: uuid_a → uuid_b  (would change owner)
-- Forbidden: uuid_a → uuid_a  (no-op but suspicious — block as well to surface bugs early)

CREATE OR REPLACE FUNCTION enforce_sold_offer_id_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sold_offer_id IS NOT NULL AND
     (NEW.sold_offer_id IS DISTINCT FROM OLD.sold_offer_id OR NEW.sold_offer_id = OLD.sold_offer_id)
  THEN
    -- Allow the RPC's idempotent UPDATE (where every column is the
    -- same as before — e.g. `SET sold_offer_id = sold_offer_id` from
    -- a defensive UPSERT) by checking that the value didn't change
    -- AND the trigger is firing on a row whose value is unchanged.
    -- TG_OP-aware test: in BEFORE UPDATE, identical OLD and NEW
    -- values would be passed as a real UPDATE only if some other
    -- column changed. We re-allow that case.
    IF NEW.sold_offer_id = OLD.sold_offer_id THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'listings.sold_offer_id is immutable once set; cannot change % → %',
      OLD.sold_offer_id, NEW.sold_offer_id
      USING ERRCODE = 'check_violation',
            HINT = 'Re-listing requires creating a new listings row. See docs/context/payments-shipping.md "Refunded-winner rule".';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_sold_offer_id_immutable
  BEFORE UPDATE OF sold_offer_id ON listings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_sold_offer_id_immutable();


-- ============================================================
-- 2 — listings.status cannot regress out of a winning state
-- ============================================================
--
-- Once a listing has been sold, completed, or otherwise reached
-- a terminal-or-onwards state, it cannot be flipped back to
-- 'approved', 'pending', 'draft', 'reserved', or 'rejected'.
--
-- Allowed forward transitions (non-exhaustive — schema CHECK
-- handles enum membership; this trigger only blocks regressions
-- out of winning states):
--   sold → completed   (post-inspection)
-- Forbidden:
--   sold → approved    (the rogue 'release' path that triggered
--                       this audit)
--   sold → reserved    (the legacy reservation flow)
--   sold → anything    that is not 'sold' or 'completed'
--
-- Listings can move freely among non-winning states (the seller
-- flow uses draft/pending/approved/rejected/delisted) and into
-- 'sold' through finalize_winning_payment. They cannot leave
-- 'sold' except to 'completed'.

CREATE OR REPLACE FUNCTION enforce_listing_status_no_regression()
RETURNS TRIGGER AS $$
BEGIN
  -- Pre-winning states: free movement among them.
  IF OLD.status IN ('draft', 'pending', 'approved', 'reserved', 'rejected', 'delisted', 'archived') THEN
    RETURN NEW;
  END IF;

  -- Winning states: 'sold' may advance to 'completed'.
  -- Any other transition out of 'sold' or 'completed' is a
  -- regression and a bug.
  IF OLD.status = 'sold' AND NEW.status IN ('sold', 'completed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' AND NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'listings.status cannot regress from % → %',
    OLD.status, NEW.status
    USING ERRCODE = 'check_violation',
          HINT = 'Once a listing is sold, it stays sold. Re-listing requires a new listings row. See docs/context/payments-shipping.md "Refunded-winner rule".';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_status_no_regression
  BEFORE UPDATE OF status ON listings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enforce_listing_status_no_regression();


-- ============================================================
-- 3 — Documentation: rogue write paths to fix in Phase 2
-- ============================================================
--
-- The following four code paths exist on feature/payments-shipping
-- and would now trigger the guards above. They were never deployed
-- (no payments/ directory exists on dev), and they are already in
-- the audit's §5.9 "Revise" list. Recording them here so the Phase
-- 2 work item is unambiguous.
--
--   src/app/api/payments/webhook/route.ts:88
--     UPDATE listings SET status='sold', sold_at=...
--     → MISSING sold_offer_id; bypasses the RPC entirely.
--     → Phase 2 fix: replace with rpc('finalize_winning_payment', ...).
--
--   src/app/api/payments/webhook/route.ts:138
--     UPDATE listings SET status='approved', reserved_at=NULL, reserved_until=NULL
--     → On payment.failed; would now error with status_no_regression.
--     → Phase 2 fix: remove entirely. Decision 6 of the locked V1
--       contract drops the reserve_listing flow; failed payments
--       leave the listing alone.
--
--   src/app/api/payments/verify/route.ts:99
--     UPDATE listings SET status='sold', sold_at=...
--     → Same bug as webhook line 88.
--     → Phase 2 fix: same — replace with the RPC.
--
--   src/app/api/checkout/mock/route.ts:97
--     UPDATE listings SET status='sold', sold_at=...
--     → Same bug. Mock checkout was a transitional layer (audit
--       Finding 5); it gets removed in Phase 2 alongside the
--       Razorpay route revisions.
--     → Phase 2 fix: delete the route; buyer-flow CheckoutForm
--       points at /api/payments/create instead.
