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

## NEXT ENGINEERING TASK — Lifecycle validation, not implementation

The active branch is large enough. The next failure mode is runtime
bugs and lifecycle edge cases, not missing features. Adding more
code on top of an unverified slice creates more risk than value.

The pre-merge audit at `docs/reviews/order-lifecycle-shipping-audit.md`
already caught four schema-contract bugs that the build did not
catch (column name, NOT NULL, CHECK constraint, trigger interaction).
That's exactly the kind of failure that surfaces only at runtime —
so the next step is exercising the runtime.

The validation runbook at
`docs/reviews/lifecycle-validation-runbook.md` specifies eight
scenarios with exact DB-state assertions for every transition.
Execute them on `dev.audiobaaz.com` with `PAYMENT_PROVIDER=dev`,
capture results in `docs/reviews/lifecycle-validation-results.md`,
and merge only after the report is clean.

Scenarios summary (full detail in the runbook):

| # | Scenario |
|---|----------|
| **A** | Single-buyer happy path: listing → checkout → escrow_held → shipment_created → picked_up → in_transit → out_for_delivery → delivered → inspection |
| **B** | Buyer abandons checkout — no phantom sale, no leaked lock |
| **C** | Two buyers race for the same listing — exactly one winner, refund initiated for loser |
| **D** | Webhook replay — `/api/dev/payments/webhook-replay` posted twice → second returns `{replay: true}` |
| **E** | Payment failure — `event=payment.failed` lands order at `payment_failed`, recoverable |
| **F** | Adversarial: non-seller tries to create a shipment for someone else's order — 403 |
| **G** | Adversarial: seller creates shipment twice — 409 SHIPMENT_EXISTS |
| **H** | Adversarial: out-of-order shipment advance — INVALID_TRANSITION |

Scenario C is the most important runtime test in the platform.

### Admin operations — deferred

Originally listed here as the next implementation task. Now
deferred until after lifecycle validation completes and merges. The
reasoning: admin operations build on top of lifecycle states that
this branch produces. Validating those states first means the admin
work can trust the substrate when it lands.

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

### Step 1 — Stop all new feature development

The active branch contains a vertical slice covering payments,
shipping, escrow lifecycle, timeline, and seller shipment flow
(~3500 LoC, 32 files, 1 migration). The next failure mode is
runtime bugs and lifecycle edge cases, not missing features. New
code should not land until the lifecycle is verified end-to-end on
`dev.audiobaaz.com`.

Stop list (do not begin until validation produces a clean report):

- AI features
- Reputation systems
- Merchant gamification
- Recommendation systems
- Payout automation
- Advanced disputes
- Real `ShiprocketProvider`
- Real Razorpay credential setup
- Admin operations (deferred to AFTER validation merges)

### Step 2 — Deploy to `dev.audiobaaz.com`

Set on Vercel `dev`:
- `PAYMENT_PROVIDER=dev`
- `PAYMENT_DEV_SECRET=<any non-empty string>` (optional)
- `ENABLE_DEV_PAYMENT_SIMULATION=true` (only needed for webhook-replay scenarios)

Leave unset:
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `SHIPROCKET_EMAIL`, `SHIPPING_PROVIDER`

**Confirm `PAYMENT_PROVIDER=dev` is NOT in production env vars.**

Apply migration 007 to the Supabase project backing `dev`.

### Step 3 — Run lifecycle scenarios A–H

The runbook is `docs/reviews/lifecycle-validation-runbook.md`. It
specifies eight scenarios (single-buyer happy path, abandoned
checkout, two-buyer race, webhook replay, payment failure, three
adversarial cases) with exact DB-state assertions for every
transition.

Capture results in
`docs/reviews/lifecycle-validation-results.md` per the template in
the runbook.

### Step 4 — Fix only what validation finds

If validation surfaces a defect, fix it on the same branch
(`feature/order-lifecycle-shipping`). Do not branch a sibling. Do
not extend scope.

### Step 5 — Open the PR

`feature/order-lifecycle-shipping → dev`. Single PR. Reference both
the audit doc and the validation results in the description.

### Step 6 — Branch cleanup after merge

After the PR merges:
- Close PR #4 (`feature/checkout-razorpay-wire`) without merging — the active branch supersedes it (verified: `git diff` shows the active branch is a strict superset).
- Delete merged-only remote branches: `feature/payment-routes`, `feature/payments-shipping`, `feature/buyer-flow`, `feature/checkout-razorpay-wire`.
- Repository state after cleanup: `main`, `dev`, plus any genuinely active feature branch.

### Step 7 — Minimal admin operations

On a fresh branch off `dev`. Last V1 feature before closed beta.
Scope: dispute → refund button, manual escrow release, payouts UPI
reference flow, orders/payments/shipments/refunds monitor pages.
Nothing more.

### Step 8 — Closed beta

5–10 real listings + 5–10 real buyers running the full lifecycle
on the dev provider. Watch the audit tables. Fix anything that
surfaces. Then real-credential swaps:
- `PAYMENT_PROVIDER` unset → Razorpay (when credentials land).
- `MockShippingProvider` → `ShiprocketProvider` (when credentials land).

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
