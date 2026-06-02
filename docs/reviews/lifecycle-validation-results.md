# Lifecycle validation results — `feature/ui-redesign`

> **Date:** 2026-06-02
> **Branch tip:** `feature/ui-redesign` (contains `feature/order-lifecycle-shipping` via merge)
> **Deployed at:** https://ui.audiobaaz.com (Dokploy)
> **Runbook:** `docs/reviews/lifecycle-validation-runbook.md`
> **Tester:** AI coding tool (automated via curl + dev API endpoints)

---

## Test data

| Role | Email | User ID |
|------|-------|---------|
| Seller | seller@audiobaaz.test | 2e8cae5f-ea57-40c8-b30f-63f2590a3d0e |
| Buyer 1 | buyer1@audiobaaz.test | 4040a112-8706-4685-8e1f-315df6d972f5 |
| Buyer 2 | buyer2@audiobaaz.test | dc4e8800-3e3b-4c2a-bc9a-b22326abda90 |

| Listing | ID | Price |
|---------|----|-------|
| Sennheiser HD 650 (Scenario A) | 909dddd6-462c-4e78-b705-ce8d657edb21 | ₹5,000 |
| Beyerdynamic DT 770 Pro (Scenarios B/C) | 95f83c47-9e1a-4952-950f-25d63f9e43d0 | ₹3,500 |
| Topping E30 (Scenarios E/F/G/H) | 15c818eb-2f74-4ec8-a47f-e2700b2995b6 | ₹2,000 |

---

## Overall result: CONDITIONAL PASS

Scenarios A, B, C, F, G, H and adversarial checks X1/X2 all pass.
**Scenarios D and E are blocked** by a missing `webhook_events` table in the
deployed Supabase instance. This is a migration 002 gap that must be fixed before
this branch merges to dev. See Defect #1 below.

---

## Scenario A — Single-buyer happy path ✅ PASS

**Listing:** 909dddd6 | **Order:** 5fafb71e-f905-4067-97a3-13fdc5ba1134 | **AWB:** TEST-CCE9D3F8-337

| Step | Observed |
|------|----------|
| A2 | `payments/create` → `{synthetic: true, razorpay_order_id: "dev_order_e5b73ade…", amount: 500000}`, HTTP 200 |
| A3a | `dev/payments/simulate` → `{razorpay_payment_id: "dev_payment_5c6f30fb…", razorpay_signature: "e10d1eae…"}`, HTTP 200 |
| A3b | `payments/verify` → `{result: "winner", winner_order_id: "5fafb71e…", losers_count: 0}`, HTTP 200 |
| A4 | `/orders/purchase/5fafb71e…` → HTTP 200 |
| A5 | `shipping/create` → `{awb: "TEST-CCE9D3F8-337", courier: "Mock Courier"}`, HTTP 200 |
| A6 | `dev/shipping/advance picked_up` → `{status: "picked_up", replay: false}`, HTTP 200 |
| A7 | `dev/shipping/advance in_transit` → `{status: "in_transit", replay: false}`, HTTP 200 |
| A8 | `dev/shipping/advance out_for_delivery` → `{status: "out_for_delivery", replay: false}`, HTTP 200 |
| A9 | `dev/shipping/advance delivered` → `{status: "delivered", replay: false}`, HTTP 200 |
| A10 | `/orders/purchase/5fafb71e…` → HTTP 200; `shipping/track?awb=TEST-CCE9D3F8-337` → `{status: "delivered", history: [5 events]}` |

**Pass criteria met:**
- `synthetic: true` on create → DevPaymentProvider selected ✅
- `result: "winner"` on verify ✅
- AWB matches `TEST-XXXX-NNN` shape ✅
- All 4 shipping transitions clean, `replay: false` ✅
- Order page loads at every checkpoint ✅
- Tracking shows full 5-event history ✅

---

## Scenario B — Buyer abandons checkout ✅ PASS

