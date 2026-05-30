# Pre-merge audit — `feature/order-lifecycle-shipping`

> Branch tip: `a997d18`
> Base: `dev` at `7b294e9`
> Author: this audit was performed before opening the PR for review.
>
> **Status: NOT READY TO MERGE.** Three runtime bugs in migration 007
> RPCs surfaced during this review. See "Critical bugs" below. Fix
> commit will follow this document.

---

## Scope of the branch

One vertical slice covering:

- `PaymentProvider` abstraction with two implementations (Razorpay,
  Dev) and a factory.
- `ShippingProvider` abstraction with one implementation (Mock) and
  a factory; Shiprocket slot exists but throws.
- Refactored `/api/payments/{create,verify,webhook}` to call the
  provider; behaviour for the Razorpay path is unchanged from PR #3.
- New routes: `/api/dev/payments/{simulate,webhook-replay}`,
  `/api/shipping/{create,track}`, `/api/dev/shipping/advance`.
- New schema: `shipments`, `shipment_events`, `mock_shipments`
  tables; `record_shipment_created` and `record_shipment_status_change`
  RPCs (migration 007).
- New UI: `OrderTimeline`, `ShipmentTracking` components; seller
  order detail page at `/dashboard/orders/[orderId]` with
  `CreateShipmentButton` + dev-only `AdvanceShipmentButton`.
