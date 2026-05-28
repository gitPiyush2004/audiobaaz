# Payments & Shipping — Context File
**Owner:** Person 4
**Branch:** feature/seller-flow
**Last updated:** 2026-05-29

---

## What This Feature Does

Handles all money movement and logistics. Razorpay payment creation and
verification, escrow management, Shiprocket shipment creation and tracking,
webhook handlers for both services, and payout triggers.

---

## Current Status

```
[x] src/lib/razorpay/client.ts          — Razorpay instance (throws if keys missing)
[x] src/lib/razorpay/helpers.ts         — verifyWebhookSignature, verifyPaymentSignature
[x] src/lib/shiprocket/client.ts        — Authenticated fetch wrapper, token cache + retry on 401
[x] src/lib/shiprocket/helpers.ts       — buildShiprocketPayload, TypeScript types
[x] POST /api/payments/create           — Create Razorpay order + DB order record
[x] POST /api/payments/verify           — Verify client-side payment callback
[x] POST /api/payments/webhook          — Razorpay webhook (captured + failed events)
[x] POST /api/shipping/create-shipment  — Create Shiprocket shipment, notify buyer
[x] GET  /api/shipping/track            — Track shipment by order_id

[ ] Shiprocket webhook — update order status on courier scan events (not started)
[ ] Payout trigger — admin initiates UPI payout (V1: manual, not started)
[ ] Dispute resolution API — admin resolves disputes, triggers refund (not started)
```

---

## Files Created

```
src/lib/razorpay/client.ts                      ✓ done
src/lib/razorpay/helpers.ts                     ✓ done
src/lib/shiprocket/client.ts                    ✓ done
src/lib/shiprocket/helpers.ts                   ✓ done
src/app/api/payments/create/route.ts            ✓ done
src/app/api/payments/verify/route.ts            ✓ done
src/app/api/payments/webhook/route.ts           ✓ done
src/app/api/shipping/create-shipment/route.ts   ✓ done
src/app/api/shipping/track/route.ts             ✓ done
```

---

## Database Tables This Feature Uses

| Table | Operation | Notes |
|-------|-----------|-------|
| payments | INSERT, UPDATE | All Razorpay records |
| orders | INSERT, UPDATE | Status changes, tracking info |
| listings | UPDATE | sold/approved on payment captured/failed |
| offers | UPDATE | status → paid on payment captured |
| users | SELECT | Telegram chat IDs for notifications |

---

## Env Vars Required

| Var | Where | Notes |
|-----|-------|-------|
| `RAZORPAY_KEY_ID` | `.env.local` | Public key — returned to client for modal |
| `RAZORPAY_KEY_SECRET` | `.env.local` | Used for payment signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | `.env.local` | Set in Razorpay dashboard — separate from KEY_SECRET |
| `SHIPROCKET_EMAIL` | `.env.local` | Login email |
| `SHIPROCKET_PASSWORD` | `.env.local` | Login password |
| `SHIPROCKET_PICKUP_LOCATION` | `.env.local` | Pickup address label from Shiprocket dashboard |

---

## Critical Rules For This Feature

- ALL amounts in PAISE. Never use floats. ₹10,000 = 1000000
- Shiprocket API uses RUPEES — conversion happens only in `buildShiprocketPayload`
- Always verify Razorpay webhook signature before processing
- Never expose Razorpay secret key or Shiprocket password to client
- Use test keys for V1 — prefix all test Razorpay IDs with `rzp_test_`
- Escrow = funds captured by Razorpay but not yet paid out to seller

---

## Key Architecture Decisions Made

### Payment flow
1. Buyer hits checkout → `POST /api/payments/create`
   - Validates listing is `approved`, builds Razorpay order
   - DB trigger `reserve_listing()` fires on insert → listing → `reserved` for 15 min
   - Returns `{ razorpay_order_id, amount, currency, key_id }` to client
2. Client opens Razorpay modal with returned params
3. On success: client calls `POST /api/payments/verify` with signature
   - Verifies signature, updates payment → `captured`, order → `escrow_held`
   - Listing → `sold`, offer (if any) → `paid`
   - Notifies seller via Telegram
4. Razorpay also calls `POST /api/payments/webhook` server-to-server
   - Both verify and webhook are idempotent — whichever arrives first wins

### Signature verification
- Webhook: HMAC-SHA256 of raw body with `RAZORPAY_WEBHOOK_SECRET`
- Client callback: HMAC-SHA256 of `razorpay_order_id|razorpay_payment_id` with `RAZORPAY_KEY_SECRET`
- Webhook uses admin Supabase client (no user session)

### Shiprocket
- Token cached at module level, re-authenticated on 401
- Seller calls `POST /api/shipping/create-shipment` after escrow — order → `seller_confirmed`
- `SHIPROCKET_PICKUP_LOCATION` must match a label in the Shiprocket dashboard
- Default dimensions: 20×15×10 cm, 0.5 kg — update per item in V2
- Shipping fee: fixed ₹150 (15000 paise) in V1 — dynamic Shiprocket quotes in V2

### Payout (V1)
- Manual — admin triggers via dashboard (Person 3's domain)
- V1: admin sees order in `completed` state, manually initiates UPI transfer
- V2: automate via Razorpay Route / RazorpayX

---

## What Other Features Can Use From Here

| What | Path | Notes |
|------|------|-------|
| `POST /api/payments/create` | `src/app/api/payments/create/route.ts` | Buyer checkout calls this. Returns Razorpay modal params. |
| `POST /api/payments/verify` | `src/app/api/payments/verify/route.ts` | Called by client after Razorpay modal success. |
| `GET /api/shipping/track` | `src/app/api/shipping/track/route.ts` | Both buyer + seller can call. Params: `?order_id=`. |
| `POST /api/shipping/create-shipment` | `src/app/api/shipping/create-shipment/route.ts` | Seller calls from dashboard Orders section. |
| Razorpay helpers | `src/lib/razorpay/helpers.ts` | Signature verification — don't duplicate. |
| Shiprocket client | `src/lib/shiprocket/client.ts` | `shiprocket(path, options)` for any Shiprocket API call. |

---

## Next Session Starts Here

Core payment + shipping API is complete. Remaining items:
1. Shiprocket webhook — `POST /api/shipping/webhook` — handle AWB assigned, shipped, delivered events → update order status + notify buyer/seller
2. Payout trigger — depends on admin panel (Person 3). Admin panel needs a button that calls a `PATCH /api/orders/[id]` with `{ action: 'release_payout' }` — not built yet
3. Dispute API — `POST /api/disputes` and `PATCH /api/disputes/[id]` — depends on admin panel