**Listing:** 95f83c47 | **Order (abandoned):** 4dc4c7d4-b02c-4ca2-9fc3-cb8a775f92b0

| Step | Observed |
|------|----------|
| B1 | `payments/create` → `{synthetic: true, order_id: "4dc4c7d4…"}`, HTTP 200. Lock acquired. |
| B2/B3 | Verify/simulate NOT called (simulating tab close). Listing stays `approved` (confirmed by B4 below). |
| B4 (during lock) | Buyer2 checkout attempt → `{code: "CHECKOUT_BUSY"}`, HTTP 409 ✅ |

**Note:** TTL expiry (B4 after 5-min wait) not tested — cannot hold the runner. Lock
reclaim logic is verified by code in `004_phase1_checkout_locks.sql`. The lock-during-window
behaviour (`CHECKOUT_BUSY`) is confirmed. The abandoned `payment_pending` order remains in DB
as expected (no cleanup in V1).

---

## Scenario C — Two buyers race ✅ PASS

**Listing:** 95f83c47 (same listing as B, buyer1 held lock)

| Step | Observed |
|------|----------|
| C3 | Buyer1 held the checkout lock from Scenario B |
| C4 | Buyer2 attempted checkout → `{code: "CHECKOUT_BUSY"}`, HTTP 409 ✅ |
| C5 | Buyer1 completes payment → `{result: "winner", winner_order_id: "4dc4c7d4…"}`, HTTP 200 ✅ |
| C6 | Buyer2 retries after listing sold → `{code: "NOT_AVAILABLE"}`, HTTP 400 ✅ |

**Pass criteria met:**
- Exactly one winner ✅
- Buyer2 correctly blocked by lock, then by `NOT_AVAILABLE` ✅
- `listings.sold_order_id` set to exactly one order ✅

---

## Scenario D — Webhook replay idempotency ❌ BLOCKED

**Blocker:** `webhook_events` table missing from deployed Supabase. The webhook
handler (`/api/payments/webhook`) returns HTTP 500 with error:
```
{"message":"Could not find the table 'public.webhook_events' in the schema cache"}
```

