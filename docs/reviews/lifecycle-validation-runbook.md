# Lifecycle validation runbook — `feature/order-lifecycle-shipping`

> **Status:** ready to execute on `dev.audiobaaz.com`. No further code
> work on this branch until validation completes and produces fixes
> for any defects it surfaces.
>
> **Branch tip:** `5fe26e2`
> **Audit doc:** `docs/reviews/order-lifecycle-shipping-audit.md`
> **Architecture reference:** `docs/context/payments-shipping.md`

---

## Branch verification (already done — recorded for the record)

The user asked for these three checks before any deletion or PR
closure. They've been run; results follow.

```
$ git log --oneline dev..feature/payment-routes
(empty)

$ git log --oneline dev..feature/payments-shipping
(empty)

$ git log --oneline dev..feature/buyer-flow
(empty)
```

All three branches have **zero commits ahead of `dev`**. They are
historical references to commits that already live on `dev`. Safe to
delete after this validation pass.

```
$ git diff feature/checkout-razorpay-wire..feature/order-lifecycle-shipping --stat
32 files changed, 3528 insertions(+), 949 deletions(-)
```

The active branch is a strict superset of PR #4. CheckoutForm has
the same Razorpay wiring as PR #4 plus the new synthetic-provider
branch; `/api/checkout/mock` is removed on both branches. PR #4 is
genuinely superseded.

---

## Pre-deploy checklist

Before touching `dev.audiobaaz.com`:

- [ ] `next build` GREEN locally (currently true at `5fe26e2`).
- [ ] `npx tsc --noEmit` clean (currently true at `5fe26e2`).
- [ ] Migration 007 applied to the Supabase project for `dev.audiobaaz.com`.
      The migration is additive only — it adds `shipments`,
      `shipment_events`, `mock_shipments`, `record_shipment_created`,
      `record_shipment_status_change`, plus two `_touch` triggers. No
      existing schema is altered.
- [ ] Vercel `dev` env vars configured:
  - `PAYMENT_PROVIDER=dev`
  - `PAYMENT_DEV_SECRET=<any non-empty string>` (optional; falls back to a hardcoded constant if unset)
  - `ENABLE_DEV_PAYMENT_SIMULATION=true` (only required if you plan to exercise webhook-replay; not needed for the basic checkout simulator)
  - `SHIPPING_PROVIDER` left unset (factory falls back to mock when no `SHIPROCKET_EMAIL` is present)