- CheckoutForm updated to handle the dev-synthetic provider branch
  in addition to Razorpay (cherry-picked from PR #4).
- `/api/checkout/mock` removed.
- `src/lib/razorpay/{client,helpers}.ts` deleted; logic absorbed
  into `RazorpayPaymentProvider`.

Total: **~2700 lines added** across 21 files, plus 1 migration and 1
deletion.

---

## Critical bugs (must fix before merge)

### Bug 1 — Migration 007 RPCs use a column that does not exist on `order_events`

`order_events` (defined in migration 002) has `created_at` defaulted
to `NOW()`. There is **no `occurred_at` column**.

`record_shipment_created` writes:

```sql
INSERT INTO order_events (
  order_id, event_name, from_status, to_status, actor_id, occurred_at
) VALUES (...);
```

Postgres will raise: `column "occurred_at" of relation "order_events"
does not exist`.

`record_shipment_status_change` has the same bug.

**Impact:** every "Create shipment" click and every
`record_shipment_status_change` call would fail at runtime with a 500.
The shipment lifecycle is non-functional as merged.

`OrderTimeline.tsx` also reads `order_events.occurred_at` — same
problem, the buyer/seller order detail page would error or render an
empty timeline.

### Bug 2 — Migration 007 RPCs omit `actor_type`, which is `NOT NULL` on `order_events`

`order_events.actor_type` (migration 002) is NOT NULL with CHECK
constraint `IN ('buyer', 'seller', 'system', 'webhook', 'admin')`.

Both `record_shipment_created` and `record_shipment_status_change`
INSERT into `order_events` without supplying `actor_type`. NOT NULL
violation at runtime.

### Bug 3 — Migration 007 uses `event_name` values not in the `order_events` CHECK list

`order_events.event_name` is constrained to:

```
'order_created', 'payment_captured', 'payment_failed',
'order_cancelled', 'shipment_created', 'shipped', 'delivered',
'inspection_started', 'completed', 'disputed', 'refunded',
'partially_refunded', 'admin_recovery_override'
```

`record_shipment_status_change` writes:

- `event_name = 'shipment_picked_up'`  ← not in list
- `event_name = 'shipment_delivered'`  ← not in list

CHECK violation at runtime. The correct values are `'shipped'` and
`'delivered'`.

`record_shipment_created` writes `event_name = 'shipment_created'`
which IS in the list. That one is fine.

### Bug 4 — `set_inspection_window` trigger silently rewrites `delivered → inspection`

`schema.sql` line 433+ defines a BEFORE-UPDATE trigger
`orders_inspection_window` that rewrites any
`status='delivered'` write to `status='inspection'` and sets the
inspection window timestamps.

`record_shipment_status_change` writes `status='delivered'` and
emits an `order_events` row with `to_status='delivered'`. The
trigger then rewrites the row's status to `'inspection'`, but my
audit row claims the order is at `'delivered'`. **The audit log
disagrees with the row state.**

The locked V1 contract names `delivered` and `inspection` as two
distinct states (`shipped → delivered → inspection → completed`).
Today, because of the trigger, no order ever sits at `'delivered'`
— the trigger always pushes it to `'inspection'`. That's a state
machine the trigger silently collapses. Either:

- (A) accept the trigger as canonical and write `to_status='inspection'`
  in the audit row + emit `event_name='inspection_started'` (which IS
  in the CHECK list); or
- (B) drop the trigger and have the application layer drive both
  transitions explicitly.

**Recommendation: (A) for V1.** The trigger has been on `dev` since
the schema was first applied; existing dev tooling
(`/api/dev/advance-order`) already side-steps it by writing
`'inspection'` directly. Aligning the new RPC with the same
convention is the smallest change.

### Bug 5 — Verify route's race-loser refund passes wrong amount on conflict

`src/app/api/payments/verify/route.ts` calls `provider.refund({
amount: payment.amount })`. `payments.amount` is the row I created
from `/api/payments/create` — that's the full payment amount. For a
race-loser the buyer was just charged the full amount and gets the
full amount back, so this is actually correct. Not a bug, but worth
confirming.

---

## Non-critical issues

### Issue 1 — `/api/dev/advance-order` and `record_shipment_status_change` overlap

Both routes can advance an order to `inspection`. The dev-only
advance-order route sets `status='inspection'` directly; the new
shipment RPC writes `status='delivered'` (which the trigger rewrites
to `inspection`). Both end up at the same state, but two different
paths now exist for the same transition. After Bug 4 is fixed,
consider whether `/api/dev/advance-order` should be deleted in favour
of advancing the shipment to `delivered` via
`/api/dev/shipping/advance` (which is more realistic). Defer this
cleanup to a follow-up.

### Issue 2 — Hard-coded RazorpayPaymentProvider key name in CheckoutForm

CheckoutForm reads `razorpay_key_id` from the `/api/payments/create`
response. The route returns `razorpay_key_id: modal.publicKey`, where
`modal.publicKey` is `null` for the dev provider. CheckoutForm
correctly skips the Razorpay modal when `synthetic === true`, so the
null is never consumed. But the field name is provider-specific — if
we ever add a third provider, the response shape forces it to
masquerade as Razorpay. Acceptable for V1 (only two providers); flag
for V2 cleanup.

### Issue 3 — `RazorpayPaymentProvider.refund()` argument shape unverified

The Razorpay Node SDK's refund signature is:

```ts
razorpay.payments.refund(paymentId, { amount, notes })
```

The provider passes this correctly. But I have not verified the
SDK's actual behaviour in test mode (no credentials available). When
Razorpay creds arrive, this is one of the things to validate.

### Issue 4 — `orders.shiprocket_order_id` / `orders.shiprocket_shipment_id` columns

My RPC `record_shipment_created` writes the provider's order id and
shipment id into these columns regardless of whether the active
provider is Shiprocket. The column names are misleading — they hold
mock data when the mock provider runs. Renaming the columns
(`provider_order_id`, `provider_shipment_id`) would be cleaner but
breaks Person 1's seller dashboard, which already reads the
`shiprocket_*` columns. Defer the rename; the mock data round-trips
correctly.

### Issue 5 — `mock_shipments.events` JSONB grows unboundedly

The mock provider appends to `mock_shipments.events` on every
`advanceTracking` call. In V1 dev usage this is fine (a handful of
events per shipment), but a stress-test scenario could accumulate
large blobs. Not a launch blocker.

### Issue 6 — RLS policies absent on new tables

`shipments`, `shipment_events`, and `mock_shipments` have RLS
enabled but no policies, which means **service-role only**. Direct
buyer/seller reads through the user-scoped client will return zero
rows. All current consumers (`OrderTimeline`, `ShipmentTracking`,
shipping routes) use `createAdminClient()`, so this works. If anyone
later writes a server component or RPC that uses the user-scoped
client to read shipments, it will silently return empty.

Recommendation: add explicit RLS policies in a follow-up — buyer can
read shipments for their orders; seller can read shipments for their
orders; admin can read all. Same shape as `orders` and `payments`
RLS.

---

## Schema changes — full inventory

### New tables (migration 007)

- `shipments` — provider-agnostic shipment record. PRIMARY KEY id;
  UNIQUE on `awb` and on `order_id`; FK to `orders(id)` and via the
  buyer/seller relationship through the order.
- `shipment_events` — append-only audit. PRIMARY KEY id; FK to
  `shipments(id)` ON DELETE CASCADE.
- `mock_shipments` — provider-private storage for the mock provider.
  PRIMARY KEY awb; FK to `orders(id)`.

### New RPCs (migration 007)

- `record_shipment_created(...)` — SECURITY DEFINER, service-role
  only EXECUTE. Validates seller ownership + order status. **Fix
  required: actor_type, occurred_at column name.**
- `record_shipment_status_change(...)` — SECURITY DEFINER,
  service-role only EXECUTE. Validates lifecycle transition.
  **Fixes required: actor_type, occurred_at, event_name values,
  delivered-trigger interaction.**

### Triggers added (migration 007)

- `shipments_touch` — BEFORE UPDATE on `shipments`, sets
  `updated_at = NOW()`. Standard.
- `mock_shipments_touch` — same on `mock_shipments`.

### Schema invariants — what's preserved

All Phase 1 invariants are untouched:

- `listings.sold_order_id` lifetime invariant (migration 006)
- `sold_offer_id` immutability + `listings.status` no-regression
  (migration 005)
- `finalize_winning_payment` atomicity (migration 002)
- Refund lifecycle (migration 003)
- `checkout_locks` semantics (migration 004)

Migration 007 only ADDs tables and RPCs; it does not modify any
existing constraints, columns, or triggers. The only interaction
with existing schema is the `orders` UPDATE inside the new RPCs,
which writes pre-existing columns (`status`, `tracking_number`,
`courier_name`, `shiprocket_order_id`, `shiprocket_shipment_id`,
`estimated_delivery`, `shipped_at`, `delivered_at`,
`inspection_expires_at`, `updated_at`).

### Rollback

Migration 007 is fully reversible:

```sql
DROP FUNCTION record_shipment_status_change(TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION record_shipment_created(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INTEGER, TEXT, TEXT, UUID);
DROP TRIGGER mock_shipments_touch ON mock_shipments;
DROP TRIGGER shipments_touch ON shipments;
DROP FUNCTION touch_shipment_updated_at();
DROP TABLE shipment_events;
DROP TABLE shipments;
DROP TABLE mock_shipments;
```

No data dependency from anywhere outside migration 007. `orders`
columns that the RPC denormalises into were already present in the
original schema; they don't need to be cleared on rollback (they'd
just have stale values for orders that booked shipments before the
rollback).

