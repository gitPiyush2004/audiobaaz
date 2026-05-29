
# Payments & Shipping — Context File
**Owner:** Person 4
**Branch:** feature/payments-shipping (not yet created)
**Last updated:** 2026-05-29

---

## What This Feature Does

Owns all money movement and logistics for the marketplace. Razorpay
checkout creation, payment capture and verification, escrow accounting,
Shiprocket shipment creation, AWB generation, courier-event ingestion,
escrow release on dispute-window expiry, refund processing for race losers
and disputes, and admin payout controls.

This feature is the boundary between the marketplace's negotiation domain
(offers) and the marketplace's logistics + money domain (orders). It does
NOT own offer state transitions other than the single `accepted → paid`
edge that fires from a verified Razorpay capture.

---

## Current Status

```
[ ] Not started
[ ] In progress
[ ] Complete
[x] Blocked — architecture locked; session-zero audit complete
    (docs/reviews/payments-session-zero.md is the authoritative
    artifact; Schema Contract §4 is the primary review surface);
    implementation deferred pending OQ#1 (lifecycle) and Phase 1
    schema work. feature/payments-shipping branch parked at f47ab10.
```

Status reality (audit-verified):
- No payment or shipping code on `dev`. `src/app/api/` has no
  `payments/` or `shipping/` directories.
- Nine Razorpay/Shiprocket files exist on the parked
  `feature/payments-shipping` branch (HEAD `f47ab10`); audit §5.9
  ("Implementation Inventory") records the file-by-file disposition
  (5 keep, 4 revise, 0 rewrite).
- Buyer flow on `dev` uses `/api/checkout/mock` as a transitional
  stand-in. Replaced in Phase 2 (audit §8).

Offer-domain code on `dev` remains mock-backed (`src/lib/offers/*` +
`src/lib/mock/offers.ts`). Nothing on `dev` talks to Razorpay or
Shiprocket.

---

## Domain Boundaries (locked)

Two state machines, two audit logs, two webhook ingress paths.

```
Offer domain                          Order domain
────────────                          ────────────
pending                               created
accepted                              awb_generated
paid          ─── handoff ──→         pickup_scheduled
                                      in_transit
declined                              out_for_delivery
cancelled                             delivered
expired                               escrow_held
lost                                  escrow_released
                                      completed

Audit: offer_events                   cancelled
                                      disputed
                                      refunded

                                      Audit: order_events
```

- Razorpay events affect the **offer** domain (accept → paid) and emit one
  order row.
- Shiprocket events affect the **order** domain (awb → pickup → in_transit
  → delivered).
- Escrow release affects the **order** domain.
- Disputes affect the **order** domain.
- Nothing in this feature ever transitions an offer past `paid`.

If any document or code path implies `offer → shipped` or `offer → delivered`,
that is a domain-boundary violation and must be flagged.

### The handoff (read this before writing any payment code)

```
Offer domain
------------
pending → accepted → paid

PAID IS TERMINAL FOR THE OFFER.

When an offer transitions to paid:
  1. The offer lifecycle ends — no further offer-domain transitions.
  2. An `orders` row is created in the same transaction.
  3. The order lifecycle begins at `created`.
```

The order is a separate entity with its own state machine, its own audit
log (`order_events`), and its own webhook ingress (Shiprocket). Code that
treats the offer and order as one continuous chain will break the audit
boundary and produce category-confused events.

---

## Locked Architecture Decisions

These decisions are settled. They are recorded here so any subsequent
session reading this file inherits them as constraints, not as open
questions.

### Offer enum (seven states)

```
pending  accepted  paid      ← happy path
declined cancelled expired   ← existing terminals
lost                         ← NEW
```

`lost` means: another buyer completed payment for the same listing first.
The offer was valid; the listing is no longer available.

### New offer-domain event

```
system_listing_sold
```

Fires from the Razorpay capture handler for the winning offer. Cascades
across all other offers on the same listing:

- `pending  → lost` via `system_listing_sold`
- `accepted → lost` via `system_listing_sold`

This is the only path to `lost`. There is no buyer or seller event that
produces it.

### `expired` stays collapsed

Both timeout cases keep producing `expired`:

- `pending  → expired` via `system_expire_seller` (24h no seller response)
- `accepted → expired` via `system_expire_buyer`  (24h no buyer payment)

Analytics (seller-ghosting vs buyer-ghosting) live in `offer_events`,
not in the status enum. Status answers "what is true now"; the event log
answers "how did we get here."

### Order state machine (with branches, not a chain)

Linear happy path:

```
created → awb_generated → pickup_scheduled → in_transit
       → out_for_delivery → delivered → escrow_held
       → escrow_released → completed
```

Branches off the linear path:

```
created          → cancelled         (pre-AWB; auto-refund)
delivered        → disputed          (buyer raises within dispute window)
escrow_held      → disputed          (seller-side or platform-side dispute)
disputed         → refunded          (admin resolves in buyer's favour)
disputed         → escrow_released   (admin resolves in seller's favour)
cancelled        → refunded
```

`escrow_held` is a distinct state from `delivered`. Delivery means the
courier dropped the package; `escrow_held` means the dispute window is
running. Releasing too eagerly on `delivered` is a class of bug.

**Returns workflow is deferred.** No `return_pickup`, `return_in_transit`,
or `return_completed` states in V1. Reverse logistics is a separate slice
that will be designed after payments and forward shipping are live. Until
then, refunds happen via dispute resolution, not via a return flow.

### Race-loser refund flow (three layers)

The DB invariant prevents two `paid` offers, but cannot prevent two
captures from Razorpay. All three layers below must exist:

1. **Pre-payment guard.** Before issuing a Razorpay `order_id`, take a
   short TTL (~5 min) lock on `(listing_id)`. Reduces the race window
   to "two near-simultaneous order_create calls."
2. **Webhook winner selection.** First valid `payment.captured` whose
   transactional cascade succeeds is the winner. The DB invariant
   (one paid offer per listing) decides; the handler does not pick.
3. **Automatic refund job.** When the cascade fails for the second
   capture, enqueue a refund for that `payment_id`. Buyer-facing message
   is "another buyer completed payment first; your refund is on the way,"
   not "payment failed."

### Atomic transaction boundary

A winning capture writes to four tables for the winner plus two tables
for every other offer on the listing:

- `offers.status` (winner: `accepted → paid`; losers: `* → lost`)
- `orders` (insert one row for the winner)
- `offer_events` (one row per transition, including loser cascades)
- `order_events` (one row for `created`)
- `webhook_events` (mark this Razorpay event id as processed)

All of these commit together or none commit. The "no winner, twelve
losers" outcome is irrecoverable without manual intervention and is
worse than a duplicate capture. Person 1 owns the transaction primitive
(stored procedure, transactional API, or explicit BEGIN/COMMIT with
serialization-failure retry).

---

## Hard Prerequisites (Blocking Implementation)

Razorpay and Shiprocket integration cannot start until all of these
exist on dev. Ownership split is intentional — schema and DB primitives
are Person 1; payment-domain workflow design is Person 4; product-shape
decisions cross-cut.

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | Offer enum lock (seven values incl. `lost`) | Product + Person 1 | Decision in this doc; migration owned by Person 1 |
| 2 | Order state machine lock (states + branches) | Product + Person 4 | Decision in this doc; payments owns the lifecycle shape |
| 3 | DB invariant: one paid offer per listing | Person 1 | Unique partial index OR `listings.sold_offer_id` with unique constraint |
| 4 | Atomic transaction primitive covering winner cascade | Person 1 | RPC / stored procedure / serializable transaction |
| 5 | `webhook_events` table (idempotency by provider event id) | Person 1 | Shared across Razorpay, Shiprocket, future providers |
| 6 | `offer_events` table (offer-domain audit) | Person 1 | event_name, actor, from_status, to_status, timestamp |
| 7 | `order_events` table (order-domain audit) | Person 1 | Same shape as offer_events; separate so neither becomes misc_log |
| 8 | Razorpay race-loser refund design (3-layer flow) | Person 4 | Pre-payment lock + winner cascade + automatic refund job; payments-domain concern, not persistence |
| 9 | RLS policies on `offer_events` and `order_events` | Person 1 + Person 4 | Losing buyer can read their own `lost` reason; cannot read winning buyer's identity |