- [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` left unset on `dev` for now (the factory is gated, but the cleanest way to be sure dev provider is active is to leave the Razorpay vars empty).
- [ ] **Confirm `PAYMENT_PROVIDER=dev` is NOT set in production env vars.** The factory has a runtime guard (`NODE_ENV !== 'production'`), but defense in depth.

---

## Test data setup

Before running scenarios:

1. Two test buyer accounts (e.g. `buyer1@audiobaaz.test`, `buyer2@audiobaaz.test`).
2. One test seller account (e.g. `seller@audiobaaz.test`).
3. Seller profile complete: `full_name`, `phone`, `city`, `pincode`. (The `/api/shipping/create` route requires `city` + `pincode`; without them the route returns 400.)
4. One approved listing on the seller's account, status `approved`, `is_negotiable` either, asking price ~₹1000–10000 (any value works).

Capture the listing UUID and the buyer/seller user IDs. You'll reference these in the validation log below.

---

## Scenario A — Single-buyer happy path

**Goal:** prove the entire lifecycle from listing to inspection
window, all on the synthetic provider, with audit rows matching
reality at every step.

| Step | Action | Expected DB state |
|------|--------|-------------------|
| A1 | Buyer 1 navigates to `/listing/<slug>` and clicks "Buy now" | (no DB change yet) |
| A2 | Buyer 1 fills the address form on `/buy/checkout/<listingId>` and clicks Pay | `orders` row inserted: `status='payment_pending'`, `buyer_id=buyer1`, `seller_id=seller`, `paid_price=<asking_price>`. `payments` row inserted: `status='created'`, `razorpay_order_id` starts with `dev_order_`. `checkout_locks` row exists for the listing. |
| A3 | CheckoutForm receives `synthetic: true` from `/api/payments/create`. Synthetic branch fires: POSTs to `/api/dev/payments/simulate`, then `/api/payments/verify`. | `finalize_winning_payment` runs. `orders.status='escrow_held'`, `escrow_held_at` set. `listings.status='sold'`, `listings.sold_order_id` set, `sold_at` set. `payments.status='captured'`. **`order_events`**: row with `event_name='payment_captured'`, `to_status='escrow_held'`. `webhook_events` may or may not have a row depending on whether you also fire the synthetic webhook (see Scenario D). `checkout_locks` row released. |
| A4 | Buyer redirected to `/orders/purchase/<orderId>`. Verify page renders. | `OrderTimeline` shows the `payment_captured` event. `ShipmentTracking` renders nothing yet. |
| A5 | Seller logs in, navigates to `/dashboard/orders/<orderId>`, clicks "Create shipment" | `/api/shipping/create` calls `MockShippingProvider.createShipment` then `record_shipment_created`. `shipments` row inserted with `provider='mock'`, `awb` matching `TEST-XXXX-NNN` shape, `status='created'`. `shipment_events` row with `event_name='shipment_created'`, `to_status='created'`. `mock_shipments` row inserted. **`orders.status='seller_confirmed'`**, `tracking_number` denormalised. **`order_events`**: row with `event_name='shipment_created'`, `from_status='escrow_held'`, `to_status='seller_confirmed'`, `actor_type='seller'`. |
| A6 | Seller clicks "Mark picked up" (dev advance) | `/api/dev/shipping/advance` calls `MockShippingProvider.advanceTracking` (writes to `mock_shipments`) then `record_shipment_status_change` RPC. `shipments.status='picked_up'`, `picked_up_at` set. `shipment_events` row with `to_status='picked_up'`. **`orders.status='shipped'`**, `shipped_at` set. **`order_events`**: row with `event_name='shipped'`, `from_status='seller_confirmed'`, `to_status='shipped'`. |
| A7 | Seller clicks "Mark in transit" | `shipments.status='in_transit'`. New `shipment_events` row. **No order_events row** (in_transit doesn't move the order). `orders.status` unchanged. |
| A8 | Seller clicks "Mark out for delivery" | `shipments.status='out_for_delivery'`. New `shipment_events` row. `orders.status` unchanged. |
| A9 | Seller clicks "Mark delivered" | `shipments.status='delivered'`, `delivered_at` set. New `shipment_events` row. **`orders.status='inspection'`** (the `set_inspection_window` trigger rewrites `'delivered'` → `'inspection'` and sets `inspection_expires_at = NOW() + 48h`). **`order_events`**: row with `event_name='inspection_started'`, `to_status='inspection'`, `actor_type='system'`. |
| A10 | Buyer reloads `/orders/purchase/<orderId>` | `OrderTimeline` shows the full merged narrative: payment_captured → shipment_created → shipped → inspection_started, interleaved with shipment_events. `ShipmentTracking` shows `delivered`. The buyer-page status block shows the inspection window timer with hours remaining. |

**Pass criteria for Scenario A:**

- Every transition above produced exactly one `order_events` row (zero duplicates).
- Every shipment transition produced exactly one `shipment_events` row.
- `OrderTimeline` rendered without crashing the page.
- `listings.sold_order_id` is set and never changes.
- `payments.refund_status` is NULL throughout (no refund initiated).

---

## Scenario B — Buyer abandons checkout

**Goal:** prove that an abandoned checkout leaves clean state — no
phantom sale, no leaked lock that blocks future buyers.

| Step | Action | Expected DB state |
|------|--------|-------------------|
| B1 | Buyer 1 reaches `/buy/checkout/<listingId>` and submits the address form | `/api/payments/create` succeeds. `orders` row at `payment_pending`. `payments` row at `created`. `checkout_locks` row for `listing × buyer1`. CheckoutForm receives `synthetic: true`. |
| B2 | Buyer 1 closes the tab BEFORE the synthetic-payment branch completes (close the tab between the create response and the simulate POST — easiest way is to throttle the network in DevTools and close the tab during the simulate call) | `orders.status='payment_pending'` still. `payments.status='created'` still. `checkout_locks` row still present. `listings.status='approved'` (unchanged). |
| B3 | Wait 5+ minutes (the default `acquire_checkout_lock` TTL) | `checkout_locks` row's `expires_at` has passed. The row may or may not be physically deleted depending on whether anyone has called `acquire_checkout_lock` since (the migration 004 design reclaims expired locks lazily on next acquire). |
| B4 | Buyer 2 navigates to `/buy/checkout/<listingId>` and submits | `/api/payments/create` succeeds. The expired lock is reclaimed; new `checkout_locks` row for `buyer2`. New `orders` row for buyer2. The buyer1 abandoned order remains in the database forever at `payment_pending`. |

**Pass criteria for Scenario B:**

- `listings.sold_order_id` is NULL throughout (no phantom sale).
- Buyer 1's abandoned `orders` row has `status='payment_pending'`.
- Buyer 2 successfully starts a new checkout.
- No invariant violations on `listings`.

**Known caveat:** the abandoned `payment_pending` row sits in the table indefinitely. Phase 1's lifetime invariant explicitly excludes `payment_pending` from the winning-lineage set, so this is correct behaviour — the row just exists as historical evidence that buyer 1 attempted to check out. A future cleanup job can soft-delete abandoned `payment_pending` rows older than N days; not a launch blocker.

---

## Scenario C — Two buyers race for the same listing

**Goal:** prove the marketplace's most important runtime
correctness property — exactly one winner, exactly one
race-loser refund initiated, zero ownership corruption.

| Step | Action | Expected DB state |
|------|--------|-------------------|
| C1 | Buyer 1 reaches `/buy/checkout/<listingId>` in browser tab A | (no DB change yet) |
| C2 | Buyer 2 reaches `/buy/checkout/<listingId>` in browser tab B | (no DB change yet) |
| C3 | Buyer 1 submits the form (tab A) | `orders` row for buyer1 at `payment_pending`. `checkout_locks` held by buyer1. |
| C4 | Buyer 2 submits the form (tab B) — should land within ~30s of C3 | `/api/payments/create` returns 409 `CHECKOUT_BUSY` because buyer1 holds the lock. **This is the lock doing its job.** Buyer2 sees a friendly error. |
| C5 | Buyer 1's synthetic-payment branch completes | `finalize_winning_payment` runs for buyer1. `orders.status='escrow_held'`, `listings.sold_order_id` set. |
| C6 | Buyer 2 retries (still within seconds) | `/api/payments/create` rejects with `NOT_AVAILABLE` because `listings.status='sold'`. |

**Variation — true concurrent race:**

If you can issue the two `/create` calls simultaneously (e.g. two browser tabs hitting submit at the exact same instant), the race may both reach the lock acquisition. The expected outcome:

- Exactly one `acquire_checkout_lock` returns `acquired`; the other returns `held_by_other` (409).
- If both happen to receive `acquired` in some database race condition (should not happen, but verify), then both reach the verify path. The first to call `finalize_winning_payment` wins; the second's RPC returns `result='conflict'`. The verify route initiates a refund via `provider.refund()`, which the dev provider returns synchronously as `succeeded`, then calls `record_refund_outcome`. **`payments.refund_status='succeeded'`** for buyer2. `orders.status='cancelled'` for buyer2. CheckoutForm shows the "another buyer completed payment first" message.

**Pass criteria for Scenario C:**

- `listings.sold_order_id` is set to **exactly one** order's id.
- Exactly one `escrow_held` order exists for the listing.
- If a refund was initiated, `payments.refund_status` for the loser is `succeeded` (dev provider) or `processing` (Razorpay would be the path here in production).
- `order_events` has zero duplicate `payment_captured` rows.
- The `webhook_events` table has zero duplicate processed events (relevant if Scenario D is interleaved).

This is the same property Phase 1's stress test proved at concurrency=100 in pure SQL. Scenario C re-proves it across the full HTTP/route/RPC/DB stack the buyer actually traverses.

---

## Scenario D — Webhook replay idempotency

**Goal:** prove `webhook_events` deduplication works.

| Step | Action | Expected DB state |
|------|--------|-------------------|
| D1 | Complete Scenario A through step A3 (order at `escrow_held`) | (state from A3) |
| D2 | POST to `/api/dev/payments/webhook-replay` with `event='payment.captured'`, `razorpay_order_id=<from-step-A2>`, `payment_id=<dev_payment_id_from_simulate>` | The replay route signs the payload and POSTs to `/api/payments/webhook`. Webhook handler upserts `webhook_events`. `finalize_winning_payment` returns `noop` (already captured). Response body shows `webhook_status: 200, webhook_body: { event: 'payment.captured', processed: true }`. **`webhook_events`** has one row with `status='processed'`. |
| D3 | POST the same body to `/api/dev/payments/webhook-replay` again | Webhook handler returns `{replay: true}`. `webhook_events` has the same one row with `status='processed'`; no new row inserted. **No new `order_events` rows.** |

**Pass criteria for Scenario D:**

- `webhook_events` shows exactly **one** row with `provider_event_id='payment.captured:<payment_id>'`.
- `order_events` shows exactly one `payment_captured` row (from the original verify path) plus zero from the webhook replays.
- `orders` / `listings` / `payments` rows are byte-for-byte identical before and after each replay.

---

## Scenario E — Payment failure path

**Goal:** prove `payment.failed` lands the order at `payment_failed`
(recoverable), not at any winning-lineage state.

| Step | Action | Expected DB state |
|------|--------|-------------------|
| E1 | Buyer reaches `/buy/checkout/<listingId>` and submits | `orders` row at `payment_pending`. `payments` row at `created`. |
| E2 | Instead of using the simulator, POST to `/api/dev/payments/webhook-replay` with `event='payment.failed'`, `razorpay_order_id=<from E1>` | Webhook handler runs `handlePaymentFailed`. **`payments.status='failed'`**. **`orders.status='payment_failed'`**. `listings` row untouched. `webhook_events` row at `status='processed'`. |
| E3 | Buyer retries the form | New `orders` row, new `payments` row. The original `payment_failed` order persists as historical evidence. |

**Pass criteria for Scenario E:**

- `listings.sold_order_id` is NULL throughout (no phantom sale on failed payment).
- `orders` for the failed attempt is at `payment_failed`.
- Buyer can successfully retry and reach `escrow_held` on a second attempt.

---

## Scenario F — Adversarial: seller creates shipment for someone else's order

**Goal:** prove the ownership check in `/api/shipping/create`.

| Step | Action | Expected response |
|------|--------|-------------------|
| F1 | Complete Scenario A through step A4 (escrow_held but no shipment yet) | (state from A4) |
| F2 | A different user (not the seller of this listing) POSTs `/api/shipping/create` with `order_id=<from A2>` | 403 `FORBIDDEN`. No shipment row created. No `orders.status` change. |

The `record_shipment_created` RPC is the second line of defence: it
also checks `seller_id = p_actor_id` and raises
`insufficient_privilege` if violated.

---

## Scenario G — Adversarial: seller creates shipment twice

**Goal:** prove the duplicate-shipment guard.

| Step | Action | Expected response |
|------|--------|-------------------|
| G1 | Complete Scenario A through step A5 (shipment created) | (state from A5) |
| G2 | Seller clicks "Create shipment" again, or replays the POST | 409 `SHIPMENT_EXISTS`. The check at the top of `/api/shipping/create` (look up `shipments` by `order_id`) catches it. **Even if that route check is bypassed**, the `shipments.order_id` UNIQUE constraint catches it at the DB. |

---

## Scenario H — Adversarial: out-of-order shipment advance

**Goal:** prove `record_shipment_status_change` rejects illegal
transitions.

| Step | Action | Expected response |
|------|--------|-------------------|
| H1 | Complete Scenario A through step A5 (shipment at `created`) | (state from A5) |
| H2 | POST `/api/dev/shipping/advance` with `awb=<from A5>`, `to_status='delivered'` | 400 `INVALID_TRANSITION` from `MockShippingProvider.advanceTracking`. (The mock provider validates the lifecycle table before writing.) |
| H3 | POST `/api/dev/shipping/advance` with `to_status='picked_up'` | Succeeds (Scenario A6). |
| H4 | POST `/api/dev/shipping/advance` with `to_status='picked_up'` again (same status) | The mock provider's `advanceTracking` will throw `invalid mock-shipment transition: picked_up → picked_up`. |

The RPC `record_shipment_status_change` has its own idempotency
check at the database layer (`IF v_shipment.status = p_to_status`
returns `replay: true`) — that path is reached only if you call
the RPC directly with a same-status transition, which the mock
provider blocks first.

---

## Adversarial — Buyer accesses another buyer's order

| Step | Action | Expected response |
|------|--------|-------------------|
| X1 | Buyer 2 logs in and navigates to `/orders/purchase/<buyer1OrderId>` | 404 not-found from the page (the query `.eq('buyer_id', user.id)` returns no rows for buyer2). |
| X2 | Buyer 2 GETs `/api/shipping/track?awb=<buyer1Awb>` | 403 `FORBIDDEN` from the route (the inner-join authz check rejects). |

---

## Logging template — fill in during validation

For each scenario, capture before/after table snapshots. Suggested
template per scenario:

```
Scenario A — completed YYYY-MM-DD HH:MM
  Listing: <uuid>  Buyer: <uuid>  Seller: <uuid>

  After A2:
    orders[<order_id>]:    status=payment_pending, paid_price=<n>
    payments[<id>]:        status=created, razorpay_order_id=dev_order_<hex>
    checkout_locks[<row>]: held by <buyer_id>

  After A3:
    orders[...]:           status=escrow_held, escrow_held_at=<ts>
    listings[...]:         status=sold, sold_order_id=<order_id>, sold_at=<ts>
    payments[...]:         status=captured
    order_events:          1 new row (payment_captured)
    checkout_locks[...]:   released

  ... (etc through A10)

Defects observed: <list, or "none">
```

A short Markdown report committed to
`docs/reviews/lifecycle-validation-results.md` is the deliverable.

---

## What "passing" looks like

All eight scenarios produce the expected DB state with:

1. Zero crashes on any route.
2. Zero CHECK or NOT NULL violations on any insert (this would catch
   the bugs the audit just fixed if any of them slipped through).
3. Zero divergence between audit rows and reality (e.g. an
   `order_events` row claiming `to_status='delivered'` while the
   row actually sits at `'inspection'`).
4. `listings.sold_order_id` set exactly once per listing per
   lifetime.
5. Race-loser refund (Scenario C variant) initiates correctly and
   lands at `succeeded` for the dev provider.

If anything fails, the failure is the next bug. Fix it on the same
branch (`feature/order-lifecycle-shipping`); do not introduce new
features or new branches.

---

## Stop conditions

Halt validation and triage before continuing if any of the
following appear:

- A `CHECK` or `NOT NULL` constraint violation on `order_events`
  (the audit caught three; if a fourth surfaces, the migration 002
  CHECK list and the actual event_names emitted by the codebase
  need a full reconciliation).
- An `order_events` row with `to_status` that does not match the
  current `orders.status` immediately after the transition (the
  audit caught one such case via the `delivered → inspection`
  trigger).
- A `webhook_events` row inserted twice for the same
  `provider_event_id`.
- `listings.sold_order_id` set for two distinct orders (this would
  be the most serious failure — the lifetime invariant has held
  through Phase 1 stress at concurrency=100, so any failure here
  needs immediate root-cause analysis).
- Any `200 OK` response that didn't actually move the database
  forward (silent failures are worse than loud ones).

---

## Post-validation actions

After all eight scenarios pass:

1. Commit the validation report to `docs/reviews/lifecycle-validation-results.md`.
2. Open the PR: `feature/order-lifecycle-shipping → dev`. Reference both `docs/reviews/order-lifecycle-shipping-audit.md` and `lifecycle-validation-results.md` in the description.
3. After PR merges:
   - Close PR #4 (`feature/checkout-razorpay-wire`) without merging.
   - Delete merged-only remote branches:
     ```
     git push origin --delete feature/payment-routes
     git push origin --delete feature/payments-shipping
     git push origin --delete feature/buyer-flow
     git push origin --delete feature/checkout-razorpay-wire
     ```
4. Build minimal admin operations on a fresh branch off `dev` — the last V1 feature before closed beta.

Until validation produces this report, no new code lands on this
branch.