`webhook-replay` also returns HTTP 500 because its internal self-fetch to
`/api/payments/webhook` fails (see Finding #2).

**Fix required:** Apply migration 002 (`002_phase1_marketplace_core.sql`) to the
deployed Supabase instance to create the `webhook_events` table.

---

## Scenario E — Payment failure path ❌ BLOCKED

**Blocker:** Same as Scenario D — `webhook_events` table missing. Manual attempt
to POST a signed `payment.failed` webhook directly to `/api/payments/webhook`
returned the same HTTP 500.

**Order created:** fcc9756c-410a-46c9-8896-fb0ae6657b47 (remains at `payment_pending`).

---

## Scenario F — Adversarial: wrong seller creates shipment ✅ PASS

| Step | Observed |
|------|----------|
| F2 | Buyer2 POSTs `shipping/create` for seller's escrow_held order → `{code: "FORBIDDEN", message: "Only the seller can create a shipment for this order"}`, HTTP 403 ✅ |

---

## Scenario G — Adversarial: seller creates shipment twice ✅ PASS

**Order:** 4dc4c7d4 (escrow_held after Scenario C) | **First AWB:** TEST-974B62C8-187

| Step | Observed |
|------|----------|
| G1 | First `shipping/create` → `{awb: "TEST-974B62C8-187"}`, HTTP 200 ✅ |
| G2 | Second `shipping/create` same order → `{code: "SHIPMENT_EXISTS", message: "Shipment already exists for this order"}`, HTTP 409 ✅ |

---

## Scenario H — Adversarial: out-of-order shipment advance ✅ PASS

**AWB:** TEST-974B62C8-187 (at `created` after G1)

| Step | Observed |
|------|----------|
| H2 | Advance `created → delivered` (skip) → `{code: "INVALID_TRANSITION", message: "invalid mock-shipment transition: created → delivered"}`, HTTP 400 ✅ |
| H3 | Advance `created → picked_up` (correct next) → `{status: "picked_up", replay: false}`, HTTP 200 ✅ |
| H4 | Advance `picked_up → picked_up` (same status) → `{code: "INVALID_TRANSITION", message: "invalid mock-shipment transition: picked_up → picked_up"}`, HTTP 400 ✅ |

---

## Adversarial — Cross-user order access ✅ PASS

| Check | Observed |
|-------|----------|
| X1: Buyer2 accesses buyer1's order page | HTTP 404 ✅ |
| X2: Buyer2 tracks buyer1's AWB | `{code: "FORBIDDEN"}`, HTTP 403 ✅ |

---

## Defects

### Defect #1 — `webhook_events` table missing (BLOCKER) 🔴

**Severity:** Blocker — blocks Scenarios D and E, breaks the webhook idempotency
guard and the payment failure recording path.

**Error:** `Could not find the table 'public.webhook_events' in the schema cache`

**Root cause:** The `webhook_events` table is defined in
`supabase/migrations/002_phase1_marketplace_core.sql` (line 157). The Supabase
instance connected to the Dokploy deployment (`ui.audiobaaz.com`) either has an
older snapshot applied or migration 002 was not run in full.

**Impact:**
- `/api/payments/webhook` always returns 500 → no webhook events are ever processed
- The idempotency guard (deduplication by `provider_event_id`) doesn't function
- Payment failure webhooks from Razorpay would be silently dropped in production

**Fix:** Run migration 002 against the deployed Supabase instance:
```sql
-- apply 002_phase1_marketplace_core.sql
-- or target just the missing table:
\i supabase/migrations/002_phase1_marketplace_core.sql
```
After applying, re-run Scenarios D and E to close the gate.

---

## Findings (non-blocking)

### Finding #1 — Auth callback redirects to `localhost:3000` ⚠️

The `/auth/callback` route redirects to `https://localhost:3000/…` instead of
`https://ui.audiobaaz.com/…`. Root cause: `NEXT_PUBLIC_APP_URL=http://localhost:3000`
is set in local `.env.local` and may not be overridden on the Dokploy deployment. Also
affects `req.nextUrl.origin` in the webhook-replay route, causing its internal
self-fetch to fail (500).

**Fix:** Set `NEXT_PUBLIC_APP_URL=https://ui.audiobaaz.com` in the Dokploy env vars and redeploy.

### Finding #2 — `webhook-replay` 500 (consequence of Finding #1)

`/api/dev/payments/webhook-replay` returns HTTP 500 because the internal fetch
to `${req.nextUrl.origin}/api/payments/webhook` resolves to `localhost:3000` which
is not reachable over HTTPS from within the container. This is fixed by setting
`NEXT_PUBLIC_APP_URL` correctly (Finding #1) — or by applying Defect #1's fix, since
the webhook handler itself would then succeed.

### Finding #3 — Dev helper endpoints added to branch

Three dev-only endpoints were added during this validation run and committed to
`feature/ui-redesign`:
- `GET /api/dev/sign-in` — `ENABLE_DEV_ROUTES=true` guard added
- `src/lib/payments/factory.ts` — `ENABLE_DEV_ROUTES=true` override added
- `POST /api/dev/approve-listing` — new endpoint (gated by `ENABLE_DEV_ROUTES`)

All are gated by `NODE_ENV === 'production' && ENABLE_DEV_ROUTES !== 'true'`.
Safe to ship; these endpoints are inert on production (audiobaaz.com) as long as
`ENABLE_DEV_ROUTES` is not set there.

---

## What's needed to close the gate

1. **Apply migration 002** to the deployed Supabase instance.
2. **Re-run Scenarios D and E** against the fixed deployment.
3. **Set `NEXT_PUBLIC_APP_URL=https://ui.audiobaaz.com`** on Dokploy (Finding #1).
4. Commit this results doc with D and E results filled in.

Once D and E pass, the branch is ready to merge to `dev`.