If any of these slip into the wrong owner's scope, the phasing in the
implementation plan blocks on a cross-team handoff that wasn't planned.

---

## Files This Feature Will Own (planned)

Nothing on this list exists on `dev`. Nine of them exist on the parked
`feature/payments-shipping` branch (`f47ab10`). The audit at
`docs/reviews/payments-session-zero.md` §2 Inventory C and §5.9
Implementation Inventory record the file-by-file disposition that
Phase 2 will follow. Listed below for shared expectations only.

```
src/lib/razorpay/client.ts                       — singleton instance, throws on missing keys
src/lib/razorpay/helpers.ts                      — signature verification (webhook + callback)
src/lib/razorpay/checkout-lock.ts                — Layer 1 pre-payment guard
src/lib/razorpay/refund.ts                       — race-loser refund job
src/lib/shiprocket/client.ts                     — token-cached fetch wrapper
src/lib/shiprocket/helpers.ts                    — payload builders, type definitions
src/lib/orders/state.ts                          — order state machine (mirrors src/lib/offers/state.ts shape)
src/lib/orders/types.ts                          — order view-models
src/app/api/payments/create/route.ts             — issues Razorpay order_id under checkout lock
src/app/api/payments/verify/route.ts             — client-callback verification
src/app/api/payments/webhook/route.ts            — Razorpay server-to-server webhook
src/app/api/shipping/create-shipment/route.ts    — seller-initiated shipment creation
src/app/api/shipping/track/route.ts              — read-side tracking
src/app/api/shipping/webhook/route.ts            — Shiprocket courier-event webhook
src/app/api/orders/[id]/route.ts                 — order read + admin actions (release, refund)
```

---

## Database Operations

| Table | Operation | Notes |
|-------|-----------|-------|
| `offers` | UPDATE | `accepted → paid` (winner); `* → lost` (losers) |
| `offer_events` | INSERT | One row per transition |
| `orders` | INSERT, UPDATE | Insert at handoff; UPDATE through order lifecycle |
| `order_events` | INSERT | One row per order transition |
| `listings` | UPDATE | `sold_offer_id` set transactionally; status → `sold` |
| `payments` | INSERT, UPDATE | Razorpay record + capture/refund state |
| `webhook_events` | INSERT, UPDATE | Idempotency table; record once per provider event id |
| `users` | SELECT | Telegram chat ids for notifications, UPI for payouts |

---

## API Routes Owned (planned)

| Method | Route | What it does |
|--------|-------|--------------|
| POST | `/api/payments/create` | Acquire checkout lock, create Razorpay order, return modal params |
| POST | `/api/payments/verify` | Verify client callback signature; idempotent with webhook |
| POST | `/api/payments/webhook` | Razorpay server-to-server; runs winner cascade transaction |
| POST | `/api/shipping/create-shipment` | Seller creates Shiprocket shipment for `escrow_held` order |
| GET  | `/api/shipping/track` | Read-side AWB lookup; buyer + seller |
| POST | `/api/shipping/webhook` | Shiprocket courier events → order state transitions |
| GET  | `/api/orders/[id]` | Order detail (RLS-scoped to participants + admin) |
| PATCH| `/api/orders/[id]` | Admin actions: release_payout, refund, resolve_dispute |

---

## Env Vars Required

