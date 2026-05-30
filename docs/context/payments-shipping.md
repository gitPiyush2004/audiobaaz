
# Payments & Shipping — Context File
**Owner:** Person 4
**Active branch:** `feature/order-lifecycle-shipping` (Razorpay/shipping abstractions, dev simulator, seller shipment flow, timeline UI)
**Last updated:** 2026-05-30

---

## What This Feature Does

Owns all money movement and logistics for the marketplace. Razorpay
checkout creation, payment capture and verification, escrow accounting,
shipment creation (provider-abstracted), AWB generation, courier-event
ingestion, escrow release on dispute-window expiry, refund processing
for race losers and disputes, and admin payout controls.

This feature is the boundary between the marketplace's negotiation domain
(offers) and the marketplace's logistics + money domain (orders). It does
NOT own offer state transitions other than the single `accepted → paid`
edge that fires from a verified payment capture.

---

## Current Status

```
[ ] Not started
[x] PARTIALLY MERGED + active vertical slice in flight
    - PR #2 (commit 230d9ae): Phase 1 schema substrate on dev.
      Migrations 002–006: atomic finalize_winning_payment RPC,
      lifetime invariant on listings.sold_order_id, audit tables,
      refund lifecycle, checkout locks, invariant guards.
    - PR #3 (commit 7b294e9): Phase 2 Razorpay routes on dev.
      /api/payments/{create,verify,webhook} as thin wrappers
      around the locked RPCs.
    - feature/order-lifecycle-shipping: PaymentProvider +
      ShippingProvider abstractions, DevPaymentProvider +
      MockShippingProvider, migration 007 (shipments +
      shipment_events + mock_shipments + RPCs), seller shipment
      flow, OrderTimeline + ShipmentTracking UI, dev simulation
      routes. End-to-end lifecycle exercised today without
      Razorpay or Shiprocket credentials.
    - PR #4 (feature/checkout-razorpay-wire): SUPERSEDED.
      Code lives on the active branch as commit 5ae8cd7. Close
      without merging.
[ ] Complete (pending: admin operations + lifecycle validation
    on dev.audiobaaz.com)
[ ] Blocked
```

### Provider abstractions (current state)

The active branch lifts both external integrations behind small
interfaces so the application stack can be exercised without real
credentials:

```
src/lib/payments/
├── provider.ts    PaymentProvider interface (createOrder,
│                  verifyPaymentSignature, verifyWebhookSignature,
│                  refund, buildClientModalParams, simulatePayment?)
├── razorpay.ts    RazorpayPaymentProvider (production). Wraps the
│                  Razorpay SDK + HMAC helpers that previously lived
│                  in src/lib/razorpay/{client,helpers}.ts.
├── dev.ts         DevPaymentProvider. Returns synthetic ids signed
│                  with PAYMENT_DEV_SECRET; the existing signature-
│                  verification helper accepts them. Selected via
│                  PAYMENT_PROVIDER=dev (gated to non-prod NODE_ENV).
└── factory.ts     getPaymentProvider() — single source of selection.
                   Routes never branch on env state.

src/lib/shipping/
├── provider.ts    ShippingProvider interface (createShipment,
│                  getTracking, advanceTracking?)
├── mock.ts        MockShippingProvider. TEST-XXXX-NNN AWBs persisted
│                  in mock_shipments. Validates lifecycle transitions
│                  (created → picked_up → in_transit → out_for_delivery
│                  → delivered).
└── factory.ts     getShippingProvider() — returns mock when no
                   SHIPROCKET_EMAIL is configured. ShiprocketProvider
                   slot exists; throws on selection until built.
```

### Phase 1 schema (merged — historical reference)

The Phase 1 surface on `dev`:

- atomic RPC (`finalize_winning_payment`) — migration 002
- lifetime invariant column + UNIQUE constraint —
  `listings.sold_order_id` is the canonical anchor (migration 006);
  `listings.sold_offer_id` retained as informational metadata only
- refund lifecycle (state machine + `initiate_refund` /
  `record_refund_outcome` RPCs) — migration 003
- audit tables (`offer_events`, `order_events`, `webhook_events`) —
  migration 002
- invariant-guard triggers — migration 005 + migration 006
- `checkout_locks` table + acquire/release RPCs — migration 004
- five acceptance scenarios + multi-connection stress harness at
  concurrency=100, all green in CI

### Migration 007 — shipping substrate (on `feature/order-lifecycle-shipping`)

- `shipments` — canonical shipment record. One row per shipment
  booking. Provider-agnostic: real couriers and the mock provider
  both write here.
- `shipment_events` — audit trail of shipment state transitions.
  Mirrors `order_events` in shape.
- `mock_shipments` — backing store for the MockShippingProvider's
  synthetic tracking history. Provider-private state.
- `record_shipment_created(...)` — atomic RPC. Inserts shipment +
  event + transitions order from `escrow_held → seller_confirmed`.
  SECURITY DEFINER, service-role only.
- `record_shipment_status_change(...)` — atomic RPC. Updates
  shipment status + emits event + cascades to order-side
  transitions (`picked_up → orders.shipped` with `shipped_at`,
  `delivered → orders.delivered` with 48h `inspection_expires_at`).
  Idempotent on same-status replays.

### Next milestone — admin operations + lifecycle validation

Remaining V1 work on the active branch:

| Surface | Task |
|---------|------|
| Admin disputes | Wire dispute resolution to `initiate_refund` for buyer-favourable verdicts. |
| Admin payouts | UPI reference text input. Route writes `payout_reference`, `payout_at`, `payout_status='paid'`. |
| Admin orders monitor | Replace the stub at `src/app/admin/orders/page.tsx` with a real list/filter view surfacing stuck refunds, stuck shipments, post-inspection orders. |
| Manual escrow release | Admin button on `delivered` past inspection → flips order to `completed` + `payout_status='pending'`. |

After admin operations land, the active branch is ready to PR into
`dev`, then run lifecycle scenarios A–E on `dev.audiobaaz.com` with
`PAYMENT_PROVIDER=dev`.

### Pre-merge audit

A pre-merge technical audit lives at
`docs/reviews/order-lifecycle-shipping-audit.md`. It enumerates
schema changes, new env vars, every route added or changed,
lifecycle scenarios A–H, risk assessment, and the pre-merge
checklist. Read it before opening the PR; the lifecycle scenarios
must be exercised against `dev.audiobaaz.com` before merge.

### Lifecycle validation runbook

The execution checklist for scenarios A–H lives at
`docs/reviews/lifecycle-validation-runbook.md` — exact DB-state
assertions per transition, including pre-deploy checks, test data
setup, scenario steps, stop conditions, and post-validation
actions. Validation produces a results report at
`docs/reviews/lifecycle-validation-results.md`, which is the gate
for opening the PR.
- refund lifecycle (state machine + two RPCs)
- audit tables (`offer_events`, `order_events`, `webhook_events`)
- invariant-guard triggers (`sold_offer_id` immutable, `listings.status`
  terminal-at-`sold`)
- `checkout_locks` table + acquire/release RPCs
- five acceptance scenarios + multi-connection stress harness
- CI workflow + runbook + Supabase compatibility bootstrap

This is enough architecture for a V1 marketplace core. Every
additional migration written without an executed test run is
optimisation of an unexercised system. The freeze is in place so
the team focuses on **running the gate**, not extending it.

Exception: a verification failure that points at a real bug
(missing column, wrong constraint shape, broken RPC logic) is the
one trigger to amend a migration. All other "while we're here"
changes wait until after Phase 1 PR merges to `dev`.

After Phase 1 verification passes and merges, the **next focus is
Phase 2 application work** — wiring the existing RPCs into the
Razorpay routes per the audit's §5.9 disposition. Not more
migrations.

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
pending                               payment_pending
accepted                              payment_failed (recoverable)
paid          ─── handoff ──→         escrow_held       ← MARKETPLACE COMMITS
                                      seller_confirmed
declined                              shipped
cancelled                             delivered
expired                               inspection
lost                                  completed

Audit: offer_events                   cancelled
                                      disputed
                                      refunded
                                      partially_refunded

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
  2. An `orders` row was already created at checkout-start
     (status = payment_pending). At capture, that row transitions
     to `escrow_held` atomically with the offer's transition to
     `paid` and the listing's transition to `sold`.
  3. The order continues its lifecycle from escrow_held onward
     (seller_confirmed → shipped → delivered → inspection →
     completed, with branches per the locked V1 contract below).
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

### Order state machine — locked V1 contract (OQ#1 resolved 2026-05-30)

`escrow_held` means: **Audiobaaz has successfully captured the buyer's
payment and is holding those funds pending delivery, inspection, dispute
resolution (if any), and final settlement.**

It is *not* offer acceptance, payment initiation, payment authorization,
shipment, or delivery. It is specifically: money captured, money held,
order funded. This is the point at which the marketplace commits to a
winner — listing flips to `sold`, all competing offers cascade to
`lost`, and the seller can begin shipping.

Locked V1 lifecycle (linear happy path):

```
payment_pending → escrow_held → seller_confirmed → shipped → delivered
                                                            → inspection → completed
```

Branches off the linear path:

```
payment_pending  → payment_failed                 (capture declined; recoverable)
payment_failed   → payment_pending                (buyer retries — non-terminal)
payment_pending  → cancelled                      (buyer abandons before capture; auto-refund if any auth)
inspection       → disputed                       (buyer raises within 48h window)
disputed         → completed                      (admin resolves in seller's favour)
disputed         → refunded                       (admin resolves in buyer's favour — full refund)
disputed         → partially_refunded             (admin resolves in buyer's favour — partial refund)
```

The state-machine diagram in domain-boundaries form:

```
Offer domain                          Order domain
────────────                          ────────────
pending                               payment_pending
accepted                              payment_failed (recoverable)
paid          ─── handoff ──→         escrow_held         ← MARKETPLACE COMMITS A WINNER HERE
                                      seller_confirmed
declined                              shipped
cancelled                             delivered
expired                               inspection
lost                                  completed

Audit: offer_events                   cancelled
                                      disputed
                                      refunded
                                      partially_refunded

                                      Audit: order_events
```

The seven sub-decisions taken with OQ#1:

1. **Drop `created`.** The first order state is `payment_pending`. A
   distinction between "order row exists" and "buyer is paying" carries
   no observable meaning to buyer, seller, admin, or merchant.
2. **`payment_failed` is non-terminal recoverable.** A failed capture
   transitions `payment_pending → payment_failed`; the buyer can retry,
   transitioning back to `payment_pending`. This matches the user
   expectation "card failed, try again," not "card failed, order dead
   forever."
