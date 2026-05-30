# Audiobaaz V1 — Launch Checklist

> The shortest path from where the codebase is today to a launchable
> V1 marketplace. Anything not on this list is explicitly **out of
> scope for V1** — defer until launch is complete.

**Last updated:** 2026-05-30 (post-vertical-slice on `feature/order-lifecycle-shipping`)

---

## The single question this document answers

> Can a seller list an IEM, can a buyer pay for it, can the seller
> ship it, can the buyer receive it, and can money be released safely
> to the seller?

Everything that does not directly move that flow forward is not V1.

---

## CURRENT REPOSITORY STATE — 2026-05-30

### Active development branch

`feature/order-lifecycle-shipping` (branched off `dev` at `7b294e9`).
Single source of truth for all remaining V1 transaction-engine work.

### Open PRs

- **PR #4** (`feature/checkout-razorpay-wire → dev`) — **SUPERSEDED**.
  The CheckoutForm wiring + `/api/checkout/mock` removal that PR #4
  contains have been cherry-picked onto the active branch as commit
  `5ae8cd7`. Recommendation: close PR #4 without merging; delete
  `feature/checkout-razorpay-wire` after the active branch merges.

### Merged

- PR #2 (commit `230d9ae`) — Phase 1 marketplace-core schema (migrations 002–006, RPCs, audit tables, CI verification, acceptance + stress tests).
- PR #3 (commit `7b294e9`) — Phase 2 Razorpay routes: `/api/payments/{create,verify,webhook}` as thin wrappers over the locked RPCs.

### Built (on `feature/order-lifecycle-shipping`, not yet on `dev`)

| Capability | Files |
|------------|-------|
| `PaymentProvider` abstraction (Razorpay + Dev) | `src/lib/payments/{provider,razorpay,dev,factory}.ts` |
| Refactored payment routes calling the provider | `src/app/api/payments/{create,verify,webhook}/route.ts` |
| CheckoutForm with Razorpay + dev-synthetic branches | `src/app/buy/checkout/[listingId]/CheckoutForm.tsx` |
| Dev payment simulator + webhook replay | `src/app/api/dev/payments/{simulate,webhook-replay}/route.ts` |
| `ShippingProvider` abstraction (Mock) | `src/lib/shipping/{provider,mock,factory}.ts` |
| Shipping schema + RPCs | `supabase/migrations/007_shipping_substrate.sql` |
| Shipping routes | `src/app/api/shipping/{create,track}/route.ts`, `src/app/api/dev/shipping/advance/route.ts` |
| Seller shipment flow UI | `src/app/(main)/dashboard/orders/[orderId]/{page,CreateShipmentButton,AdvanceShipmentButton}.tsx` |
| Order timeline + tracking components | `src/components/orders/{OrderTimeline,ShipmentTracking}.tsx` |

`next build` GREEN. 22 API routes including all five new ones.

### Not yet built

- Admin operations: dispute → refund wiring, payouts UPI reference flow, orders monitor.
- `ShiprocketProvider` (deferred until credentials land — provider slot exists in the factory and throws on selection).
- Real Razorpay test-mode validation (deferred until credentials land — `DevPaymentProvider` covers the application-stack validation gap).

---

## Ownership model — canonical reminder

The lifetime ownership anchor is **`listings.sold_order_id`** (added in
migration 006 after PR #2 CI Scenario A surfaced that `sold_offer_id`
does not constrain direct buy-now captures).

- **`sold_order_id`** — UUID UNIQUE NULL. Set once inside
  `finalize_winning_payment` at the moment of `escrow_held`, immutable
  thereafter. The lifetime invariant lives here.
- **`sold_offer_id`** — UUID UNIQUE NULL. Informational metadata.
  Populated only when the order is offer-backed. Retained for forensic
  queries ("which negotiation became this sale?") but **NOT the
  ownership signal**.

Any documentation, comment, or code path that reads `sold_offer_id` as
the ownership signal must be corrected. Migration 006 is the canonical
reference.

---

## End-to-end flow (works today on the active branch, no external credentials)

With `PAYMENT_PROVIDER=dev` (non-prod), Razorpay-less buyers can still
walk the entire transaction lifecycle:

1. Buyer clicks Pay → `/api/payments/create` returns `synthetic: true`.
2. CheckoutForm POSTs to `/api/dev/payments/simulate` → POSTs to real `/api/payments/verify` → `finalize_winning_payment` runs → `escrow_held`.
3. Seller opens `/dashboard/orders/<id>` → "Create shipment" → mock provider issues AWB → `record_shipment_created` → `seller_confirmed`.
4. Seller clicks "Mark picked up" → `/api/dev/shipping/advance` → `record_shipment_status_change` → `orders.status = shipped`.
5. Continue through `in_transit → out_for_delivery → delivered` → `inspection_expires_at` set.
6. Buyer's order detail page renders the full timeline + tracking the entire way.

This means the marketplace lifecycle can be exercised, observed,
debugged, and demoed today — without paying for or waiting on Razorpay
or Shiprocket access.

---

## NEXT ENGINEERING TASK — Admin operations

The remaining V1 chunk on the active branch:

| Surface | Task |
|---------|------|
| Admin disputes | Wire dispute resolution to `initiate_refund` for buyer-favourable verdicts (`full_refund` / `partial_refund`). Existing `record_refund_outcome` finishes the lifecycle when the gateway-side refund completes. |
| Admin payouts | UPI reference text input at trigger time. Route writes `payout_reference`, `payout_at`, `payout_status='paid'`. Telegram the seller. |
| Admin orders monitor | Replace the stub at `src/app/admin/orders/page.tsx` with a real list + filter view that surfaces stuck refunds, stuck shipments, and orders past inspection without payout. |
| Manual escrow release | Admin button on a `delivered` order past its inspection window → flips order to `completed` + `payout_status='pending'`. (The 48h auto-release can come later; the admin path unblocks immediate payouts.) |

After admin operations land, the active branch is ready for review +
merge into `dev`. Real-credential swaps follow as separate, surgical
branches.

---

## DO NOT START YET

The transaction engine is not yet validated end-to-end with real
external traffic. Until that is done, the following are premature:

- AI features
- Merchant gamification
- Reputation systems
- Recommendation systems
- Dynamic pricing
- Seller leaderboards
- Escrow staking concepts
- Advanced dispute automation
- Payout automation (Razorpay Payouts API / Razorpay Route)

If a stakeholder asks for one of these before V1 launches, the answer
is "after launch, not before." Launch first; optimise after data.

---

## Order of work — launch-critical sequence

### Step 1 — Close PR #4

PR #4 (`feature/checkout-razorpay-wire → dev`) is superseded. Its
code lives on `feature/order-lifecycle-shipping` as commit `5ae8cd7`
(cherry-pick of `413bc77`). Close without merging.

### Step 2 — Delete merged-ancestor branches

Remote branches with zero commits ahead of `dev`:

- `feature/payment-routes` (merged via PR #3)
- `feature/payments-shipping` (merged via PR #2)
- `feature/buyer-flow` (earlier merge)

Safe to delete from origin. Local copies can be cleaned up at the
engineer's convenience.

### Step 3 — Build admin operations

On `feature/order-lifecycle-shipping` (do not branch). See "NEXT
ENGINEERING TASK" above.

### Step 4 — Open one PR

`feature/order-lifecycle-shipping → dev`. Single PR; no splitting.
The vertical slice is tightly coupled and an intermediate split
would not represent a usable marketplace state.

### Step 5 — Validate the lifecycle on dev.audiobaaz.com

After merge, run the matrix below against `dev.audiobaaz.com` with
`PAYMENT_PROVIDER=dev` set in Vercel:

| # | Scenario | Expected DB outcome |
|---|----------|---------------------|
| **A** | Single buyer, single listing, complete checkout | `listings.status='sold'`, `listings.sold_order_id` set; `orders.status='escrow_held'` then walks through `seller_confirmed → shipped → delivered`; `payments.status='captured'`; one `order_events` row per transition |
| **B** | Buyer abandons checkout | `orders.status='payment_pending'`; `checkout_locks` row exists, expires after TTL; listing remains `approved` (Decision 6) |
| **C** | Two buyers race for same listing | Exactly one winner reaches `escrow_held`; loser's `payments.refund_status='processing'`; loser's `orders.status='cancelled'`; zero ownership corruption |
| **D** | Webhook replay via `/api/dev/payments/webhook-replay` | First call processes; second returns `{replay: true}`; `webhook_events` shows exactly one row with `status='processed'` |
| **E** | Payment failure path — synthesise a `payment.failed` event | `orders.status='payment_failed'` (recoverable); listing untouched; buyer can re-enter and retry |

Scenario C is the most important runtime test in the platform.

### Step 6 — Real Razorpay (when credentials arrive)

Set on Vercel:
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Unset (or leave blank) `PAYMENT_PROVIDER`

Razorpay dashboard:
- Webhook URL → `https://dev.audiobaaz.com/api/payments/webhook` (then production)
- Events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`

Re-run scenarios A–E against real test-mode transactions. Same
DB / audit assertions; only the active provider changes.

### Step 7 — Real Shiprocket (when credentials arrive)

Build `ShiprocketProvider` as the concrete implementation behind the
existing `ShippingProvider` interface. No changes to seller shipment
flow, order timeline, buyer tracking page, or notifications.

### Step 8 — Closed beta

5–10 real listings + 5–10 real buyers. Watch the audit tables. Fix
anything that surfaces. Then open V1 launch.

---

## Out of scope for V1 — defer until after launch

- Counter-offers (locked product decision: not happening)
- Auto-accept threshold logic
- Watchlist + saved searches (UI exists in spec, not built)
- Ratings post-delivery widget
- Merchant / curator network (V2 distributed verifier scope)
- Razorpay Route / Payouts API integration
- Multi-connection stress at production-scale concurrency
- Refund queue worker (V1 uses synchronous in-handler refund)
- Real-time order status push to buyer (Telegram covers V1)
- Analytics dashboards
- Referral / invite system
- AI-anything
- VPS migration off Vercel / Supabase
- Mobile apps
- Anything in the V2 scope from ENGINEERING.md

---

## Cross-references

- Branch state — `ENGINEERING.md` §"CURRENT REPOSITORY STATE" + "BRANCH STRATEGY"
- Architecture (locked) — `docs/context/payments-shipping.md`
- Audit (authoritative on Phase 2 disposition) — `docs/reviews/payments-session-zero.md` (immutable)
- Verification runbook — `supabase/tests/RUNBOOK.md`
- CI workflow — `.github/workflows/phase1-verification.yml`
- Buyer flow status — `docs/context/buyer-flow.md`
- Seller flow status — `docs/context/seller-flow.md`
- Admin panel status — `docs/context/admin-panel.md`
- Deployment + domains — `docs/DEPLOYMENT.md`