| Var | Where | Notes |
|-----|-------|-------|
| `RAZORPAY_KEY_ID` | `.env.local` | Public key — returned to client for modal |
| `RAZORPAY_KEY_SECRET` | `.env.local` | Used for client-callback signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | `.env.local` | Set in Razorpay dashboard — separate from KEY_SECRET |
| `SHIPROCKET_EMAIL` | `.env.local` | Login email |
| `SHIPROCKET_PASSWORD` | `.env.local` | Login password |
| `SHIPROCKET_PICKUP_LOCATION` | `.env.local` | Pickup label from Shiprocket dashboard |
| `SHIPROCKET_WEBHOOK_TOKEN` | `.env.local` | Shared secret for inbound webhook verification |

---

## Razorpay escrow — read before assuming behaviour

> **WARNING — escrow is application-layer in V1.**
>
> The current architecture targets standard Razorpay test-mode APIs.
> Marketplace escrow behaviour (capture-and-hold, dispute-window release,
> refund-on-loss) is modeled inside Audiobaaz application logic, not by
> a Razorpay product. Razorpay sees a normal capture; the dispute window,
> escrow_held state, and seller payout are Audiobaaz concepts that live
> in our DB and our handlers.
>
> A future migration to **Razorpay Route**, **Razorpay Escrow**, or the
> Razorpay Marketplace product would require changes to:
>
> - payout flow (Route splits at capture vs deferred manual UPI today)
> - settlement flow (Razorpay-managed vs in-house ledger)
> - webhook handling (additional event types: transfer.processed, etc.)
> - refund workflow (Route refunds reverse the split, not a flat refund)
>
> Do not assume "Razorpay = real escrow" when reading any code in this
> feature. We are simulating escrow until a marketplace product is
> evaluated and migrated to.

---

## Shiprocket — source of truth for shipment states

Shiprocket is the **source of truth** for these order-state transitions:

```
awb_generated
pickup_scheduled
in_transit
out_for_delivery
delivered
```

These states are written exclusively by the Shiprocket webhook handler
(`POST /api/shipping/webhook`) after token verification.

Manual admin actions MUST NOT directly set these states. There is no
`PATCH /admin/orders/:id/status` that flips `in_transit → delivered`
from a UI button. Bypassing Shiprocket would:

- Break auditability (`order_events` would carry an admin actor for a
  state the courier should own).
- Desynchronise our state from the courier's reality.
- Create reconciliation bugs at escrow release time.

The only exception is a documented **recovery flow** (Shiprocket data
loss, courier API outage) which writes through a separate admin RPC
that records the override explicitly in `order_events` with
`event_name = 'admin_recovery_override'`. Recovery overrides are not
part of normal operations.

---

## Critical Rules For This Feature

- All amounts in PAISE in our domain. Never floats. ₹10,000 = 1 000 000 paise.
- Shiprocket API uses RUPEES; conversion is the responsibility of
  `buildShiprocketPayload` and lives nowhere else.
- Verify Razorpay webhook signature before any side effect. Verify
  Shiprocket webhook token before any side effect.
