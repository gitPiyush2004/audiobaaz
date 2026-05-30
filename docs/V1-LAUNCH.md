# Audiobaaz V1 — Launch Checklist

> The shortest path from where the codebase is today to a launchable
> V1 marketplace. Anything not on this list is explicitly **out of
> scope for V1** — defer until launch is complete.

**Last updated:** 2026-05-30

---

## The single question this document answers

> Can a seller list an IEM, can a buyer pay for it, can the seller
> ship it, can the buyer receive it, and can money be released safely
> to the seller?

Everything that does not directly move that flow forward is not V1.

---

## Status snapshot

| Area | State | Branch |
|------|-------|--------|
| Seller flow (list, dashboard, onboarding) | ✅ Complete on dev | merged |
| Buyer flow (browse, listing detail, mock checkout, orders, disputes) | ✅ Complete on dev (mock-checkout transitional) | merged |
| Admin panel (listings review, disputes, users, payouts queue) | ✅ Complete on dev | merged |
| Phase 1 marketplace-core schema | ⏸ Code complete, **awaiting verification + PR** | feature/payments-shipping |
| Phase 2 — Razorpay route revisions | ❌ Not started; blocked on Phase 1 verification | feature/payments-shipping (after Phase 1 merges) |
| Shipping integration (Shiprocket creation + tracking) | ❌ Not started; blocked on Phase 2 | feature/payments-shipping |
| End-to-end transaction smoke test | ❌ Never run | — |

---

## Order of work

### Step 1 — Verify Phase 1 (database)

**Status: BLOCKING. Nothing else proceeds until this step is green.**

1. Open PR `feature/payments-shipping → dev`.
2. CI runs `.github/workflows/phase1-verification.yml` automatically.
   - Bootstraps Supabase compatibility on the postgres:15 service container.
   - Applies `schema.sql` + `002` + `003` + `004` + `005`.
   - Runs `phase1_scenarios.sql` (Scenarios A/B/C/D/E1/E2).
   - Runs `phase1_stress.sh` at concurrency=100.
3. If CI fails → fix the SQL, push the fix, re-run.
4. If CI passes → merge the PR. The marketplace-core schema lives on `dev`.

Verification runbook for manual / VPS execution: `supabase/tests/RUNBOOK.md`.

### Step 2 — Phase 2 application code (Razorpay routes)

Begins **only after Step 1 merges**. Bounded scope: replace four
existing routes with thin wrappers around the verified RPCs.

| Route | Current state | What it should do |
|-------|---------------|-------------------|
| `POST /api/payments/create` | Exists on parked branch; rogue listing writes | Acquire `checkout_locks`, create Razorpay order, insert `payments` row at `status='created'`, return modal params |
| `POST /api/payments/verify` | Exists; rogue `listings.status='sold'` write | Verify Razorpay client-callback signature, call `finalize_winning_payment(...)`, return success/conflict |
| `POST /api/payments/webhook` | Exists; rogue `listings.status='approved'` resurrection on `payment.failed` | Verify Razorpay webhook signature, upsert `webhook_events`, call `finalize_winning_payment(...)`, on `conflict` result call `initiate_refund(...)` |
| `DELETE /api/checkout/mock` | Live on dev as transitional stand-in | Remove the route. Buyer-flow `CheckoutForm` switches to `/api/payments/create` |

The ONLY listings/orders/offers writes from these routes go through the
RPCs. No direct `.update()` calls. Migration 005 enforces this with
trigger-level guards.

### Step 3 — Shipping integration

Begins after Step 2. Bounded scope: two routes.

| Route | What it does |
|-------|--------------|
| `POST /api/shipping/create-shipment` | Seller-initiated. Creates Shiprocket shipment for an `escrow_held` order. Persists `shiprocket_order_id`, `shiprocket_shipment_id`, `tracking_number`, `courier_name`. Telegrams the buyer with tracking. Updates `orders.status` to `seller_confirmed → shipped`. |
| `GET /api/shipping/track` | Buyer + seller read-side. Param `?order_id=`. Returns the Shiprocket-side AWB and current status. No side effects. |

Shiprocket webhook (`POST /api/shipping/webhook` for inbound courier
events) is **deferred**. V1 uses pull-side tracking only; courier
events drive `orders.status` via manual admin advance + the existing
`set_inspection_window` trigger on `delivered`.

### Step 4 — Dispute resolution end-to-end

Most of this exists on dev. What's missing:

- Buyer can already raise a dispute (`POST /api/disputes` exists).
- Admin can already resolve (`POST /api/admin/disputes/[id]/resolve` exists).
- **Wire the resolve route to call `initiate_refund(...)`** when the
  verdict awards a refund (full or partial). Today it just flips
  `orders.status` and adjusts trust scores. After Step 2, refunds
  flow through the locked RPC.

### Step 5 — Payout flow end-to-end

Most of this exists on dev. What's missing:

- Admin payouts queue exists (`/admin/payouts`).
- Trigger payout exists (`POST /api/admin/payouts/[id]/trigger`).
- **V1 manual UPI is fine.** Admin enters a real UPI reference at
  trigger time (small UI change), the route writes
  `payout_reference`, `payout_at`, `payout_status='paid'`. Telegram
  the seller.
- Razorpay Payouts API integration is **V2**, not V1.

### Step 6 — Run one full transaction end-to-end

The acceptance test for V1 launch:

```
1. Seller lists an IEM (real listing, real photos, real price).
2. Admin approves the listing.
3. Buyer browses, finds the listing, clicks Buy Now.
4. Buyer completes Razorpay payment in test mode.
5. Order reaches escrow_held; listing flips to sold; sold_offer_id set.
6. Seller creates Shiprocket shipment.
7. Order moves seller_confirmed → shipped → delivered.
8. Inspection window opens (48 hours).
9. Inspection expires (or buyer confirms early).
10. Order moves to completed.
11. Admin triggers payout to seller's UPI.
12. payout_status flips to paid; seller is notified.
```

If this flow works end-to-end with a real Razorpay test capture and a
real Shiprocket test shipment, **V1 is launchable.** Everything else
is polish.

---

## Out of scope for V1 — defer until after launch

These are recorded so they don't sneak back into the priority list.

- Counter-offers (locked product decision: not happening)
- Auto-accept threshold logic
- Watchlist + saved searches (UI exists in spec, not built)
- Ratings post-delivery widget
- Merchant / curator network (V2 distributed verifier scope)
- Razorpay Route / Payouts API integration
- Shiprocket inbound webhook
- Multi-connection stress at production-scale concurrency
- Refund queue worker (V1 uses synchronous in-handler refund)
- Real-time order status push to buyer (Telegram covers V1)
- Analytics dashboards
- Referral / invite system
- AI-anything (recommendations, dispute analysis, fraud detection)
- VPS migration off Vercel / Supabase
- Mobile apps
- Anything in the V2 scope from ENGINEERING.md

If a stakeholder asks for one of these before V1 launches, the answer
is "after launch, not before." Launch first, optimise after data.

---

## Cross-references

- Architecture (locked) — `docs/context/payments-shipping.md`
- Audit (authoritative on Phase 2 disposition) — `docs/reviews/payments-session-zero.md`
- Verification runbook — `supabase/tests/RUNBOOK.md`
- CI workflow — `.github/workflows/phase1-verification.yml`
- Buyer flow status — `docs/context/buyer-flow.md`
- Seller flow status — `docs/context/seller-flow.md`
- Admin panel status — `docs/context/admin-panel.md`
- Deployment + domains — `docs/DEPLOYMENT.md`