3. **Keep the schema's three shipping states** (`seller_confirmed →
   shipped → delivered`). Shiprocket-event granularity (`pickup_scheduled`,
   `in_transit`, `out_for_delivery`) is deferred to V2 once we have
   real Shiprocket telemetry to tell us which events to trust.
4. **Money-movement names live on `orders.status`.** `completed`,
   `refunded`, `partially_refunded` describe what happened to the money.
   Verdict (`resolved_buyer` / `resolved_seller`) lives on
   `disputes.resolution`. The two are intentionally separate because the
   verdict can produce any of the three money outcomes (e.g. a
   `resolved_buyer` outcome may be a full refund, a partial refund, or
   a future replacement).
5. **No `escrow_released` state.** Order lifecycle ends at `completed`;
   payout is tracked separately on `orders.payout_status` (`pending →
   processing → paid`). One concept, one place.
6. **Listing remains available until capture.** The listing flips
   `approved → sold` *atomically with* `escrow_held`, never at offer
   acceptance and never at order creation. Optimising for completed
   sales: the V1 risk is "buyer A reserves, disappears, listing dead"
   (kills liquidity), not "two buyers race for the same listing"
   (engineerable). The schema's `reserve_listing` trigger
   (`approved → reserved` on order INSERT) is dropped under this model.
7. **`checkout_locks` table is the only first-line race defence.** A
   short-TTL soft lock taken before issuing a Razorpay `order_id`,
   keyed on `listing_id`. Not a reservation — buyers are not blocked
   from browsing or offering. Reduces but does not eliminate the
   simultaneous-capture window; the DB invariant (Hard Prerequisite #3)
   and atomic RPC (#4) are what guarantee correctness.

### Trust boundaries — what the invariant does and does not guarantee

The locked V1 contract creates a clear separation between two systems
of record. Confusing them is the fastest way to ship a refund-handling
bug.

**Razorpay is the system of record for "did money move."** Audiobaaz
has zero authority to prevent two captures from happening at the
gateway. Two buyers can press "Pay" at the same instant; Razorpay can
process both. The DB invariant + the atomic RPC do **not** prevent
this — they cannot. They live downstream of the gateway.

**Audiobaaz is the system of record for "who owns the listing."** The
DB invariant + atomic RPC guarantee:

> Two captures may occur. Only one may win the marketplace state.
> The other is refunded automatically.

This is exactly why the race-loser refund (Hard Prerequisite #9) is a
**normal business path** under the locked V1 contract, not an
exception. Buyer-facing copy must read "another buyer completed
payment first; your refund is on the way," not "payment failed."

Anywhere code or documentation says or implies "the invariant prevents
double-charge," that is wrong. The invariant prevents double-*winning*.
The double-charge is impossible to prevent at the gateway level; we
correct it after the fact via refund.

### The lifetime invariant

The invariant must cover the entire winning-order lineage, not just
the `escrow_held` instant. Once a listing has had a winning capture,
it has been sold once for all time — no other order may ever progress
past `payment_pending` for that listing, regardless of what subsequently
happens to the winner (delivery, dispute, refund).

> **Invariant:** For any given listing, at most one row in `orders`
> may ever have `status` in
> `{escrow_held, seller_confirmed, shipped, delivered, inspection,
> completed, disputed, refunded, partially_refunded}`.
>
> The complement (`payment_pending`, `payment_failed`, `cancelled`)
> is the set of states that have not claimed the listing. Every other
> state has.

This is wider than "two `escrow_held` rows are forbidden." It covers
the case where the winner has already moved on (e.g. to `refunded`
after a buyer-favourable dispute) — the listing is still sold; no
second order may exist with any winning-lineage status.

### OQ#4 mechanism — locked

**Updated 2026-05-30 by migration 006:** ownership anchor moved from
`sold_offer_id` to `sold_order_id` after PR #2 CI surfaced that
`sold_offer_id` does not constrain direct buy-now captures (offer_id
is NULL for those, and PostgreSQL UNIQUE allows multiple NULLs).

**Current contract:**

```
listings.sold_order_id UUID UNIQUE NULL REFERENCES orders(id)
                       ← primary ownership anchor (set on every
                         winning capture, regardless of whether
                         the order was offer-backed)