- Never expose `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
  Shiprocket credentials, or any payment_id-to-user mapping to clients.
- Webhook handlers MUST be idempotent on `webhook_events.provider_event_id`.
  Replays are normal and must be safe.
- Webhook handlers MUST be transactional. Partial cascades produce
  worse states than not running at all.
- The frontend never triggers offer transitions other than `pending →
  cancelled` (buyer cancel before acceptance). `accepted → paid` is fired
  exclusively from the verified payment path. `* → lost` is fired
  exclusively from the winner cascade.
- Admin actions are write-protected. RLS gates `release_payout`, `refund`,
  and `resolve_dispute` to admin role.

---

## Risks Tracked

| Class | Risk | Mitigation |
|-------|------|------------|
| Race | Two captures for one listing | Pre-payment lock + DB invariant + race-loser refund job |
| Atomicity | Partial winner cascade | Single transaction primitive (Person 1 deliverable) |
| Replay | Webhook delivered twice | `webhook_events` idempotency on provider event id |
| Spoof | Webhook from non-Razorpay/Shiprocket caller | Signature/token verification before any side effect |
| RLS | Loser sees winner's identity in `offer_events` | Audit-table RLS policy denies cross-buyer reads |
| Escrow | Funds released too early (on `delivered`, not after dispute window) | `escrow_held` is a distinct state; release is time-gated |
| Refund | Captured-but-lost buyer sees "payment failed" | Layer-3 refund job + correct buyer messaging |
| Operational | Manual payout step in V1 | Admin UI surfaces only orders in `escrow_released` |

---

## What Other Features Can Use From Here

Nothing yet — surface area below is what other features should plan
against, not what they can call today.

| What | Path | Notes |
|------|------|-------|
| `POST /api/payments/create` | (planned) | Buyer checkout calls this. Returns Razorpay modal params. |
| `POST /api/payments/verify` | (planned) | Client callback after Razorpay modal success. |
| `GET /api/shipping/track` | (planned) | Buyer + seller read-side. Param: `?order_id=`. |
| `POST /api/shipping/create-shipment` | (planned) | Seller dashboard Orders section. |
| Razorpay helpers | (planned) | Signature verification — single source. |
| Shiprocket client | (planned) | `shiprocket(path, options)` for any Shiprocket call. |

---

## Decisions Made In This Feature

- Offer domain stops at `paid`. Order domain owns shipping + escrow. No
  offer status implies courier or escrow state.
- `lost` added to offer enum before persistence; fires only via
  `system_listing_sold` cascade from a verified capture.
- `expired` stays collapsed for both timeout cases; analytics live in
  `offer_events`.
- Order state machine has branches (cancelled, disputed, refunded) rather
  than a linear chain.
- `escrow_held` modeled as a distinct state from `delivered`.
- Race-loser handling uses three layers: pre-payment lock, webhook
  cascade, automatic refund job.
- Winner cascade is a single transaction; partial commit is unacceptable.
- `webhook_events` is shared across providers (Razorpay, Shiprocket,
  future). `offer_events` and `order_events` are separate per domain.

---

## Dependencies On Other Features

| Needs | From | Status |
|-------|------|--------|
| `offers.status` enum incl. `lost` | Person 1 (DB schema) | Pending |
| `orders` table + state enum | Person 1 (DB schema) | Pending |
| One-paid-offer-per-listing invariant | Person 1 (DB schema) | Pending |
| Atomic transaction primitive (RPC / sproc) | Person 1 (DB schema) | Pending |
| `webhook_events` table | Person 1 (DB schema) | Pending |
| `offer_events` + `order_events` tables | Person 1 (DB schema) | Pending |
| Audit-table RLS | Person 1 + Person 4 | Pending |
| Buyer checkout entry point | Person 2 (buyer-flow) | Exists (mock-backed) |
| Seller dashboard Orders section | Person 3 (seller-flow) | Exists (mock-backed) |
| Admin payout / dispute UIs | Person 3 (admin-panel) | Exists (mock-backed) |

---

## Next Session Starts Here

Implementation is blocked on schema decisions, not on engineering
capacity. The session-zero audit
(`docs/reviews/payments-session-zero.md`) is the authoritative current
artifact. Read it in full before any further work.

Before Phase 1 can start:

1. Resolve Open Question #1 (lifecycle / `escrow_held` semantics) with
   Product + Person 1 + Person 4. Audit §9 OQ#1 records the two
   candidate target contracts; the choice is product-strategic, not
   technical.
2. Resolve OQ#2 (`lost` enum + cascade) and OQ#4 (one-paid-offer
   invariant mechanism). These are required for Phase 1 schema work.
3. Person 1 produces the Phase 1 schema PR (audit §8 Phase 1).
4. Person 4 + Person 1 sign off on the Schema Contract (audit §4).

Phase 2 (Razorpay) begins only after Phase 1 lands on `dev`. Audit
§5.9 dictates how the parked `feature/payments-shipping` files
migrate. Everything before Phase 2 is design and verification — no
new code in this feature lands on `dev`.