---

## New environment variables

| Variable | Required when | Default |
|----------|---------------|---------|
| `PAYMENT_PROVIDER` | Set to `dev` to activate `DevPaymentProvider`. Any other value (or unset) → Razorpay. **Gated to non-prod `NODE_ENV`.** | unset (Razorpay) |
| `PAYMENT_DEV_SECRET` | Optional. Secret used by `DevPaymentProvider` for HMAC sign/verify of synthetic payments. | hardcoded fallback `'audiobaaz-dev-payment-secret'` |
| `ENABLE_DEV_PAYMENT_SIMULATION` | Required for `/api/dev/payments/webhook-replay`. Must be `'true'`. Also gated to non-prod `NODE_ENV`. | unset (route returns 404) |
| `SHIPPING_PROVIDER` | Optional. `mock` selects MockShippingProvider explicitly. `shiprocket` throws (not built). | unset → mock if no `SHIPROCKET_EMAIL` |
| `SHIPROCKET_EMAIL` | If set, factory throws (Shiprocket provider not built yet). | unset |

**`PAYMENT_PROVIDER=dev` MUST NOT be set in production Vercel env.**
The factory has a runtime guard, but the simplest defense is to
never put it in `production` env vars.

---

## Routes added / changed

| Route | Method | New / Changed | Auth | Notes |
|-------|--------|---------------|------|-------|
| `/api/payments/create` | POST | Refactored to call provider | Buyer | Returns `synthetic: boolean`. No behaviour change for Razorpay path. |
| `/api/payments/verify` | POST | Refactored | Buyer | Race-loser refund path now calls `provider.refund()` (synchronous) and `record_refund_outcome` for dev provider. |
| `/api/payments/webhook` | POST | Refactored | (HMAC) | Verifies via active provider's `verifyWebhookSignature`. Same idempotency behaviour. |
| `/api/dev/payments/simulate` | POST | New | Auth required | 404 unless `DevPaymentProvider` active. Synthesises `payment_id` + `signature`. |
| `/api/dev/payments/webhook-replay` | POST | New | Auth required | 404 unless `DevPaymentProvider` active. Re-signs and re-posts to `/api/payments/webhook`. |
| `/api/shipping/create` | POST | New | Seller of order | Calls active `ShippingProvider.createShipment()`, then `record_shipment_created` RPC. |
| `/api/shipping/track` | GET | New | Buyer or seller of order | Returns provider tracking snapshot. |
| `/api/dev/shipping/advance` | POST | New | Auth required | 404 unless `MockShippingProvider` active. Advances mock state + runs `record_shipment_status_change`. |