listings.sold_offer_id UUID UNIQUE NULL REFERENCES offers(id)
                       ← informational metadata; populated only
                         when the order was offer-backed. Retained
                         for forensic queries ("which negotiation
                         became this sale?"); not the invariant
                         anchor.
```

Set once inside the atomic RPC at the moment of `escrow_held`.
**Both columns are immutable post-set** (migration 005 +
migration 006 each enforce immutability via BEFORE-UPDATE triggers).

The invariant maps directly onto the order-side anchor:

> "A listing can have at most one winning order." → `sold_order_id`
> is either `NULL` (listing still available) or a single UUID
> (listing sold to that order, for all time).

The original anchor (`sold_offer_id`) was an artifact of the earlier
offer-centric design. The marketplace is order-centric in V1; the
RPC takes a `payment_id`, derives the order, and writes
`sold_order_id` deterministically. Whether an offer was involved
is recorded as a label, not as the constraint.

The audit's earlier alternative (unique partial index keyed on
`offers.status = 'paid'`) was rejected because it does not cover
direct buy-now (no `paid` offer exists for those captures).
`listings.sold_order_id` covers both flows natively.

### Refunded-winner rule (immutability of `sold_offer_id`)

> If the winning order is later fully refunded — via a buyer-favourable
> dispute resolution, partial refund, or any other path — the listing
> **remains sold** and `sold_offer_id` **remains set**. The listing
> does not return to inventory; the seller does not get the listing
> back. Re-listing requires creating a new `listings` row.

Rationale: the invariant the codebase just locked is "sold once,
forever." Allowing `sold_offer_id` to clear on refund would
re-introduce the auditability problem the invariant exists to prevent
— specifically, the timeline:

```
Listing A → sold → refunded → unsold → sold again
```

would erase the original sale from listing-side state, leaving
`order_events` and `offer_events` as the only record. That is exactly
the kind of "marketplace state and audit log disagree" failure the
locked V1 contract is designed to make impossible.

This is correct for a used-audio marketplace where each physical item
is a distinct unit. If the seller still has the item and wants to
re-list it (e.g. after a buyer dispute that returned the goods), they
create a new listing. The new listing has its own `id`, its own
listing review, its own price history attribution. The old listing
stays `sold` with its `sold_offer_id` permanently set, preserving the
audit trail.

If a future feature ever requires re-marketing an unsold-after-refund
unit, that is a new product decision and a new schema migration — not
a gap in the lifetime invariant.

`escrow_held` is a distinct state from `delivered` and from
`completed`. Delivery means the courier dropped the package; the 48h
inspection window then runs. Releasing payout too eagerly on
`delivered` is a class of bug — `payout_status = 'pending'` until
`orders.status = 'completed'`.

**Returns workflow is deferred.** No `return_pickup`, `return_in_transit`,
or `return_completed` states in V1. Reverse logistics is a separate
slice that will be designed after payments and forward shipping are
live. Refunds happen via dispute resolution, not via a return flow.

### Race-loser refund flow (three layers)

Because Decision 6 means the listing stays available until capture,
two captures for the same listing are an *expected* (not
exceptional) outcome under high-traffic auctions. All three layers
below must exist:

1. **Pre-payment soft lock.** Before issuing a Razorpay `order_id`,
   take a short-TTL (~5 min) row in `checkout_locks` keyed on
   `listing_id`. This is a soft lock — it reduces the race window to
   "two near-simultaneous order_create calls" but does not block
   competing offers from existing or future buyers from initiating
   checkout once it expires.
2. **Webhook winner selection.** First valid `payment.captured` whose
   transactional cascade succeeds is the winner. The DB invariant
   (one paid offer per listing — Hard Prerequisite #3) decides; the
   handler does not pick.
3. **Automatic refund.** When the cascade fails for the second
   capture, refund the losing capture. Buyer-facing message is
   "another buyer completed payment first; your refund is on the way,"
   not "payment failed." V1 implementation: synchronous refund call
   inside the webhook handler. V2: queue-backed worker if volume
   warrants (audit OQ#7 default).

### Refund lifecycle as first-class state

A refund call to Razorpay can fail or stall (gateway downtime, bank
processing issues, network timeout). The marketplace has already
decided the loser must be refunded — that decision lives on
`payments.refund_reason` — but the money may not be back in the
buyer's account yet, and may take several retries to land. Without
an explicit refund-lifecycle state, support cannot answer "did we
actually refund this person?" and any retry logic has no first-class
home.

Refund lifecycle lives on the `payments` table (not `orders.status`),
because refund-completion is a money-movement concern, not a
marketplace-state concern. Order-side state is unaffected by refund
processing status: a buyer-favourable dispute lands the order at
`refunded` (verdict reached) regardless of whether the gateway-side
refund has finalised. This mirrors the locked V1 contract's earlier
separation of `disputes.resolution` (verdict) from `orders.status`
(money outcome).

Target schema additions to `payments`:

```
refund_id          TEXT   NULL              ← Razorpay refund id when initiated
refund_reason      TEXT   NULL              ← race_loss | dispute_buyer_favour | manual_admin
refund_status      TEXT   NULL              ← null until a refund is initiated, then:
                                            ←   'pending'    refund row created, gateway call not yet attempted
                                            ←   'processing' Razorpay refund initiated, awaiting confirmation
                                            ←   'succeeded'  Razorpay confirmed money returned to buyer
                                            ←   'failed'     Razorpay rejected or repeatedly errored
refund_initiated_at TIMESTAMPTZ NULL
refund_completed_at TIMESTAMPTZ NULL        ← set on succeeded or failed
refund_failure_reason TEXT NULL             ← Razorpay error code on failed
```

Lifecycle:

```
NULL → pending → processing → succeeded   (terminal)
                          → failed       (recoverable — admin-driven retry)
failed → processing                        (manual retry; lands back in succeeded or failed)
```

`payments.status = 'refunded'` (existing enum) is set only when
`refund_status = 'succeeded'`. The two columns answer different
questions:

- `payments.status` answers "what happened to this payment overall?"
  (one of `created`, `authorized`, `captured`, `failed`, `refunded`).
- `payments.refund_status` answers "if a refund was initiated for
  this payment, where is it?" — `null` if no refund was ever
  initiated.

Buyer-facing copy is gated on `refund_status`, not `payments.status`:

| `refund_status` | Buyer sees |
|-----------------|------------|
| `pending` / `processing` | "Another buyer completed payment first; your refund is on the way (typically 5–10 business days)." |
| `succeeded` | "Your refund has been processed. Funds will appear in your original payment method within a few business days." |
| `failed` | "We hit an issue processing your refund. Our team has been notified and will reach out within 24 hours." |

Admin retry path: a failed refund is the only `refund_status`
transition admin can drive directly. There is no admin path to
clear `refund_status` or roll it back to `null` — refund attempts
are an append-only history (one row per attempt would be ideal in
V2; V1 records on the `payments` row itself with an
`order_events` audit row per transition).

This makes "did we refund this person?" answerable from the database
alone. Combined with the Scenario D auditability assertion, every
loser refund has a status, a timestamp, a reason, and (on failure) a
recovery path.

### Atomic transaction boundary

A winning capture writes to five tables for the winner plus two tables
for every other offer on the listing:

- `offers.status` (winner: `accepted → paid`; losers: `* → lost`)
- `orders.status` (winner: `payment_pending → escrow_held`)
- `listings.status` (winner: `approved → sold` — atomic with `escrow_held`)
- `offer_events` (one row per offer transition, including loser cascades)
- `order_events` (one row for `escrow_held`)
- `webhook_events` (mark this Razorpay event id as processed)

All of these commit together or none commit. The "no winner, twelve
losers" outcome is irrecoverable without manual intervention and is
worse than a duplicate capture. Person 1 owns the transaction primitive
(`finalize_winning_payment(...)` RPC per audit §4.7). Failure modes
return a typed conflict result the webhook handler converts into the
race-loser refund.

---

## Hard Prerequisites (Blocking Implementation)

Razorpay and Shiprocket integration cannot start until all of these
exist on dev. Ownership split is intentional — schema and DB primitives
are Person 1; payment-domain workflow design is Person 4; product-shape
decisions cross-cut.

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | Offer enum lock (seven values incl. `lost`) | Product + Person 1 | Decision in this doc; migration owned by Person 1 |
| 2 | Order state machine lock (states + branches) | Product + Person 4 | **RESOLVED 2026-05-30 — see "Order state machine — locked V1 contract (OQ#1 resolved)" below.** Schema migration items: drop `seller_must_ship_by` from a Razorpay-driven assumption, drop `reserve_listing` trigger, add `cancelled` terminal, no `escrow_released` state |
| 3 | DB invariant: at-most-one winning-lineage order per listing | Person 1 | **Lifetime invariant** — at most one row in `orders` per listing may ever have `status` in `{escrow_held, seller_confirmed, shipped, delivered, inspection, completed, disputed, refunded, partially_refunded}`. **Mechanism locked: `listings.sold_offer_id UUID UNIQUE NULL REFERENCES offers(id)`**, set once inside the atomic RPC at `escrow_held`, **never unset, never updated** (refunded winners keep their `sold_offer_id`; relisting requires a new `listings` row). See "Trust boundaries", "The lifetime invariant", "OQ#4 mechanism — locked", and "Refunded-winner rule" sections above. **Phase 1 priority: 2.** |
| 4 | Atomic transaction primitive covering winner cascade | Person 1 | `finalize_winning_payment(...)` RPC per audit §4.7; commits offers / orders / listings / offer_events / order_events / webhook_events together or rolls back. Without this, a crash mid-cascade leaves the marketplace in a state with no clean recovery — split-brain state (listing sold, offer not updated; or offer won, listing not sold) is the one thing the system cannot tolerate. **Phase 1 priority: 1 (highest — Scenario B is the hardest gate).** |
| 5 | `webhook_events` table (idempotency by provider event id) | Person 1 | Shared across Razorpay, Shiprocket, future providers |
| 6 | `offer_events` table (offer-domain audit) | Person 1 | event_name, actor, from_status, to_status, timestamp |
| 7 | `order_events` table (order-domain audit) | Person 1 | Same shape as offer_events; separate so neither becomes misc_log |
| 8 | `checkout_locks` table (pre-payment soft lock) | Person 1 | Optimisation: reduces the number of races that need to be refunded. **Not** a correctness primitive — Hard Prerequisites #3 and #4 are what enforce correctness; the lock only narrows the simultaneous-capture window. Short TTL (~5 min), keyed on `listing_id`. **Phase 1 priority: 4 (lowest of the four).** |
| 9 | Refund lifecycle on `payments` (refund_status enum + columns) | Person 1 | New `payments.refund_status`, `refund_id`, `refund_reason`, `refund_initiated_at`, `refund_completed_at`, `refund_failure_reason`. Lifecycle: `pending → processing → succeeded \| failed`; `failed → processing` on retry. See "Refund lifecycle as first-class state". Without this, "did we refund this person?" is unanswerable from the database alone. **Phase 1 priority: 3.** |
| 10 | Razorpay race-loser refund design (synchronous in V1) | Person 4 | Under the locked V1 contract this is a **normal business path**, not an exception — see "Trust boundaries" above. Pre-payment lock + winner cascade + automatic refund call inside the webhook handler. Buyer-facing copy keyed on `payments.refund_status`. Implementation comes after Hard Prerequisite #9 lands. |
| 11 | RLS policies on `offer_events` and `order_events` | Person 1 + Person 4 | Losing buyer can read their own `lost` reason; cannot read winning buyer's identity |

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
| Race | Two captures for one listing | **Cannot be prevented at the gateway.** `checkout_locks` narrows the window; DB invariant + atomic RPC ensure one winner; loser is refunded synchronously |
| Atomicity | Partial winner cascade | `finalize_winning_payment(...)` RPC (Person 1 deliverable) |
| Replay | Webhook delivered twice | `webhook_events` idempotency on provider event id |
| Spoof | Webhook from non-Razorpay/Shiprocket caller | Signature/token verification before any side effect |
| RLS | Loser sees winner's identity in `offer_events` | Audit-table RLS policy denies cross-buyer reads |
| Escrow | Funds released too early (payout fires before inspection completes) | `payout_status` only flips off `pending` after `orders.status = 'completed'` |
| Refund | Captured-but-lost buyer sees "payment failed" | Synchronous race-loser refund + correct buyer messaging gated on `payments.refund_status`, not `orders.status` |
| Refund | Refund call to gateway fails or stalls | First-class `payments.refund_status` (`pending → processing → succeeded \| failed`) makes "did we refund this person?" answerable from the database alone; admin can drive `failed → processing` retry |
| Operational | Manual payout step in V1 | Admin UI surfaces only orders in `completed` with `payout_status = 'pending'` |
| Liquidity | Listing held while buyer disappears mid-checkout | Decision 6 — listing stays `approved` until capture; `checkout_locks` TTL caps the window |

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
- **OQ#1 RESOLVED 2026-05-30** — `escrow_held` means: Audiobaaz has
  successfully captured the buyer's payment and is holding those funds
  pending delivery, inspection, dispute resolution (if any), and final
  settlement. Locked V1 lifecycle: `payment_pending → escrow_held →
  seller_confirmed → shipped → delivered → inspection → completed`,
  with branches via `payment_failed` (recoverable), `cancelled`,
  `disputed → completed | refunded | partially_refunded`.
- **No `created` order state.** First state is `payment_pending`. A
  pre-capture distinction has no observable meaning.
- **`payment_failed` is non-terminal recoverable.** Buyer can retry
  payment from `payment_failed → payment_pending`.
- **Three shipping states, not Shiprocket-event granular.** Keep
  `seller_confirmed → shipped → delivered` for V1; add
  `pickup_scheduled / in_transit / out_for_delivery` only in V2 once
  Shiprocket telemetry is observed.
- **Money-movement names on `orders.status`; verdict on
  `disputes.resolution`.** `completed` / `refunded` / `partially_refunded`
  describe what happened to the money. The dispute verdict is a separate
  field because one verdict can produce different money outcomes.
- **No `escrow_released` state.** Order lifecycle ends at `completed`;
  payout tracked separately on `orders.payout_status`.
- **Listing remains available until capture.** Listing flips
  `approved → sold` atomically with `escrow_held`. The schema's
  `reserve_listing` trigger is dropped under this model. Optimising
  for completed sales over racing-prevention.
- **`checkout_locks` is the only first-line race defence.** Soft lock
  on `listing_id` before Razorpay order creation; not an inventory
  reservation. **Not** a correctness primitive — narrows the
  simultaneous-capture window only.
- **Razorpay is the system of record for "did money move." Audiobaaz
  is the system of record for "who owns the listing."** The DB
  invariant + atomic RPC do not prevent two captures from happening
  at the gateway; they prevent two winning orders from existing.
  Race-loser refund is a normal business path, not an exception.
- **Lifetime invariant.** At most one order per listing may ever have
  `status` in the winning-lineage set (`escrow_held`,
  `seller_confirmed`, `shipped`, `delivered`, `inspection`,
  `completed`, `disputed`, `refunded`, `partially_refunded`). Once a
  listing has had a winner, it is sold for all time, regardless of
  what subsequently happens to the winning order.
- **OQ#4 mechanism locked.** `listings.sold_offer_id UUID UNIQUE NULL
  REFERENCES offers(id)`. Ownership belongs on the listing, not on
  offers or orders. The unique partial index alternative was rejected
  because it does not cover the post-refund lineage on its own.
- **Refunded-winner rule (immutability).** `listings.sold_offer_id` is
  set once at `escrow_held` and never updated. A buyer-favourable
  dispute or full refund leaves both `listings.status = 'sold'` and
  `listings.sold_offer_id` intact. Relisting requires a new
  `listings` row, never a state regression on the original.
- **Listing-status terminal at `sold`** (decided 2026-05-30 during
  invariant-guard review). Once a listing is sold, it stays sold.
  Settlement (`orders.status = 'completed'`), payout
  (`orders.payout_status = 'paid'`), and price-history attribution
  (`record_price_history` trigger on `orders`, not `listings`) all
  live on the order, not the listing. The legacy `completed` value
  in the listing-status enum is preserved for migration safety but
  is no longer reachable from `sold`. This keeps inventory state
  (listing) and transaction state (order) on separate state
  machines, which was the architectural separation OQ#1 was about.
- **Refund lifecycle is first-class state on `payments`.** New
  `payments.refund_status` column (`pending → processing → succeeded |
  failed`, with `failed → processing` retry path). Refund-completion
  is a money-movement concern; `orders.status` reflects the
  marketplace verdict (e.g. `refunded` lands when admin resolves the
  dispute) regardless of where the gateway-side refund stands.
  Buyer-facing copy is gated on `refund_status`, not `orders.status`.
- **Atomicity precedes invariant in Phase 1 priority.** Split-brain
  state is the one thing the system cannot tolerate; demonstrate
  Scenario B (mid-cascade crash) before any lock-table or
  refund-optimisation work.
- Race-loser handling V1: synchronous refund call inside the webhook
  handler when the winner cascade fails the DB invariant. Queue-backed
  worker deferred to V2.
- Winner cascade is a single transaction (`finalize_winning_payment`
  RPC); partial commit is unacceptable.
- `webhook_events` is shared across providers (Razorpay, Shiprocket,
  future). `offer_events` and `order_events` are separate per domain.

---

## Dependencies On Other Features

| Needs | From | Status |
|-------|------|--------|
| `offers.status` enum incl. `lost` | Person 1 (DB schema) | Pending — Phase 1 |
| `orders.status` enum amended to locked V1 contract | Person 1 (DB schema) | Pending — Phase 1; drop `created`, add `cancelled`, drop `escrow_released`, drop `seller_confirmed` rename if applicable; drop `reserve_listing` trigger |
| One-paid-offer-per-listing invariant | Person 1 (DB schema) | Pending — Phase 1; default mechanism `listings.sold_offer_id UNIQUE NULLABLE` |
| `finalize_winning_payment(...)` RPC | Person 1 (DB schema) | Pending — Phase 1; contract per audit §4.7, updated to commit `listings.status = 'sold'` atomically with `escrow_held` |
| `webhook_events` table | Person 1 (DB schema) | Pending — Phase 1 |
| `offer_events` + `order_events` tables | Person 1 (DB schema) | Pending — Phase 1 |
| `checkout_locks` table (TTL ~5min, keyed on listing_id) | Person 1 (DB schema) | Pending — Phase 1 |
| Audit-table RLS | Person 1 + Person 4 | Pending — Phase 1 |
| Buyer checkout entry point | Person 2 (buyer-flow) | Exists (mock-backed); switches to `/api/payments/create` in Phase 2 |
| Seller dashboard Orders section | Person 3 (seller-flow) | Exists (mock-backed) |
| Admin payout / dispute UIs | Person 3 (admin-panel) | Exists (mock-backed) |

---

## Next Session Starts Here

OQ#1 was resolved on 2026-05-30 with the locked V1 contract above.
The remaining critical Open Questions before Phase 1 can start are
**OQ#4** (one-paid-offer invariant) and **OQ#5** (atomic RPC). Both
became safety-critical specifically *because* of Decision 6: the
listing stays available until capture, so race correctness lives
entirely in the DB invariant + atomic transaction, not in
application-layer reservations.

### Phase 1 priority order (recorded 2026-05-30; re-prioritised 2026-05-30)

Driving principle: **split-brain state is the one thing the system
cannot tolerate.** Atomicity precedes invariant precedes refund flow
precedes lock optimisation.

1. **OQ#5 — Atomic `finalize_winning_payment(...)` RPC.** Highest
   priority. If the RPC is wrong, the marketplace produces split-brain
   state: listing sold but offer not updated, or offer won but listing
   not sold. Person 1 should demonstrate **Scenario B** (mid-cascade
   crash → all-or-nothing) before any lock-table or refund-optimisation
   work begins. Scenario B is the hardest gate; if it passes, the
   other three become straightforward.
2. **OQ#4 — Lifetime invariant.** Second priority. Mechanism locked
   (`listings.sold_offer_id UUID UNIQUE NULL`); the work is wiring
   the constraint and proving Scenarios A, C, D pass.
3. **OQ#7 — Refund flow + refund lifecycle.** Third priority.
   Synchronous refund call inside the webhook handler under the locked
   V1 contract; gated on the new `payments.refund_status` column
   landing first (Hard Prerequisite #9). Without first-class refund
   state, "did we refund this person?" is unanswerable from the
   database.
4. **OQ#6 — `checkout_locks` table.** Fourth priority. Optimisation,
   not correctness. The system runs correctly without it if priorities
   1–3 are correct; lock failure just generates more loser refunds.

### Phase 1 schema PR scope

Person 1 produces a single PR covering:

- `orders.status` enum amendment to the locked V1 lifecycle.
- `offers.status` enum: add `lost`.
- `listings.sold_offer_id UUID UNIQUE NULL REFERENCES offers(id)` —
  OQ#4 mechanism locked. Set once inside the atomic RPC at
  `escrow_held`. Never unset, never updated.
- `finalize_winning_payment(...)` RPC.
- `webhook_events`, `offer_events`, `order_events`, `checkout_locks`
  tables.
- `payments.refund_status`, `refund_id`, `refund_reason`,
  `refund_initiated_at`, `refund_completed_at`, `refund_failure_reason`
  columns. New refund-lifecycle enum.
- Invariant guard triggers (migration 005): `sold_offer_id`
  immutability + `listings.status` no-regression. Catches any
  rogue write to listings ownership regardless of which client
  issued it. The invariant is only as strong as the weakest
  update path.
- RLS policies on the audit tables.
- Drop `reserve_listing` trigger.

### Phase 2 application-side cleanup (must precede Razorpay route revisions)

A grep audit on `feature/payments-shipping` (recorded 2026-05-30)
found four code paths that bypass `finalize_winning_payment` and
would now trigger the migration 005 invariant guards. None of these
paths exist on `dev`, but they exist on the parked branch and must
be replaced before the Razorpay routes go live:

| File | Issue | Phase 2 fix |
|------|-------|-------------|
| `src/app/api/payments/webhook/route.ts:88` | `UPDATE listings SET status='sold'` without `sold_offer_id` | Replace with `rpc('finalize_winning_payment', ...)` |
| `src/app/api/payments/webhook/route.ts:138` | On `payment.failed`: `UPDATE listings SET status='approved', reserved_at=NULL` (the resurrection path) | Remove entirely. Decision 6 dropped the reservation flow; failed payments leave the listing alone |
| `src/app/api/payments/verify/route.ts:99` | Same as webhook line 88 | Replace with the RPC |
| `src/app/api/checkout/mock/route.ts:97` | Mock checkout writes `status='sold'` without `sold_offer_id` | Delete the route; `CheckoutForm` points at `/api/payments/create` |

Phase 2 cannot ship until these four paths are removed or replaced.
Migration 005 is the safety net — it ensures any code that tries to
write the old way fails loudly with a `check_violation` rather than
silently corrupting ownership.

### Phase 1 acceptance criteria — five scenarios + stress harness

Before any application code is written against the new schema, the
Phase 1 PR must demonstrate the following at the database layer
(Postgres-level test, not application-level mock). These are the
failure modes that destroy escrow marketplaces; if the schema can
survive all of them, the marketplace core is largely de-risked.

**Must pass (acceptance gate, no merge to `dev` without all three):**

1. **All five SQL scenarios** in `supabase/tests/phase1_scenarios.sql`
   pass:
   - **A — Concurrent captures:** two simultaneous captures →
     exactly one winner, the other refunded.
   - **B — Mid-cascade crash:** RPC interrupted halfway →
     everything committed or nothing committed; never half-state.
     **Gate-of-gates.** If this fails, fix before continuing —
     atomicity bugs cannot be papered over with retries.
   - **C — Refunded winner immutability:** dispute resolved in
     buyer's favour → `listings.status` and `sold_offer_id`
     unchanged; no second order possible for that listing.
   - **D — High-concurrency race:** 10 sequential captures at the
     gateway → exactly 1 marketplace winner, 9 refunded losers, 0
     ownership corruption.
   - **E — Webhook replay:** Razorpay retries the same
     captured-payment webhook → first call wins; subsequent calls
     return `noop` with byte-for-byte identical state and zero
     duplicate audit rows. Two sub-tests: E1 (replay alone) and E2
     (replay interleaved with a second buyer's capture).
2. **Multi-connection stress** at concurrency = 100 via
   `supabase/tests/phase1_stress.sh` (pgbench harness):
   100 parallel pgbench clients each call
   `finalize_winning_payment()` for a distinct payment on the
   same listing. Marketplace state must be byte-perfect: exactly
   1 winner, 99 losers, full audit trail. Single-session SQL
   tests prove correctness against the invariant + `FOR UPDATE`
   locks; the stress harness proves they hold under true OS-level
   parallelism. *If you skip this, you do not actually know
   whether the system survives concurrent captures — you have a
   hypothesis.*
3. **Schema Contract review (audit §4)** signed off by Person 1
   and Person 4 as amended by the OQ#1 resolution.

**Auditability assertion (applies to A, D, and E):** all losers
must be discoverable and recoverable from the database alone. The
audit trail must answer "which order won, which lost, when, why
was each refunded, and what is the current refund status of each
loser" without recourse to Razorpay dashboards or application logs.

If all three gates pass, the marketplace core is considered
de-risked and Phase 2 (Razorpay integration) can proceed.

If all three gates pass, the marketplace core is considered
de-risked and Phase 2 (Razorpay integration) can proceed.

The full per-scenario narrative — exactly what each test sets up,
runs, and asserts — lives in `supabase/tests/phase1_scenarios.sql`
and `supabase/tests/README.md`. Treat those files as the source of
truth for what "passes" means; this section names the gates, the
test file proves them.

### Sequencing rules

1. ~~Resolve OQ#1 (lifecycle).~~ **Done — see "Order state machine —
   locked V1 contract" above.**
2. ~~Land Phase 1 schema substrate.~~ **In code on
   feature/payments-shipping** (commits c3ed389 / ab49e76 / e72caa4
   plus the Scenario E + stress harness follow-up + invariant
   guards + listing-status separation).
   **Not yet verified** — the acceptance scenarios have not been
   run against a live Postgres because this machine has no psql /
   supabase CLI / docker. **Code written ≠ correctness proven.**
   Verification runbook: `supabase/tests/RUNBOOK.md`. Automated
   verification on every PR touching marketplace-core SQL:
   `.github/workflows/phase1-verification.yml`.
3. Person 1 + Person 4 sign off on the Schema Contract (audit §4)
   as amended by the OQ#1 resolution.
4. Merge feature/payments-shipping → dev (schema only — Phase 2
   application work follows).
5. Wipe synthetic `payments WHERE razorpay_order_id LIKE 'mock_%'`
   rows before Phase 2 begins.
6. Phase 2 (Razorpay) revises the parked routes per audit §5.9 to
   call `finalize_winning_payment(...)`, `initiate_refund(...)`,
   `record_refund_outcome(...)`, and `acquire_checkout_lock(...)`.

### What needs verifying before the merge

- **Run the four-scenario acceptance test.** Per
  `supabase/tests/README.md`. Scenario B is the gate; if it fails,
  fix before continuing.
- **Application-side cleanup.** The parked Razorpay routes
  (`src/app/api/payments/{create,verify,webhook}/route.ts`)
  reference the dropped `reserve_listing` flow and the old
  `escrow_held`-on-capture lifecycle. Audit §5.9 already records
  these as "Revise" — that work happens in Phase 2 once the schema
  lands. The routes are NOT live on dev (no `payments/` directory
  exists there), so this is a Phase 2 todo, not a runtime regression.
- **Multi-connection concurrency check.** The four scenarios prove
  correctness in a single session against the lifetime invariant +
  `SELECT ... FOR UPDATE` locks. A pgbench-style multi-connection
  stress test (e.g. 20 concurrent calls to `finalize_winning_payment`
  for the same listing) belongs in CI and should land before Phase 2
  begins.
