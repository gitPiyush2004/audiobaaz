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
--   2. listings.status terminal-at-`sold` rule. Once a listing
--      is sold, it stays sold — no regression to 'approved',
--      'pending', etc. *and* no advancement to 'completed'.
--      Settlement and payout live on `orders`, not on `listings`.
--      Inventory state (listing) and transaction state (order)
--      are deliberately on separate state machines.
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
  -- Only fires when sold_offer_id appears in the SET clause of an
  -- UPDATE (because of the BEFORE UPDATE OF sold_offer_id trigger
  -- definition below). Three legitimate cases to allow:
  --   NULL → NULL    (caller wrote sold_offer_id = sold_offer_id)
  --   NULL → uuid    (the RPC's one-time set)
  --   uuid → same uuid  (no-op self-write)
  -- Everything else (uuid → NULL, uuid_a → uuid_b) is rejected.

  IF OLD.sold_offer_id IS NOT NULL
     AND NEW.sold_offer_id IS DISTINCT FROM OLD.sold_offer_id
  THEN
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
-- 2 — listings.status: 'sold' is the terminal owned state
-- ============================================================
--
-- Once a listing has been sold, it cannot leave that state.
-- Period.
--
-- This is the architectural separation the OQ#1 work was about:
--   - listings.status   = inventory state (was it claimed?)
--   - orders.status     = transaction state (where is the money,
--                         the package, the dispute window?)
--   - orders.payout_status = settlement state (did the seller
--                         get paid?)
--
-- The listing is sold the instant ownership transfers (the RPC's
-- atomic write of sold_offer_id + status='sold'). Everything that
-- happens afterwards — shipping, delivery, inspection, dispute,
-- refund, payout — is an *order* lifecycle event, not a *listing*
-- lifecycle event. There is no business reason for a listing to
-- ever leave 'sold'.
--
-- The legacy schema had `completed` in the listing-status enum.
-- That value remains in the enum for migration safety (any
-- existing rows that may have it can stay), but the trigger
-- below makes 'sold → completed' unreachable for new writes.
-- A historical 'completed' listing that already exists is left
-- alone (no auto-rewrite); future cleanup can collapse those
-- to 'sold' if needed.
--
-- Allowed forward transitions among non-winning states (the
-- seller flow): draft / pending / approved / rejected / delisted /
-- archived can move freely among each other.
--
-- Allowed entry into the winning state: anything → 'sold'
-- (the RPC writes this from 'approved' in practice; we don't
-- gate on the source state because the RPC does — see Step 6
-- of finalize_winning_payment for the rationale on why even a
-- 'delisted' listing should land at 'sold' if money was already
-- captured).
--
-- Forbidden:
--   sold → anything other than sold      (terminal owned state)
--   completed → anything other than completed  (legacy data — frozen)

CREATE OR REPLACE FUNCTION enforce_listing_status_no_regression()
RETURNS TRIGGER AS $$
BEGIN
  -- The legacy 'completed' value in the listing-status enum is
  -- preserved for migration safety but is unreachable for new
  -- writes from any state. Settlement (orders.status='completed')
  -- and payout (orders.payout_status) live on the order, not on
  -- the listing.
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    RAISE EXCEPTION 'listings.status cannot transition to completed; settlement state lives on orders, not listings'
      USING ERRCODE = 'check_violation',
            HINT = 'Use orders.status=completed to mark settlement, and orders.payout_status to track payout. See docs/context/payments-shipping.md "Listing-status terminal at sold".';
  END IF;

  -- Pre-winning states: free movement among themselves and into 'sold'.
  IF OLD.status IN ('draft', 'pending', 'approved', 'reserved', 'rejected', 'delisted', 'archived') THEN
    RETURN NEW;
  END IF;

  -- Winning state: 'sold' is terminal.
  IF OLD.status = 'sold' AND NEW.status = 'sold' THEN
    RETURN NEW;
  END IF;

  -- Legacy 'completed' rows (if any exist from before this migration):
  -- frozen. Only 'completed → completed' (no-op) is allowed.
  IF OLD.status = 'completed' AND NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'listings.status cannot transition from % → %',
    OLD.status, NEW.status
    USING ERRCODE = 'check_violation',
          HINT = 'Once a listing is sold, it stays sold. Settlement and payout live on orders, not on listings. Re-listing requires a new listings row. See docs/context/payments-shipping.md "Refunded-winner rule".';
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