`/api/checkout/mock` REMOVED.

---

## UI changes

| Component | Status | Notes |
|-----------|--------|-------|
| `CheckoutForm` | Changed | New `synthetic` branch. Razorpay path unchanged from PR #4. |
| `src/app/orders/purchase/[orderId]/page.tsx` | Changed | New `<ShipmentTracking>` and `<OrderTimeline>` blocks. Existing status-stage tracker preserved. |
| `src/app/(main)/dashboard/orders/page.tsx` | Changed | Rows now link to `/dashboard/orders/[orderId]`. Timeline includes `seller_confirmed`. |
| `src/app/(main)/dashboard/orders/[orderId]/page.tsx` | New | Seller order detail with shipment action + dev-advance buttons. |
| `CreateShipmentButton.tsx` | New | Client island. POSTs `/api/shipping/create`. |
| `AdvanceShipmentButton.tsx` | New | Dev-only client island. |
| `OrderTimeline.tsx` | New | Server component reading `order_events` + `shipment_events`. **Affected by Bug 1.** |
| `ShipmentTracking.tsx` | New | Server component reading `shipments`. |

---

## Merge conflicts

`feature/checkout-razorpay-wire` (PR #4) is the only branch with
overlapping content. The active branch contains commit `5ae8cd7`
which is content-equivalent to `413bc77` on PR #4 (the same
CheckoutForm wiring + mock removal). Closing PR #4 without merging
eliminates the conflict.

No other open branch touches `src/app/api/payments/*`,
`src/lib/razorpay/*`, the shipping subtree, or the dev routes.

`dev`'s tip is `7b294e9`. The active branch's base is also `7b294e9`.
Linear merge.

---

## Lifecycle validation matrix — must pass before merge

| # | Scenario | Pass criteria |
|---|----------|---------------|
| **A** | Single buyer, single listing, complete checkout via dev provider | `listings.sold_order_id` set; `orders.status='escrow_held'`; `payments.status='captured'`; `order_events` row inserted without error |
| **B** | Buyer abandons checkout | `orders.status='payment_pending'`; `checkout_locks` row exists; listing remains `approved` |
| **C** | Two buyers race for same listing | One winner reaches `escrow_held`; loser's `payments.refund_status` set; loser's `orders.status='cancelled'` |
| **D** | Webhook replay via `/api/dev/payments/webhook-replay` | Same `payment.captured` posted twice → first processes, second returns `{replay: true}` |
| **E** | Payment failure path | `orders.status='payment_failed'`; listing untouched |
| **F** | Seller creates shipment after escrow_held | `orders.status` advances to `seller_confirmed` (no error); `shipments` row exists; `OrderTimeline` renders without error |
| **G** | Seller advances mock shipment through full lifecycle | `picked_up → orders.shipped`; `delivered → orders.inspection`; `OrderTimeline` shows merged events |
| **H** | Buyer/seller can view tracking via `/api/shipping/track` | Returns `TrackingSnapshot` with the AWB events |

**Until Bugs 1, 2, 3 are fixed, scenarios F, G, H all fail.**

The fixes are mechanical (rename column, add column, change two
event_name strings, write `inspection` instead of `delivered`).
After the fix commit, all scenarios should pass against `dev` with
`PAYMENT_PROVIDER=dev`.

---

## Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration 007 RPCs crash on first call | **HIGH** | Fix commit before merge — the bugs are in the audit log writes, mechanically simple to correct. |
| `set_inspection_window` trigger interaction obscures audit trail | **MEDIUM** | Align RPC to write `inspection` + `inspection_started` event_name. |
| Dev provider accidentally enabled in prod | **MEDIUM** | Two layers: factory checks `NODE_ENV !== 'production'`; deployment env vars are managed manually. Document in DEPLOYMENT.md. |
| `MockShippingProvider` data persists in prod DB | **LOW** | `mock_shipments` table is harmless — it's only written when the mock provider is active, and the mock provider is gated by env. The `shipments` row is canonical regardless of provider, so the prod data is correct even if mock data exists. |
| Buyer + seller authz on `/api/shipping/track` relies on join through orders | **LOW** | Verified — uses `orders!inner(buyer_id, seller_id)` and rejects others with 403. |
| RLS policies absent on new tables | **LOW** | Service-role-only is the V1 default for audit-style tables; no current consumer uses the user-scoped client. Add policies in a follow-up if needed. |
| 22 routes, no integration tests | **LOW** for V1 | The Phase 1 SQL acceptance + stress tests cover the marketplace-core invariants. Application-layer tests are deferred until the synthetic-payment lifecycle is exercised against a real dev DB. |

---

## Pre-merge checklist

- [ ] **Fix Bugs 1, 2, 3, 4** in migration 007 + a small fix to `OrderTimeline.tsx`. Single follow-up commit.
- [ ] Run lifecycle scenarios A–H against `dev.audiobaaz.com` with `PAYMENT_PROVIDER=dev` (or against a local Supabase if available).
- [ ] Confirm `next build` GREEN after the fix.
- [ ] Confirm `tsc --noEmit` clean.
- [ ] Document `PAYMENT_PROVIDER` env var in `docs/DEPLOYMENT.md`.
- [ ] Close PR #4 (`feature/checkout-razorpay-wire`) without merging.
- [ ] Open PR `feature/order-lifecycle-shipping → dev`.
- [ ] Reference this audit doc in the PR description.

---

## What this branch does NOT include

For clarity — items the user might expect to land here that did not:

- **Admin operations** (dispute → refund wiring, payouts UPI flow, orders monitor). Deferred to a follow-up commit on the same branch (or a separate PR if the branch grows too large).
- **`ShiprocketProvider`** implementation. Deferred until credentials available.
- **48h auto-release worker.** Manual admin escrow release was planned but not built.
- **RLS policies on `shipments` / `shipment_events` / `mock_shipments`.** Deferred.
- **Real Razorpay test-mode validation.** Deferred until credentials available.
- **Rate limiting on dev routes.** Deferred. Dev routes require auth, are gated to non-prod, but have no rate limit.

---

## Recommendation

**Do not merge until the fix commit lands and scenarios A–H are
verified.** The bugs are mechanical and fast to fix — likely under
30 minutes — but they would surface as user-visible 500s on the
first real shipment booking. Catching them in audit is worth more
than catching them in production logs.
