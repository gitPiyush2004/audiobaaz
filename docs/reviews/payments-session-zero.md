# Payments & Shipping — Session Zero Report

**Author:** Person 4
**Branch reviewed:** `dev` @ `d11d443` (with cross-references to `origin/feature/payments-shipping` @ `f47ab10`)
**Date:** 2026-05-29
**Status:** Architecture review — no code, migrations, branches, or schema changes produced.
**Verdict:** **Partially Ready** (full justification at end of report).
**Verification (2026-05-29):** Branch state at `f47ab10` re-confirmed post-report; all nine audited files present with identical paths. Audit reflects current branch reality.

> This report is the converged source of truth between product intent
> (`docs/context/payments-shipping.md`), persistence (`supabase/schema.sql`),
> and partial implementation (`origin/feature/payments-shipping`,
> `/api/checkout/mock` on dev). It is the artifact Person 1's schema PR and
> Person 4's eventual implementation must reconcile against. Amendments to
> any of those three sources require an amendment here first.

---

## Table of Contents

1. [Executive Findings](#1-executive-findings)
2. [Repository Audit](#2-repository-audit)
3. [Consistency Audit](#3-consistency-audit)
4. [Schema Contract](#4-schema-contract)
5. [Payment Architecture Review](#5-payment-architecture-review)
6. [Shipping Architecture Review](#6-shipping-architecture-review)
7. [Risk Review](#7-risk-review)
8. [Phase Plan](#8-phase-plan)
9. [Open Questions](#9-open-questions)
10. [Final Readiness Verdict](#10-final-readiness-verdict)
11. [Report Acceptance Criteria](#11-report-acceptance-criteria)

---

## 1. Executive Findings

Five findings established by direct repository inspection. Each is the
backbone for one or more later sections. Severity reflects impact on the
ability to safely implement Razorpay and Shiprocket.

### Finding 1 — An existing payments-shipping implementation branch exists

`origin/feature/payments-shipping` (HEAD `f47ab10`) contains a complete
Razorpay + Shiprocket API layer (9 files). The branch has been merged
*from* dev recently but has not been merged *into* dev. The
`payments-shipping.md` context file previously claimed these files were
done, was corrected to "no code yet," and is now inaccurate again in
the opposite direction — code exists, just not on dev.

**Severity:** High — the audit must triage this branch file-by-file
before any new code is written, otherwise either rework or duplication
is guaranteed.

### Finding 2 — A production-applied schema exists and diverges from locked architecture decisions

`supabase/schema.sql` is fully written and applied to the live Supabase
project (`qgjpfehmporhjfkblrbj.supabase.co`, per `seller-flow.md`). It
defines 13 tables with RLS, triggers, and seed data. Several of its
shapes contradict locked decisions in `payments-shipping.md`:

- `offers.status` enum is six values; locked decision is seven (missing `lost`).
- `orders.status` enum models a different lifecycle than the locked doc.
- `offer_events`, `order_events`, `webhook_events` do not exist.
- No DB invariant prevents two `paid` offers per listing.
- No transactional primitive for the winner cascade.

The schema is not a blank slate. It is a partial implementation that
predates the locked decisions and now competes with them as a source
of truth.

**Severity:** Critical — implementing payments against the current
schema bakes the divergence in.

### Finding 3 — Several hard prerequisites described in the architecture documents are absent from the applied schema

Of the nine Hard Prerequisites in `payments-shipping.md`, six are
schema-side and not present:

- #3 — DB invariant: one paid offer per listing.
- #4 — Atomic transaction primitive for the winner cascade.
- #5 — `webhook_events` idempotency table.
- #6 — `offer_events` audit table.
- #7 — `order_events` audit table.
- #9 — RLS policies on the audit tables (depends on #6 and #7 existing first).

Items #1 (offer enum lock) and #2 (order state machine lock) require
schema amendments to satisfy.

**Severity:** Critical — the foundation Razorpay implementation depends
on does not exist yet.

### Finding 4 — The orders lifecycle implemented in schema does not match the documented escrow/dispute lifecycle

The schema treats `escrow_held` as the post-capture state (money
captured, before shipping). The locked doc treats `escrow_held` as the
post-delivery state (delivered, before dispute window expires). These
describe different products:

- Schema model: capture → escrow → ship → deliver → complete. Escrow is "money is with us, not yet released."
- Doc model: capture → ship → deliver → escrow_held (= dispute window) → escrow_released → complete. Escrow is "money has been earned, dispute window pending."

The dispute window is the entire reason escrow exists in Audiobaaz.
Collapsing it into the post-capture state erases the product's core
trust mechanism from the state machine.

**Severity:** Critical — this is the most consequential single
disagreement in the codebase. Recorded as Open Question #1.

### Finding 5 — A mock-checkout path on dev writes the same tables Razorpay would write to, and is gravitating the codebase toward the schema's lifecycle rather than the doc's

`/api/checkout/mock` (dev, since `dbe3cb7`) creates `orders` rows
directly at status `escrow_held` with synthetic payment IDs
(`mock_order_*`, `mock_pay_*`). The dev-only `/api/dev/advance-order`
flips `escrow_held → inspection` directly. The buyer-flow purchase
surface (`/buy/checkout/[listingId]`, `/orders/purchase/[orderId]`,
`/api/disputes`) is built around this lifecycle.

Each of these is an implementation shortcut to unblock buyer-flow
development without payments. None constitute a deliberate product
decision to override the locked architecture. **Decision recorded
(Option A, see §9):** mock checkout is a temporary development layer
that will be replaced by the real Razorpay flow in Phase 2.

**Severity:** High — without explicit confirmation that the mock is
transitional, accumulated buyer-flow code will harden the schema's
lifecycle into the product through inertia.

---

## 2. Repository Audit

Four inventories must be tracked separately. Conflating them is what
produced the doc drift this audit uncovered.

### Inventory A — Locked architecture (`docs/context/payments-shipping.md`)

Source: most recent product intent. Captured the seven-status offer
enum with `lost`, branched order state machine with `escrow_held` post-
delivery, atomic winner cascade, separate audit logs per domain,
three-layer race-loser refund flow, deferred returns, application-layer
escrow caveat, Shiprocket source-of-truth rule.

Status: Locked at commit `cfe497f` (2026-05-29). No code yet matches it.

### Inventory B — Applied schema (`supabase/schema.sql`)

Source: live Supabase project, applied. Owned by Person 1.

Notable shapes:
- `offers.status`: six values (`pending`, `accepted`, `declined`, `expired`, `paid`, `cancelled`). No `lost`.
- `offers.offered_price` (column name; doc uses `offer_amount`).
- `offers.seller_must_respond_by`, `offers.buyer_must_pay_by` (two timeout columns; doc uses one polymorphic `expires_at`).
- `orders.status`: eleven values (`payment_pending`, `payment_failed`, `escrow_held`, `seller_confirmed`, `shipped`, `delivered`, `inspection`, `completed`, `disputed`, `refunded`, `partially_refunded`).
- `orders.escrow_held_at`, `orders.shipped_at`, `orders.delivered_at`, `orders.inspection_expires_at`, `orders.completed_at` — timestamps tied to schema's lifecycle, not doc's.
- `payments.status`: five values (`created`, `authorized`, `captured`, `failed`, `refunded`).
- Triggers: `set_inspection_window` auto-promotes `delivered → inspection` and sets a 48h window; `reserve_listing` reserves on `payment_pending` order insert; `record_price_history` writes on `completed`.
- RLS: `read_parties` SELECT policies on offers/orders. No INSERT/UPDATE policies. No policies on `payments` or `disputes` despite RLS being enabled.
- Missing tables: `offer_events`, `order_events`, `webhook_events`.
- Missing constraints: no unique-paid-offer-per-listing.
- Missing primitives: no transactional RPC for the winner cascade.

Status: Applied to live DB. Used by seller-flow, admin-panel, buyer-flow surfaces, and mock checkout.

### Inventory C — Razorpay/Shiprocket branch (`origin/feature/payments-shipping`)

Source: 1 feature commit (`275145d`) plus 1 merge from dev (`f47ab10`).
Owned by Person 4 (technically — was authored before architecture lock).

Files (9):

```
src/lib/razorpay/client.ts                    Razorpay singleton (throws on missing keys).
src/lib/razorpay/helpers.ts                   verifyWebhookSignature, verifyPaymentSignature (HMAC-SHA256, timing-safe compare).
src/lib/shiprocket/client.ts                  Token-cached fetch wrapper, re-auth on 401, single retry.
src/lib/shiprocket/helpers.ts                 ShiprocketOrderPayload type, buildShiprocketPayload (paise → rupees here only).
src/app/api/payments/create/route.ts          Creates Razorpay order, inserts orders/payments rows, returns modal params.
src/app/api/payments/verify/route.ts          Verifies client callback signature, transitions order → escrow_held.
src/app/api/payments/webhook/route.ts         Razorpay server-to-server. payment.captured + payment.failed only.
src/app/api/shipping/create-shipment/route.ts Seller creates Shiprocket shipment for escrow_held orders.
src/app/api/shipping/track/route.ts           Read-side AWB lookup; buyer + seller only.
```

Notable behaviors:
- All routes target the schema's lifecycle, not the doc's. Order goes `payment_pending → escrow_held → seller_confirmed → shipped → inspection → completed`.
- Webhook handler treats `payment.captured` for an order already in `escrow_held` as idempotent no-op. No `webhook_events` idempotency table; idempotency is by current-state check.
- No `system_listing_sold` cascade. Other offers on the same listing remain `pending`/`accepted` after winner pays.
- No pre-payment checkout lock.
- No race-loser refund logic.
- Webhook handler uses `createAdminClient()` (correct — bypasses RLS). Verify route uses user-scoped client.

Status: Unmerged. Code is functional against the current schema; it is not aligned with the locked architecture.

### Inventory D — Buyer-flow purchase surface on dev

Source: dev commits `dbe3cb7`, `f4cefe6`, `5880796` (buyer-flow team).

Files (8):

```
src/app/api/checkout/mock/route.ts          Synthetic payment IDs, jumps order to escrow_held immediately.
src/app/api/dev/advance-order/route.ts      Dev-only escrow_held → inspection (NODE_ENV gate).
src/app/api/dev/sign-in/route.ts            Dev-only OTP bypass.
src/app/api/disputes/route.ts               Buyer raises dispute on inspection-state order.
src/app/buy/checkout/[listingId]/page.tsx   Real checkout page; calls /api/checkout/mock.
src/app/buy/checkout/[listingId]/CheckoutForm.tsx  Delivery details form.
src/app/orders/purchase/[orderId]/page.tsx  Order timeline (escrow_held → seller_confirmed → shipped → inspection → completed).
src/app/orders/purchase/[orderId]/DisputeForm.tsx  Buyer-side dispute UI.
src/app/orders/purchase/[orderId]/AdvanceOrderButton.tsx  Dev tool.
src/app/orders/purchases/page.tsx           Buyer purchases list.
src/components/layout/ProfileMenu.tsx       Profile menu with order count.
```

Status: Live on dev. Decision recorded (Option A, §9): this is a
transitional layer to be replaced by the real payment flow in Phase 2.
The buyer-flow URLs and screens stay; the routes' bodies change.

### Cross-feature surfaces that touch payments/shipping

These exist on dev today, mock-backed, awaiting real payment integration:

- `src/app/(main)/dashboard/orders/page.tsx` — seller orders view.
- `src/app/(main)/dashboard/payouts/page.tsx`, `UpiForm.tsx` — seller payout UI.
- `src/app/admin/payouts/page.tsx`, `PayoutTrigger.tsx` — admin payout trigger.
- `src/app/admin/disputes/page.tsx`, `[id]/page.tsx`, `ResolveActions.tsx` — admin dispute review.
- `src/app/admin/orders/page.tsx` — stub.
- `src/app/api/admin/payouts/[id]/trigger/route.ts` — flips `payout_status` to `paid` with a synthetic reference.
- `src/app/api/admin/disputes/[id]/resolve/route.ts` — admin dispute resolution.

These are downstream consumers. Most will need adjustment once the
order lifecycle is reconciled.

### Repository discovery commands run

```
git log --all --oneline -- supabase/ src/lib/supabase/
git branch -r --sort=-committerdate
git ls-files | grep -iE 'migration|schema|\.sql$'
git log --all --grep="schema|migration|persistence|offers table|orders table"
git log --oneline 275145d..origin/feature/payments-shipping
git diff --stat ad46ff8..origin/dev
git ls-tree -r origin/feature/payments-shipping --name-only | grep -E 'razorpay|shiprocket|payments|shipping|orders|supabase'
```

No additional in-flight schema work was found beyond the surfaces
listed above.

---

## 3. Consistency Audit

Disagreements between the four inventories. Each row records the
conflict, severity, and where it is recorded for resolution.

### 3.1 — Offer status enum

| | Value | Notes |
|---|---|---|
| Doc (A) | `pending`, `accepted`, `paid`, `declined`, `cancelled`, `expired`, `lost` | Seven values; `lost` is the marketplace-race terminal. |
| Schema (B) | `pending`, `accepted`, `declined`, `expired`, `paid`, `cancelled` | Six values; no `lost`. |
| Code `src/lib/offers/state.ts` | Same six as schema | TypeScript type matches schema. |
| Razorpay branch (C) | Touches `offers.status = 'paid'` only; never writes `lost` | No cascade for losing offers. |
| Mock checkout (D) | Does not touch `offers.status` (orders that bypass offers) | N/A. |

**Conflict:** Schema and code lack the `lost` state and the
`system_listing_sold` event. Neither half of the marketplace race
condition is implemented. **Recorded as Open Question #2.**

### 3.2 — Order status enum and lifecycle

| | Values |
|---|---|
| Doc (A) | `created`, `awb_generated`, `pickup_scheduled`, `in_transit`, `out_for_delivery`, `delivered`, `escrow_held`, `escrow_released`, `completed`, `cancelled`, `disputed`, `refunded` |
| Schema (B) | `payment_pending`, `payment_failed`, `escrow_held`, `seller_confirmed`, `shipped`, `delivered`, `inspection`, `completed`, `disputed`, `refunded`, `partially_refunded` |

**Conflicts:**
- `escrow_held` means different things in each.
- Schema has no Shiprocket-driven granularity (`awb_generated`, `pickup_scheduled`, `in_transit`, `out_for_delivery`).
- Doc has no `payment_pending`, `payment_failed`, `inspection`, `partially_refunded`.
- `escrow_released` exists in doc, not in schema.
- `cancelled` exists in doc as terminal, not in schema.

**Recorded as Open Question #1 (Critical).** Lifecycle semantics must
be chosen explicitly before any payment/shipping code is written.

### 3.3 — `escrow_held` state semantics

| | When set |
|---|---|
| Doc (A) | After delivery; represents the dispute window. |
| Schema (B) | After capture; represents money-with-platform. |
| Code | Razorpay branch (`verify` and `webhook` routes) sets `escrow_held` immediately on capture. Mock checkout sets it on order insert. Both follow the schema model. |

**Conflict:** Pervasive. Implementation, schema, and tooling are
aligned on the schema model. The doc model is unrepresented in any
code path.

**Recorded as part of Open Question #1.**

### 3.4 — `delivered → inspection` auto-promotion trigger

| | Behavior |
|---|---|
| Schema (B) | Trigger `set_inspection_window` auto-flips `delivered → inspection` and computes `inspection_expires_at = NOW() + 48h`. |
| Doc (A) | Delivery stays `delivered` (Shiprocket-owned); `escrow_held` is the dispute-window state, transitions to `escrow_released` after window. |

**Conflict:** The trigger is doing escrow-window logic on the wrong
state and inverting the doc's lifecycle. If the doc model wins, this
trigger must be dropped. If the schema model wins, the trigger stays
but the doc must be amended.

**Recorded as part of Open Question #1.**

### 3.5 — Audit/event tables

| Table | Doc (A) | Schema (B) |
|---|---|---|
| `offer_events` | Required (Hard Prerequisite #6) | Does not exist |
| `order_events` | Required (Hard Prerequisite #7) | Does not exist |
| `webhook_events` | Required (Hard Prerequisite #5) | Does not exist |

**Conflict:** None of the audit infrastructure exists. The Razorpay
branch and the mock checkout do not write any audit rows; offer/order
state transitions are unrecoverable from the data alone.

**Recorded as Open Question #3.**

### 3.6 — One-paid-offer-per-listing invariant

| | State |
|---|---|
| Doc (A) | DB-level invariant required (Hard Prerequisite #3). |
| Schema (B) | Not present. No partial unique index. No `listings.sold_offer_id` column. |
| Code | Razorpay branch listing-level guard reads `listings.status === 'approved'` before creating Razorpay order. No protection against two simultaneous captures. |

**Conflict:** The invariant the locked doc treats as the foundational
race-condition defense does not exist in any form. Application-level
checks alone are insufficient (Razorpay can capture twice).

**Recorded as Open Question #4 (Critical).**

### 3.7 — Atomic transaction primitive

| | State |
|---|---|
| Doc (A) | Required (Hard Prerequisite #4). All winner-cascade writes commit together. |
| Schema (B) | No RPC, no stored procedure, no transactional API. |
| Razorpay branch (C) | Writes are sequential, non-transactional. Partial-failure recovery is undefined. |

**Conflict:** Catastrophic-failure modes (no winner, twelve losers;
listing sold but no order created) are possible in the existing
implementation.

**Recorded as Open Question #5 (Critical).**

### 3.8 — Pre-payment checkout lock

| | State |
|---|---|
| Doc (A) | Required (race-loser flow Layer 1). Short TTL lock on `(listing_id)` before issuing Razorpay order_id. |
| Schema (B) | `reserve_listing` trigger reserves on order insert (`payment_pending` → `reserved` + 15 min window). |
| Code | Razorpay branch relies on the trigger. |

**Conflict / Partial overlap:** The schema's `reserve_listing` solves
a similar problem but at a different layer (order-insert time vs
order-create time). The doc's lock would prevent creating two Razorpay
orders for the same listing in the same 5-min window. The schema's
trigger only protects against two simultaneous order inserts after
Razorpay has already issued IDs.

The doc lock and the schema trigger can coexist. The doc lock is the
stronger guarantee.

**Recorded as Open Question #6.**

### 3.9 — Race-loser refund flow

| | State |
|---|---|
| Doc (A) | Required (race-loser flow Layer 3). When second capture's cascade fails, enqueue a refund. |
| Schema (B) | No refund job table. No queue infrastructure. |
| Razorpay branch (C) | No race-loser logic. Webhook handler returns no-op if order already in `escrow_held`. |

**Conflict:** If two captures land for the same listing today, the
second buyer's money is captured by Razorpay but their order is in
`payment_failed` (or unhandled). Manual support intervention required.

**Recorded as Open Question #7 (Critical).**

### 3.10 — Idempotency strategy

| | State |
|---|---|
| Doc (A) | `webhook_events` table; idempotency by `provider_event_id`. |
| Schema (B) | Table does not exist. |
| Razorpay branch (C) | Idempotency by current-state check (return ok if order is already `escrow_held`). |

**Conflict:** Razorpay branch's approach works for a single event type
on a single order but does not generalize. Replays of distinct events
(e.g. `payment.failed` after `payment.captured`) would still execute
side effects. Shiprocket webhook (not yet implemented) would have no
idempotency at all.

**Recorded as Open Question #8.**

### 3.11 — RLS gaps

| Table | Status |
|---|---|
| `payments` | RLS enabled, no policies → deny all (admin client only). Workable but undocumented. |
| `disputes` | RLS enabled, no policies → deny all. Buyer dispute creation goes through `createAdminClient()`. |
| `offers` | Only SELECT policy exists. INSERT and UPDATE rely on admin client. |
| `orders` | Only SELECT policy exists. Same. |

**Conflict:** The locked doc treats RLS as the boundary that gates
admin actions. Today, "use the admin client" is the de facto
authorization layer. This is functional but unauditable — there is no
DB-side record of what role performed an action.

**Recorded as Open Question #9.**

### 3.12 — Razorpay integration document is wrong

`docs/integrations/razorpay.md` lists offer statuses as:

```
PENDING, ACCEPTED, PAID, SHIPPED, DELIVERED, COMPLETED, CANCELLED, EXPIRED
```

This conflates offer and order domains (the locked doc explicitly
forbids this). It also includes states that are not in the offer
domain at all (`SHIPPED`, `DELIVERED`, `COMPLETED`).

The same document includes copy-pasted Postman-style API documentation
text starting around line 200 that appears to be unrelated chat output
accidentally committed. Cleanup required.

**Recorded as Open Question #10.**

### 3.13 — Naming inconsistencies

- `offers.offered_price` (schema) vs `offer_amount` (doc and TypeScript).
- `orders.tracking_number` (schema) vs `awb_code` (Razorpay branch helpers, internally).
- `users.upi_id` (schema) vs payout flow (doc-only "UPI for payouts").

These are minor compared to lifecycle conflicts but should be aligned
during the schema reconciliation pass.

**Recorded as Open Question #11.**

### 3.14 — Build / lint state

`next build` lint phase fails on dev (admin-panel `any` errors,
documented in ENGINEERING.md as Person 3's follow-up). Compilation passes.
This does not block the audit but is worth recording for completeness.

---

## 4. Schema Contract

The contract is recorded in two layers:

- **Current contract** — exactly what `supabase/schema.sql` defines today.
- **Target contract** — what the contract must look like after Open
  Questions are resolved. Where Open Questions affect the target, the
  decision is bracketed and tagged with the question number.

Person 1's schema PR converges to the target contract. Until the Open
Questions are resolved, the target contains marked decision points
that cannot be implemented unilaterally.

### 4.1 — `users`

**Purpose:** All marketplace participants (buyers, sellers, admins).

**Current contract:**

```
id                UUID PK DEFAULT uuid_generate_v4()
phone             TEXT UNIQUE NOT NULL              ← was made nullable per seller-flow.md; verify
email             TEXT UNIQUE
full_name         TEXT
city              TEXT
pincode           TEXT
upi_id            TEXT
telegram_chat_id  TEXT
telegram_alerts   JSONB DEFAULT { ... 8 keys ... }
role              TEXT DEFAULT 'user' CHECK (user|admin)
seller_score      INTEGER DEFAULT 100
buyer_score       INTEGER DEFAULT 100
is_active         BOOLEAN DEFAULT true
availability      TEXT DEFAULT 'active' CHECK (active|away|paused)
availability_until DATE
strike_count      INTEGER DEFAULT 0
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

**RLS:**
- `users_read_own`   — `auth.uid() = id`
- `users_update_own` — `auth.uid() = id`

**Payments/shipping uses:**
- SELECT `telegram_chat_id` for notifications.
- SELECT `upi_id` for payouts.

**Open Question impact:** None.

### 4.2 — `listings`

**Purpose:** Seller-created marketplace items.

**Current contract:** (selected fields relevant to payments/shipping)

```
id                    UUID PK
seller_id             UUID NOT NULL REFERENCES users(id)
asking_price          INTEGER NOT NULL                     ← paise
seller_payout         INTEGER GENERATED ALWAYS AS (FLOOR(asking_price * 0.9)) STORED
floor_price           INTEGER
auto_accept_threshold INTEGER
status                TEXT DEFAULT 'draft' CHECK (draft|pending|approved|reserved|sold|completed|rejected|delisted|archived)
reserved_at           TIMESTAMPTZ
reserved_until        TIMESTAMPTZ
sold_at               TIMESTAMPTZ
completed_at          TIMESTAMPTZ
```

**RLS:**
- `listings_read_approved` — anyone reads `status = 'approved'`.
- `listings_read_own` / `_insert_own` / `_update_own` — `auth.uid() = seller_id`.

**Payments/shipping uses:**
- UPDATE `status = 'reserved'` via `reserve_listing` trigger on `orders` INSERT.
- UPDATE `status = 'sold'` on capture (Razorpay branch + mock checkout).

**Target contract (deltas vs current):**

```
+ sold_offer_id        UUID REFERENCES offers(id) UNIQUE NULLABLE
                       ← satisfies Open Question #4 (one-paid-offer invariant)
                       ← alternative: UNIQUE partial index on offers WHERE status = 'paid'
                       ← decision OWNED BY Person 1 (mechanism); both satisfy the invariant
```

**Open Question impact:** #4 (invariant mechanism).

### 4.3 — `offers`

**Purpose:** Negotiation between buyer and seller; converges to `paid`
or a terminal failure.

**Current contract:**

```
id                     UUID PK
listing_id             UUID NOT NULL REFERENCES listings(id)
buyer_id               UUID NOT NULL REFERENCES users(id)
seller_id              UUID NOT NULL REFERENCES users(id)
offered_price          INTEGER NOT NULL                    ← paise; doc uses `offer_amount`
status                 TEXT DEFAULT 'pending' CHECK (
                         pending|accepted|declined|expired|paid|cancelled
                       )
seller_must_respond_by TIMESTAMPTZ
buyer_must_pay_by      TIMESTAMPTZ
created_at             TIMESTAMPTZ DEFAULT NOW()
updated_at             TIMESTAMPTZ DEFAULT NOW()

INDEX offers_listing_id, offers_buyer_id, offers_seller_id, offers_status
```

**RLS:**
- `offers_read_parties` — `auth.uid() IN (buyer_id, seller_id)`.
- No INSERT or UPDATE policy — all writes via admin client today.

**Payments/shipping uses:**
- UPDATE `status = 'paid'` on capture.
- UPDATE `status = 'lost'` for cascade losers (target only — does not exist today).

**Target contract (deltas vs current):**

```
~ status enum                add 'lost'
                             ← satisfies Open Question #2

+ INSERT policy              auth.uid() = buyer_id AND
                             EXISTS (SELECT 1 FROM listings WHERE id = NEW.listing_id AND status = 'approved')
                             ← satisfies Open Question #9

+ UPDATE policy              auth.uid() IN (buyer_id, seller_id, role='admin')
                             with column-level restrictions per role
                             ← satisfies Open Question #9

[DECISION: keep both timeout columns OR collapse to one polymorphic expires_at]
[DECISION: rename `offered_price` → `offer_amount` for consistency with doc/code, OR accept the schema name as canonical and update the doc]
[Owners: Product + Person 1, recorded as Open Question #11]
```

**Lifecycle states (target):**

| Status | Reachable from | Reachable via | Actor |
|---|---|---|---|
| `pending` | (initial) | `createOffer` | buyer |
| `accepted` | `pending` | `seller_accept` | seller |
| `paid` | `accepted` | `buyer_pay` (Razorpay capture) | webhook |
| `declined` | `pending` | `seller_decline` | seller |
| `cancelled` | `pending` | `buyer_cancel` | buyer |
| `expired` | `pending` | `system_expire_seller` (24h timeout) | system |
| `expired` | `accepted` | `system_expire_buyer` (24h timeout) | system |
| `lost` | `pending` | `system_listing_sold` (cascade) | webhook |
| `lost` | `accepted` | `system_listing_sold` (cascade) | webhook |

Every transition produces an `offer_events` audit row.

**Constraints (target):**
- Existing FKs.
- (Pending Open Question #4) Invariant guaranteeing at most one `paid` offer per listing.

**Transaction Requirements:**
- `accepted → paid` is part of the winner cascade transaction (see §4.7).
- `* → lost` (cascade losers) committed in the same transaction as the winner's `accepted → paid`.

### 4.4 — `orders`

**Purpose:** Confirmed purchase with escrow, shipping, and payout
lifecycle. Created when an offer transitions to `paid` (or, for fixed-
price purchase, directly from buyer checkout).

**Current contract:** (selected; full schema in `supabase/schema.sql`)

```
id                     UUID PK
listing_id             UUID NOT NULL
buyer_id               UUID NOT NULL
seller_id              UUID NOT NULL
offer_id               UUID NULLABLE                  ← NULL for direct (fixed-price) purchase
listing_price          INTEGER NOT NULL
paid_price             INTEGER NOT NULL
platform_fee           INTEGER NOT NULL
shipping_fee           INTEGER NOT NULL
seller_payout          INTEGER NOT NULL
delivery_*             7 columns (name, phone, line1, line2, city, pincode, state)
status                 TEXT DEFAULT 'payment_pending' CHECK (
                         payment_pending|payment_failed|escrow_held|seller_confirmed|
                         shipped|delivered|inspection|completed|disputed|refunded|
                         partially_refunded
                       )
shiprocket_order_id    TEXT
shiprocket_shipment_id TEXT
tracking_number        TEXT
courier_name           TEXT
estimated_delivery     DATE
escrow_held_at         TIMESTAMPTZ
shipped_at             TIMESTAMPTZ
delivered_at           TIMESTAMPTZ
inspection_expires_at  TIMESTAMPTZ
completed_at           TIMESTAMPTZ
seller_must_ship_by    TIMESTAMPTZ
payout_status          TEXT DEFAULT 'pending' CHECK (pending|processing|paid|failed)
payout_reference       TEXT
payout_at              TIMESTAMPTZ
```

**Triggers:**
- `set_inspection_window` — auto `delivered → inspection` + 48h window.
- `reserve_listing` — on INSERT with `payment_pending`, sets listing `→ reserved`.

**RLS:**
- `orders_read_parties` — `auth.uid() IN (buyer_id, seller_id)`.
- No INSERT or UPDATE policy.

**Target contract:** This is the section blocked by Open Question #1.

[DECISION POINT — Open Question #1, Critical]

The current schema and target doc disagree on the entire lifecycle.
This audit exposes the conflict and does not resolve it. Two
candidate target contracts:

**Candidate A — Doc model (escrow_held = dispute window).**

```
status enum: created | awb_generated | pickup_scheduled | in_transit |
             out_for_delivery | delivered | escrow_held | escrow_released |
             completed | cancelled | disputed | refunded

Implications:
- Drop `set_inspection_window` trigger (replaced by webhook-driven escrow_held).
- Rename `inspection_expires_at` → `escrow_window_expires_at` (or similar).
- Drop `payment_pending`, `payment_failed`, `seller_confirmed`, `shipped` from enum.
- Add `escrow_released` and `cancelled` as terminals.
- Razorpay branch and mock checkout both require rework.
- Buyer-flow purchase surface (timeline component) requires rework.
```

**Candidate B — Schema model (escrow_held = post-capture).**

```
status enum: payment_pending | payment_failed | escrow_held | seller_confirmed |
             shipped | delivered | inspection | completed | cancelled |
             disputed | refunded

Implications:
- Amend `payments-shipping.md` to remove `escrow_released` as a separate state.
- Amend `payments-shipping.md` so `inspection` (not `escrow_held`) represents the dispute window.
- Add `cancelled` terminal that does not exist today.
- Drop the linear Shiprocket-driven granularity (`awb_generated`, `pickup_scheduled`, etc.)
  OR add them as a parallel set of fields/timestamps without polluting status enum.
- Razorpay branch survives largely unchanged.
- Mock checkout survives unchanged.
```

**Owner of decision:** Product + Person 1 + Person 4 (joint).
**Recommended next step:** A 30-minute meeting with all three. Both
models are coherent; the choice is product-strategic, not technical.

**Constraints (both candidates):**
- FKs as today.
- Trigger `record_price_history` on `completed` continues to work in both.

**Transaction Requirements (both candidates):**
- INSERT of order is part of the winner cascade transaction (§4.7).
- Subsequent transitions are not part of a multi-table transaction.

### 4.5 — `payments`

**Purpose:** Razorpay payment record. One row per Razorpay order_id.

**Current contract:**

```
id                  UUID PK
order_id            UUID NOT NULL REFERENCES orders(id)
razorpay_order_id   TEXT UNIQUE NOT NULL
razorpay_payment_id TEXT UNIQUE
razorpay_signature  TEXT
amount              INTEGER NOT NULL                        ← paise
currency            TEXT DEFAULT 'INR'
status              TEXT DEFAULT 'created' CHECK (created|authorized|captured|failed|refunded)
method              TEXT
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
```

**RLS:** Enabled, no policies. Admin client only.

**Payments/shipping uses:**
- INSERT on `/api/payments/create`.
- UPDATE `status = 'captured'` + capture metadata on verify and webhook.
- UPDATE `status = 'failed'` on `payment.failed` webhook.
- UPDATE `status = 'refunded'` on refund completion (Phase 6).

**Mock-checkout pollution:** Today, `/api/checkout/mock` inserts rows
with `razorpay_order_id` like `mock_order_*`. These are dev artifacts,
not real Razorpay orders. Phase 1 must address whether to (a) wipe
synthetic rows before Phase 2, or (b) keep them and add a `provider`
column (`razorpay` | `mock`) so they can be distinguished.
**Recommended:** wipe before Phase 2; the synthetic IDs cannot be
reconciled with anything in Razorpay's records.

**Target contract (deltas vs current):**

```
+ refund_id            TEXT NULLABLE                       ← Razorpay refund id when status = 'refunded'
+ refund_reason        TEXT NULLABLE                       ← race_loss | dispute_buyer_favor | manual_admin
+ refunded_at          TIMESTAMPTZ NULLABLE
+ INDEX payments_order_id  ON payments(order_id)           ← currently missing

+ SELECT policy        auth.uid() IN (buyer_id, seller_id)
                       via JOIN orders o ON p.order_id = o.id
                       OR auth.role() = 'admin'
                       ← satisfies Open Question #9
```

**Open Question impact:** #7 (refund flow), #9 (RLS).

### 4.6 — `disputes`

**Purpose:** Buyer raises dispute on order in dispute window. Admin
resolves.

**Current contract:**

```
id            UUID PK
order_id      UUID NOT NULL REFERENCES orders(id)
buyer_id      UUID NOT NULL
seller_id     UUID NOT NULL
reason        TEXT NOT NULL CHECK (condition_mismatch|non_functional|
                                   missing_accessory|not_received|wrong_item)
description   TEXT NOT NULL
evidence_urls TEXT[]
status        TEXT DEFAULT 'open' CHECK (open|under_review|resolved|closed)
resolution    TEXT CHECK (full_refund|partial_refund|rejected|replacement)
refund_amount INTEGER                                       ← paise
admin_notes   TEXT
resolved_by   UUID REFERENCES users(id)
resolved_at   TIMESTAMPTZ
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW()
```

**RLS:** Enabled, no policies.

**Target contract (deltas vs current):**

```
+ SELECT policy        auth.uid() IN (buyer_id, seller_id, admin)
+ INSERT policy        auth.uid() = buyer_id AND
                       EXISTS (SELECT 1 FROM orders WHERE id = order_id AND
                               buyer_id = auth.uid() AND
                               status IN ([dispute-eligible states per OQ#1]))
+ UPDATE policy        auth.role() = 'admin' (resolution is admin-only)
                       ← satisfies Open Question #9
```

**Open Question impact:** #1 (which states are dispute-eligible
depends on lifecycle decision).

### 4.7 — Atomic transaction primitive (NEW)

**Purpose:** Wrap the winner cascade as a single atomic operation.

**Required by:** Hard Prerequisite #4. Doc-mandated.

**Required signature:**

```
finalize_winning_payment(
  p_payment_id        UUID,        -- payments.id
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT,
  p_method            TEXT
) RETURNS jsonb
```

**Operations performed atomically:**

```
1. UPDATE payments WHERE id = p_payment_id
     SET status = 'captured', razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature = p_razorpay_signature, method = p_method
   IF current status != 'created' THEN RAISE conflict (handle as idempotent in caller)

2. SELECT order_id, listing_id, offer_id, paid_price FROM payments JOIN orders ON ...

3. UPDATE orders SET status = [post-capture state per OQ#1]
   IF the listing already has another paid offer/order, RAISE conflict
     → invariant from Open Question #4 enforces this

4. UPDATE listings SET status = 'sold', sold_offer_id = p_offer_id (if OQ#4 mechanism = column)

5. IF p_offer_id IS NOT NULL:
     UPDATE offers SET status = 'paid' WHERE id = p_offer_id

6. UPDATE offers SET status = 'lost' WHERE listing_id = p_listing_id
                                          AND status IN ('pending', 'accepted')
                                          AND id != p_offer_id

7. INSERT INTO offer_events (one row per offer touched in 5+6)

8. INSERT INTO order_events (order created event)

9. INSERT INTO webhook_events (event id processed) — done in caller pre-RPC

RETURN jsonb { winner_order_id, losers_count, listing_id }
```

**Failure modes:**
- Constraint violation in #3 (another paid order exists) → return
  conflict to caller; caller queues refund.
- Anything else → transaction rollback; caller logs and returns 500
  (Razorpay will retry the webhook).

**Owner:** Person 1 (Hard Prerequisite #4). Function shape proposed
above is Person 4's contract; Person 1 implements.

**Open Question impact:** #1 (status names), #2 (`lost`), #4
(invariant), #5 (RPC existence).

### 4.8 — `offer_events` (NEW)

**Purpose:** Append-only audit log for offer state transitions.

**Required by:** Hard Prerequisite #6.

**Target contract:**

```
id            UUID PK DEFAULT uuid_generate_v4()
offer_id      UUID NOT NULL REFERENCES offers(id)
event_name    TEXT NOT NULL CHECK (event_name IN (
                'seller_accept', 'seller_decline', 'buyer_cancel',
                'buyer_pay', 'system_expire_seller', 'system_expire_buyer',
                'system_listing_sold'
              ))
actor_type    TEXT NOT NULL CHECK (actor_type IN ('buyer', 'seller', 'system', 'webhook', 'admin'))
actor_id      UUID NULLABLE REFERENCES users(id)            ← NULL for system/webhook
from_status   TEXT NOT NULL                                  ← matches offers.status enum
to_status     TEXT NOT NULL
metadata      JSONB                                          ← e.g. winning offer_id for system_listing_sold
created_at    TIMESTAMPTZ DEFAULT NOW()

INDEX offer_events_offer_id  ON offer_events(offer_id)
INDEX offer_events_event_name ON offer_events(event_name)
INDEX offer_events_created_at ON offer_events(created_at)
```

**RLS:**

```
SELECT policy: parties read own
  (auth.uid() = (SELECT buyer_id FROM offers WHERE id = offer_id))
  OR (auth.uid() = (SELECT seller_id FROM offers WHERE id = offer_id))
  OR auth.role() = 'admin'

NO INSERT policy from user roles. Inserts only from RPC (winner cascade)
or service-role context (system jobs).

NO UPDATE / DELETE — append-only.
```

**Notably:** Losing buyers see `event_name = 'system_listing_sold'`
on their own `offer_events` rows but cannot see the winning buyer's
identity (which is in a different offer's events row, gated by RLS).

**Retention:** Indefinite for V1.

**Owner:** Person 1 (Hard Prerequisite #6). Schema and RLS proposed
above is the target.

### 4.9 — `order_events` (NEW)

**Purpose:** Append-only audit log for order state transitions.

**Required by:** Hard Prerequisite #7.

**Target contract:**

```
id            UUID PK DEFAULT uuid_generate_v4()
order_id      UUID NOT NULL REFERENCES orders(id)
event_name    TEXT NOT NULL                                ← enum depends on Open Question #1 lifecycle decision
actor_type    TEXT NOT NULL CHECK (actor_type IN ('buyer', 'seller', 'system', 'webhook', 'admin'))
actor_id      UUID NULLABLE REFERENCES users(id)
from_status   TEXT NULLABLE                                 ← NULL for the initial 'created' event
to_status     TEXT NOT NULL
metadata      JSONB                                          ← e.g. shiprocket awb, dispute id, refund id
created_at    TIMESTAMPTZ DEFAULT NOW()

INDEX order_events_order_id   ON order_events(order_id)
INDEX order_events_event_name ON order_events(event_name)
INDEX order_events_created_at ON order_events(created_at)
```

**RLS:**

```
SELECT policy: parties read own
  (auth.uid() = (SELECT buyer_id  FROM orders WHERE id = order_id))
  OR (auth.uid() = (SELECT seller_id FROM orders WHERE id = order_id))
  OR auth.role() = 'admin'

NO INSERT from user roles.
NO UPDATE / DELETE.
```

**Recovery override case:** `event_name = 'admin_recovery_override'`
is the documented escape hatch (per `payments-shipping.md` Shiprocket
section). Recorded but not auto-allowed — admin uses a service-role
RPC, never a UI button.

**Retention:** Indefinite for V1.

**Owner:** Person 1 (Hard Prerequisite #7).

**Open Question impact:** #1 (event_name enum content depends on
chosen lifecycle).

### 4.10 — `webhook_events` (NEW)

**Purpose:** Idempotency and replay-safety table for inbound webhooks
from Razorpay, Shiprocket, and any future provider.

**Required by:** Hard Prerequisite #5.

**Target contract:**

```
id                   UUID PK DEFAULT uuid_generate_v4()
provider             TEXT NOT NULL CHECK (provider IN ('razorpay', 'shiprocket'))
provider_event_id    TEXT NOT NULL
event_type           TEXT NOT NULL                         ← 'payment.captured', 'payment.failed', 'tracking_update', etc.
status               TEXT NOT NULL DEFAULT 'received'
                     CHECK (status IN ('received', 'processed', 'failed', 'replayed'))
raw_payload          JSONB NOT NULL                        ← full body for forensic replay
signature_verified   BOOLEAN NOT NULL
error_message        TEXT NULLABLE                         ← populated on failure
received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
processed_at         TIMESTAMPTZ NULLABLE

UNIQUE (provider, provider_event_id)                       ← idempotency invariant
INDEX webhook_events_status ON webhook_events(status)
INDEX webhook_events_received_at ON webhook_events(received_at)
```

**RLS:** Service-role only. No user-role access.

**Idempotency strategy:**
- Webhook handler upserts on `(provider, provider_event_id)`. If row
  already exists with `status = 'processed'`, return immediately.
- If row exists with `status = 'received'` (e.g. crash mid-processing),
  proceed but log replay; mark `status = 'replayed'` if the side
  effects succeed (the underlying op should be idempotent regardless).

**Replay strategy:**
- A separate admin RPC can re-trigger processing for any
  `webhook_events.id`, useful for debugging and recovery.

**Failure recovery:**
- On handler exception, mark `status = 'failed'` and store error.
  Razorpay/Shiprocket will retry per their own schedules.

**Owner:** Person 1 (Hard Prerequisite #5).

### 4.11 — `notifications` and `listing_reviews`

These exist today and are not affected by payment/shipping decisions.
Documented here for completeness only.

**`notifications`:** Telegram message log, INSERT-only.
**`listing_reviews`:** Admin review audit, INSERT-only.

Neither requires changes.

### 4.12 — Tables explicitly NOT in scope

- `watchlist`, `saved_searches`, `ratings`, `products`, `price_history` — non-payment domain. Out of scope.
- `merchant_*` tables — V2 placeholder, not built.

---

## 5. Payment Architecture Review

Each subsection records: current state across the four inventories,
required schema/code support, risks, and recommendation. Implementation
Inventory (file-by-file disposition for the Razorpay branch) is at the
end.

### 5.1 — Razorpay order creation

**Current readiness:**
- Razorpay branch: `/api/payments/create` exists. Validates listing,
  computes fees in paise, creates Razorpay order, inserts our
  `orders` and `payments` rows.
- Schema: `payments.razorpay_order_id UNIQUE` exists; ok.
- Doc: requires pre-payment checkout lock; not implemented.

**Required schema support:**
- `payments` table (exists).
- (Pending OQ#6) Pre-payment lock mechanism — TTL row in `payments`
  with `status = 'created'` is one approximation; explicit lock table
  is cleaner.

**Risks:**
- Two buyers can simultaneously call `/api/payments/create` for the
  same listing. Both succeed at creating Razorpay orders. Both can
  pay. The DB invariant (OQ#4) is the only real defense.
- Without `webhook_events`, replay of a stale `payment.captured` event
  could re-process a captured payment. Today's idempotency-by-state
  protects single events but not retries-after-crash.

**Recommendation:** Keep the route's basic shape; restructure to call
the atomic RPC (§4.7). Add the pre-payment lock if OQ#6 chooses to.

### 5.2 — Payment authorization

**Current readiness:**
- Razorpay branch handles `payment.authorized` event implicitly (only
  `payment.captured` and `payment.failed` are explicitly handled).
  Authorize-only flow is not used.

**Recommendation:** Single-call `capture` for V1 is fine. If
authorization-then-capture flow is needed later (e.g. fraud holds),
add explicit `authorized` state handling.

### 5.3 — Payment capture

**Current readiness:**
- Two paths today: `/api/payments/verify` (client callback) and
  `/api/payments/webhook` (server-to-server). Both are idempotent vs
  each other.
- Both transition `orders.status → escrow_held` immediately, set
  `seller_must_ship_by = NOW + 48h`, mark listing `sold`, and mark
  offer `paid` if applicable.
- Neither runs in a transaction.
- Neither implements the `system_listing_sold` cascade for losing
  offers.

**Required schema support:**
- Atomic transaction primitive (§4.7) — Hard Prerequisite #4.
- One-paid-offer-per-listing invariant — Hard Prerequisite #3.
- `offer_events` for the cascade audit — Hard Prerequisite #6.

**Risks:**
- Without atomicity: partial winner cascade. (Critical, OQ#5.)
- Without invariant: two paid offers possible. (Critical, OQ#4.)
- Without cascade: losing offers stay in `pending`/`accepted` forever.
  (High, OQ#2.)

**Recommendation:** Capture handler becomes a thin wrapper around
`finalize_winning_payment(...)` RPC (§4.7). The RPC owns all DB writes;
the handler owns Telegram notifications and refund queueing.

### 5.4 — Escrow handling

**Current readiness:** This is the core of Open Question #1. Cannot
review in isolation — depends on lifecycle decision.

**Both candidates:**
- (Doc) Escrow held = post-delivery dispute window. Release after
  window expires or admin resolves dispute.
- (Schema) Escrow held = post-capture, throughout shipping. Inspection
  window post-delivery.

**Risks (lifecycle-independent):**
- Premature release (any path that flips status before the window
  finishes). Schema's `set_inspection_window` trigger automates one
  transition; the others are manual today.
- Admin override of timing without audit. (`order_events` resolves.)

**Recommendation:** Block escrow handling implementation until OQ#1
resolves.

### 5.5 — Refund handling

**Current readiness:**
- `payments.status = 'refunded'` exists in enum.
- No code path produces a refund today.
- Razorpay branch `payment.failed` handler updates `payments.status =
  'failed'` and listing back to `approved`. Does not call Razorpay's
  refund API (no money was captured for a `failed` event).

**Required schema support:**
- `payments.refund_id`, `refund_reason`, `refunded_at` columns (target).
- Refund job table or queue (TBD — see Phase Plan).

**Risks (Critical — OQ#7):**
- Race-loser refund flow does not exist. If two captures land, the
  second buyer's money is captured but their order is in
  `payment_failed`. Manual support intervention required.
- Dispute-resolved-buyer-favor refund flow does not exist. Admin
  panel `resolve_dispute` route flips status but does not initiate
  refund.

**Recommendation:** Build refund infrastructure in Phase 6 alongside
the race-loser flow. Both share the same `initiate_refund(payment_id,
reason)` primitive.

### 5.6 — Settlement handling

**Current readiness:**
- V1 is manual UPI per `payments-shipping.md`. Admin panel route
  `/api/admin/payouts/[id]/trigger` flips `payout_status` to `paid`
  with synthetic reference ID. Razorpay is not contacted.
- Doc explicitly defers Razorpay Route / Razorpay Payouts to V2.

**Required schema support:** `orders.payout_status`,
`orders.payout_reference`, `orders.payout_at` exist (in current schema).

**Risks (Operational, Medium):**
- Synthetic reference IDs make reconciliation against bank statements
  harder. Recommend: admin enters real bank/UPI reference at
  trigger time (single text field).
- No double-trigger guard at DB level (admin route uses application-
  layer `payout_status = 'processing'` flag). Acceptable for V1.

**Recommendation:** Tighten the admin trigger flow in Phase 6 (real
reference, audit row in `order_events`). Defer Razorpay Payouts API
to V2.

### 5.7 — Failure handling

**Current readiness:**
- `payment.failed` webhook handled (Razorpay branch).
- Network errors creating Razorpay order are caught and returned to
  the client.
- Crash mid-cascade is undefined behavior (no transaction; partial
  state likely).

**Risks:**
- Mid-cascade crashes leave inconsistent state (Critical, OQ#5).
- No dead-letter handling for failed webhooks (Medium, OQ#8).

**Recommendation:** Atomicity (§4.7) addresses crashes. `webhook_events.status = 'failed'` (§4.10) creates the dead-letter store.

### 5.8 — Reconciliation

**Current readiness:**
- No reconciliation tooling exists.
- Razorpay dashboard data and our `payments` table cannot be reconciled
  programmatically today.

**Required:**
- Periodic job comparing Razorpay's payment list against our
  `payments` table. V2 concern; V1 is manual via dashboard.

**Recommendation:** Out of scope for Phase 2. Re-evaluate before V1
launch — at minimum, document a manual reconciliation runbook.

### 5.9 — Implementation Inventory: `origin/feature/payments-shipping`

File-by-file disposition against the locked architecture. Each row
records alignment, the gap, and the disposition decision.

| File | Alignment | Gap from locked architecture | Disposition |
|---|---|---|---|
| `src/lib/razorpay/client.ts` | Aligns | None (singleton, throws on missing keys; matches doc requirement). | **Keep.** |
| `src/lib/razorpay/helpers.ts` | Aligns | `verifyWebhookSignature` and `verifyPaymentSignature` are correct HMAC implementations with timing-safe compare. Match the locked rule "verify signature before any side effect." | **Keep.** |
| `src/lib/shiprocket/client.ts` | Aligns | Token-cached fetch wrapper, re-auth on 401, single retry. Matches doc's "token cached at module level" rule. | **Keep.** |
| `src/lib/shiprocket/helpers.ts` | Aligns | `buildShiprocketPayload` is the single paise→rupees conversion site. Matches doc's "Shiprocket API uses RUPEES; conversion happens only in `buildShiprocketPayload`." Type definitions are clean. | **Keep.** |
| `src/app/api/payments/create/route.ts` | Partially aligns | Validates listing approved; computes fees in paise; creates Razorpay order; inserts orders+payments rows. Missing: pre-payment checkout lock; offer-status validation (does not check that offer is `accepted`); no `idempotency-key` on Razorpay order creation. | **Revise.** Restructure to take a checkout lock; add offer-status check; replace direct INSERTs with RPC call once Phase 1 lands the RPC. |
| `src/app/api/payments/verify/route.ts` | Partially aligns | Verifies signature correctly; idempotency by current-state check. Missing: `webhook_events` write; `system_listing_sold` cascade; no transaction; no race-loser handling. | **Revise.** Make this a thin wrapper around `finalize_winning_payment` RPC. |
| `src/app/api/payments/webhook/route.ts` | Partially aligns | Verifies webhook signature; uses admin client (correct). Missing: `webhook_events` idempotency; `system_listing_sold` cascade; no transaction; race-loser refund queueing absent. Handles `payment.captured` and `payment.failed` only — `refund.processed` not handled. | **Revise.** Same RPC restructure as verify. Add `webhook_events` upsert at top. Add refund event handling. |
| `src/app/api/shipping/create-shipment/route.ts` | Partially aligns | Seller-only check; idempotency on `shiprocket_order_id`; calls `buildShiprocketPayload` and Shiprocket API; updates order with shipment IDs. Sets `status = 'seller_confirmed'` — depends on lifecycle decision (OQ#1). Sends Telegram notification. Missing: `order_events` audit row; status name may need to change post-OQ#1. | **Revise.** Status name update post-OQ#1; add `order_events` insert. Otherwise keep. |
| `src/app/api/shipping/track/route.ts` | Aligns | Buyer/seller-only; calls Shiprocket; returns minimal projection. No side effects. Read-only. | **Keep.** |

**Net disposition:** 5 files keep as-is, 4 files revise. No file
requires full rewrite. The Razorpay branch is **higher quality than the
audit initially expected**; its main gaps are downstream of the missing
RPC, the missing audit tables, and the unresolved lifecycle decision —
not its own implementation.

**However:** the branch wrote against the schema's lifecycle
(`escrow_held` immediately on capture). If OQ#1 chooses Candidate A
(doc model), the verify and webhook routes need more substantial rework
(transition to `created` instead of `escrow_held`, defer escrow to
post-delivery). This is a real fork dependent on OQ#1.

### 5.10 — Atomic transaction requirements

Recorded in §4.7. All payment mutations in the winner cascade run
inside `finalize_winning_payment(...)`.

### 5.11 — Idempotency requirements

- Every webhook handler upserts `webhook_events` first thing.
- Every state transition is checked before mutation (current pattern,
  retain).
- Verify and webhook routes share the same RPC, so racing them produces
  one cascade execution.

### 5.12 — Audit requirements

- Every `offers.status` change → `offer_events` row.
- Every `orders.status` change → `order_events` row.
- Every webhook → `webhook_events` row.
- Every refund → `payments` UPDATE + `order_events` row.

---

## 6. Shipping Architecture Review

### 6.1 — Shiprocket integration readiness

**Current readiness:**
- `src/lib/shiprocket/client.ts` (token-cached fetch).
- `src/lib/shiprocket/helpers.ts` (payload builder, types).
- `/api/shipping/create-shipment` (seller-initiated).
- `/api/shipping/track` (read-side).
- No Shiprocket webhook handler yet (`POST /api/shipping/webhook` is in
  the planned files list but does not exist).

**Missing prerequisites:**
- `webhook_events` table for inbound idempotency.
- Order state machine to receive Shiprocket-driven transitions
  (depends on OQ#1).
- `order_events` for audit.
- `SHIPROCKET_WEBHOOK_TOKEN` env var (added in `.env.example` already
  but no consumer code).

**Risks:**
- Shiprocket retries on 5xx. Without idempotency, retries can produce
  duplicate state changes. (High, OQ#8.)
- No verification step on inbound webhook (no consumer code yet —
  will need to verify the shared token).

**Recommendation:** Defer until Phase 3. All prerequisites are upstream.

### 6.2 — Shipment creation timing

Two candidate triggers, depends on OQ#1:

- **(Doc model)** Seller creates shipment after order is `paid`. Order
  transitions `created → awb_generated`.
- **(Schema model)** Seller creates shipment after order is
  `escrow_held`. Order transitions `escrow_held → seller_confirmed`.

Razorpay branch's create-shipment route currently follows schema model.

### 6.3 — AWB generation, pickup, tracking

Owned by Shiprocket; we do not generate AWB. We receive
`shiprocket_order_id`, `shiprocket_shipment_id`, `awb_code` (=
`tracking_number`), and `courier_name` from the create-shipment
response.

Tracking sync today is pull-only (`/api/shipping/track`). Push
(webhook-driven) does not exist.

### 6.4 — Delivery confirmation

**Current readiness:**
- Schema trigger `set_inspection_window` flips `delivered → inspection`
  on UPDATE. Today this is fired manually (dev tool) or hypothetically
  by a future Shiprocket webhook.
- No Shiprocket webhook handler exists.

**Risks:**
- Admin can flip status manually (no Shiprocket webhook yet) — doc
  rule "Manual admin actions MUST NOT directly set these states" is
  unenforced. (Medium, OQ#10.)

### 6.5 — Return handling

Out of scope per locked decision (returns deferred to V2).

### 6.6 — Cancellation handling

Two cases:
- Pre-AWB cancel: order → `cancelled` → refund.
- Post-AWB cancel: complex; likely admin intervention. Out of scope
  for V1.

Today neither path exists. Schema does not have a `cancelled` state
in its enum (only `disputed`, `refunded`, `partially_refunded`).

**Recommendation:** Add `cancelled` to order enum as part of the
lifecycle reconciliation (OQ#1).

### 6.7 — Required order states (target)

Depends on OQ#1. See §4.4 candidates.

### 6.8 — Required event tracking (Shiprocket → Audiobaaz)

- AWB assigned (informational; sets `tracking_number`).
- Pickup scheduled.
- Picked up.
- In transit.
- Out for delivery.
- Delivered.
- RTO (return-to-origin; cancellation analogue).
- Lost / damaged.

Each writes to `order_events` and (for state-changing events)
`orders.status`.

### 6.9 — Required webhook support

`POST /api/shipping/webhook`:
- Verify `SHIPROCKET_WEBHOOK_TOKEN` shared secret.
- Upsert `webhook_events` row.
- Map Shiprocket event → order state transition.
- Insert `order_events` row.
- Update `orders.status`.
- Notify buyer/seller via Telegram if user-visible event.

---

## 7. Risk Review

### High Risk — financial/data integrity issues

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| H1 | Two captures for one listing → double payment from buyers | Direct money loss; manual refund effort; reputation | High (no DB invariant exists) | OQ#4 + OQ#7. DB invariant + race-loser refund flow. |
| H2 | Partial winner cascade → orphan listing or duplicate state | Hard-to-recover state; manual ops; data corruption | Medium (any crash mid-handler) | OQ#5. Atomic RPC. |
| H3 | Loser offers stuck in `accepted` forever | Buyer believes offer is live; supports complaints | Certain (no cascade implemented) | OQ#2. `system_listing_sold` cascade. |
| H4 | Webhook replay re-processes captured payment | Possible double-write to listings/orders | Medium (Razorpay does retry) | OQ#8. `webhook_events` table. |
| H5 | Wrong escrow timing → premature payout | Seller paid before dispute window passes; potential fraud | Critical (depends on OQ#1) | OQ#1. Lifecycle decision. |
| H6 | Mock-checkout pollution in `payments` table | Phase 2 deployment cannot tell real from synthetic IDs | Certain (already happening on dev) | Phase 1 cleanup before Phase 2 begins. Wipe `payments WHERE razorpay_order_id LIKE 'mock_%'`. |

### Medium Risk — maintenance / operational

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| M1 | RLS bypassed via admin client everywhere | Authorization is undocumented; hard to audit | Certain (current pattern) | OQ#9. Audit-table-grade RLS policies. |
| M2 | Manual admin override of Shiprocket states | Audit trail breaks; reconciliation fails | Medium (no enforcement today) | OQ#10. Document recovery RPC; remove direct status flip from admin UIs. |
| M3 | Synthetic payout reference IDs | Bank reconciliation manual | High (current pattern) | Admin UI captures real reference at trigger time. |
| M4 | No `webhook_events` retention/cleanup policy | Table grows unbounded | Long-term | Phase 6: archival policy after 1y. |
| M5 | Razorpay integration doc is stale and partly polluted | New contributors confused | Certain (verified in this audit) | OQ#11 cleanup. |

### Low Risk — defer-able

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| L1 | No automated reconciliation against Razorpay dashboard | Manual reconciliation effort | Medium | Manual runbook for V1; automation V2. |
| L2 | Shipping fee fixed at ₹150 | Possible margin compression on heavy items | Medium | Dynamic Shiprocket quotes V2. |
| L3 | Default shipment dimensions hardcoded | Edge cases (large gear) overcharged at courier handover | Medium | Per-item dims V2. |

### Risks specific to mock-checkout transition

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| T1 | Mock checkout's `escrow_held`-on-create lifecycle hardens via accumulated buyer-flow code | Doc lifecycle becomes unrecoverable | Increasing over time | Phase 1 lifecycle decision (OQ#1) before more buyer-flow lands. |
| T2 | Buyer-flow timeline component (`STATUS_ORDER` array in order detail page) hardcodes the schema's lifecycle | UI changes when OQ#1 resolves | Certain | Coordinate with Person 2 during Phase 1 decision. |
| T3 | `/api/dev/*` routes accidentally reachable in production | Auth bypass + state manipulation | Low (NODE_ENV gate exists) | Verify gates remain on every env config audit. |

---

## 8. Phase Plan

Phases are dependency-ordered. Each phase has expected files, expected
APIs, expected database changes, dependencies, and open questions
that must be closed before the phase can start.

### Phase 1 — Persistence & contract reconciliation

**Goal:** Resolve all Critical Open Questions; converge schema, doc,
and existing code on a single contract; land the missing audit
infrastructure.

**Owner:** Person 1 (schema work) + Person 4 (RPC contract review,
audit-RLS review) + Product (lifecycle decision).

**Open Questions to close before this phase:**
- OQ#1 (lifecycle) — required.
- OQ#2 (`lost` enum) — required.
- OQ#4 (invariant mechanism) — required.

**Schema changes:**
- Amend `offers.status` enum: add `lost`.
- Amend `orders.status` enum: per OQ#1 outcome.
- Add `offer_events` table (per §4.8).
- Add `order_events` table (per §4.9).
- Add `webhook_events` table (per §4.10).
- Add unique-paid-offer-per-listing invariant (mechanism per OQ#4).
- Add `payments.refund_id`, `refund_reason`, `refunded_at`.
- Add RLS policies on `offer_events`, `order_events`,
  `payments`, `disputes`, `offers` (INSERT/UPDATE), `orders` (INSERT/UPDATE).
- Drop or refactor `set_inspection_window` trigger per OQ#1.

**RPC:**
- `finalize_winning_payment(...)` (per §4.7).
- `initiate_refund(payment_id, reason)` (Phase 6 dependency, but contract recorded here).

**Files expected:** None outside `supabase/`.

**APIs expected:** None new. Existing routes' bodies will be rewritten in Phase 2.

**Dependencies:** Open Questions only.

**Cleanup:**
- Wipe synthetic `payments WHERE razorpay_order_id LIKE 'mock_%'` rows
  (after notifying buyer-flow team that mock checkout will switch over).
- Remove or update Razorpay integration doc (§3.12 / OQ#11).

**Exit criterion:** Schema Contract (this document, §4) is reviewed
and accepted by Person 1, Person 4, and Product. All Critical OQs
closed. Schema PR merged to dev.

### Phase 2 — Razorpay integration (real)

**Goal:** Replace `/api/checkout/mock` with the real payment flow.

**Owner:** Person 4.

**Open Questions to close before this phase:**
- OQ#1 (closed in Phase 1).
- OQ#2 (closed in Phase 1).
- OQ#4 (closed in Phase 1).
- OQ#6 (pre-payment lock mechanism) — required.

**Files expected:**
- `src/lib/razorpay/client.ts` — keep as-is (from branch).
- `src/lib/razorpay/helpers.ts` — keep as-is (from branch).
- `src/lib/razorpay/checkout-lock.ts` — new (OQ#6).
- `src/app/api/payments/create/route.ts` — revise (from branch); add lock acquisition; offer-status check.
- `src/app/api/payments/verify/route.ts` — revise (from branch); call `finalize_winning_payment` RPC.
- `src/app/api/payments/webhook/route.ts` — revise (from branch); add `webhook_events` upsert; call same RPC; handle `refund.processed`.

**APIs expected:**
- `POST /api/payments/create` (revised).
- `POST /api/payments/verify` (revised).
- `POST /api/payments/webhook` (revised).

**Database changes:** None (Phase 1 already applied).

**Dependencies:**
- Phase 1 complete.
- `RAZORPAY_*` env vars configured.
- Razorpay test keys provisioned.

**Migration of mock checkout:**
- `/api/checkout/mock` is removed from production deploy. Buyer-flow
  team's `CheckoutForm.tsx` switches its `fetch` URL to
  `/api/payments/create`. Order detail timeline component
  (`STATUS_ORDER`) updates to match Phase 1 lifecycle.
- Coordinate with Person 2 in same week.

**Exit criterion:** Real buyer can complete a Razorpay test-mode
purchase end-to-end. Loser cascade works. Race-loser refund queued.
`offer_events` and `order_events` rows exist for every state change.

### Phase 3 — Shiprocket integration

**Goal:** Real shipment creation and AWB generation; tracking sync.

**Owner:** Person 4.

**Open Questions to close before this phase:**
- OQ#1 (closed). OQ#10 (Shiprocket admin override boundary) — required.

**Files expected:**
- `src/lib/shiprocket/client.ts` — keep as-is (from branch).
- `src/lib/shiprocket/helpers.ts` — keep as-is (from branch).
- `src/app/api/shipping/create-shipment/route.ts` — revise (from branch); add `order_events`; status names per OQ#1.
- `src/app/api/shipping/track/route.ts` — keep as-is (from branch).

**APIs expected:**
- `POST /api/shipping/create-shipment` (revised).
- `GET /api/shipping/track` (kept).

**Database changes:** None.

**Dependencies:**
- Phase 2 complete (orders exist with real payments).
- `SHIPROCKET_*` env vars configured.
- Shiprocket pickup location label configured.

**Exit criterion:** Seller can create a real shipment from a paid
order. Shiprocket order_id, shipment_id, AWB persisted. Buyer can
track via the API.

### Phase 4 — Webhook processing (Shiprocket)

**Goal:** Inbound courier-event ingestion drives order state machine.

**Owner:** Person 4.

**Open Questions to close before this phase:**
- OQ#8 (idempotency strategy for Shiprocket) — depends on Phase 1's `webhook_events` table.

**Files expected:**
- `src/app/api/shipping/webhook/route.ts` — new.
- `src/lib/shiprocket/event-mapping.ts` — new (Shiprocket event → our state).

**APIs expected:**
- `POST /api/shipping/webhook` (new).

**Database changes:** None.

**Dependencies:**
- Phase 1 complete (`webhook_events`, `order_events` exist).
- Phase 3 complete (real shipments exist to receive events for).
- `SHIPROCKET_WEBHOOK_TOKEN` configured.

**Exit criterion:** Courier scan events drive `orders.status` changes
end-to-end. `order_events` row per courier event. Telegram
notifications fire on user-visible events.

### Phase 5 — Escrow release flow

**Goal:** Time-gated release after dispute window expires; admin
release-now path.

**Owner:** Person 4 + Person 3 (admin UI).

**Open Questions to close before this phase:**
- OQ#1 must already be closed (defines window semantics).

**Files expected:**
- `src/lib/orders/escrow.ts` — new (`releaseEscrow(order_id, actor)`).
- A scheduled job or cron equivalent (TBD — Supabase has `pg_cron`; or a simple Edge Function on a timer; or external).
- `src/app/api/admin/orders/[id]/release-payout/route.ts` — new (admin override).

**APIs expected:**
- Admin `POST /api/admin/orders/[id]/release-payout` (new).
- Cron-triggered automatic release.

**Database changes:** None (status enum already covers it from Phase 1).

**Dependencies:**
- Phases 2, 3 complete.
- Cron mechanism chosen.

**Exit criterion:** Order automatically transitions from escrow state
to release state after the configured window. Admin can release early.
Both paths produce `order_events` rows with the correct actor.

### Phase 6 — Refunds, race-loser flow, and admin payout controls

**Goal:** Complete the money-out paths.

**Owner:** Person 4 + Person 3.

**Open Questions to close before this phase:**
- OQ#7 (refund mechanism) — required.

**Files expected:**
- `src/lib/razorpay/refund.ts` — new (race-loser refund job).
- `src/app/api/admin/payouts/[id]/trigger/route.ts` — revise (real reference, audit row).
- `src/app/api/admin/disputes/[id]/resolve/route.ts` — revise (initiate refund on buyer-favor outcomes).

**APIs expected:**
- All listed above.

**Database changes:**
- (Pending OQ#7) Possibly a `refund_jobs` table if queue is chosen.

**Dependencies:**
- Phase 2 complete.
- Phase 5 complete.

**Exit criterion:** Race-loser refund flow executes end-to-end. Admin
dispute resolution refunds work. All refunds produce `payments` UPDATE
+ `order_events` row.

### Phase Plan summary

| Phase | What lands | Who | Blocks until |
|---|---|---|---|
| 1 | Schema reconciled, audit tables, RPC | Person 1 + Person 4 + Product | OQ #1, #2, #4 closed |
| 2 | Razorpay integration | Person 4 | Phase 1 |
| 3 | Shiprocket creation/tracking | Person 4 | Phase 2 |
| 4 | Shiprocket webhook | Person 4 | Phase 3 |
| 5 | Escrow release | Person 4 + Person 3 | Phases 2, 3 |
| 6 | Refunds & payout controls | Person 4 + Person 3 | Phases 2, 5 |

---

## 9. Open Questions

Each Open Question records the conflict, recommended resolution path,
named owner, severity, and current status. Person 4 does not resolve
these unilaterally — that is explicitly outside the audit's scope. The
recommended resolution is the most defensible default, not a decision.

### Open Question #1 — Order lifecycle / escrow_held semantics

**Conflict:**
- Doc (`payments-shipping.md`): `escrow_held` represents the post-delivery dispute window.
- Schema (`supabase/schema.sql`): `escrow_held` represents post-capture money-with-platform.
- Code (Razorpay branch + mock checkout + buyer-flow timeline component): aligned with schema.

**Severity:** Critical.
**Status:** **RESOLVED 2026-05-30 — Candidate B (schema model)** with
six product sub-decisions. Locked V1 contract recorded in
`docs/context/payments-shipping.md` under "Order state machine —
locked V1 contract (OQ#1 resolved)". Summary:

> `escrow_held` means: Audiobaaz has successfully captured the buyer's
> payment and is holding those funds pending delivery, inspection,
> dispute resolution (if any), and final settlement.

Locked V1 lifecycle:
```
payment_pending → escrow_held → seller_confirmed → shipped → delivered
                                                            → inspection → completed
```

Branches: `payment_failed` (recoverable), `cancelled`, `disputed →
completed | refunded | partially_refunded`.

Sub-decisions (full reasoning in `payments-shipping.md`):
1. Drop `created` — first state is `payment_pending`.
2. `payment_failed` is non-terminal recoverable.
3. Keep schema's three shipping states (`seller_confirmed → shipped →
   delivered`); Shiprocket-event granularity deferred to V2.
4. Money-movement names on `orders.status`; verdict on
   `disputes.resolution`.
5. No `escrow_released` state; payout tracked on
   `orders.payout_status`.
6. Listing remains `approved` until capture; flips to `sold`
   atomically with `escrow_held`. Drop `reserve_listing` trigger.
7. `checkout_locks` table is the only first-line race defence
   (promoted from "nice-to-have" to required).

**Owner:** Product + Person 1 + Person 4 (joint).

This resolution promotes OQ#4 (one-paid-offer invariant) and OQ#5
(atomic RPC) to safety-critical specifically *because* of Decision 6:
race correctness now lives entirely in the DB invariant + atomic
transaction, not in application-layer reservations.

§4.4 of this audit ("Candidate B — Schema model") becomes the target
contract, amended such that `listings.status` flips `approved → sold`
atomically with `escrow_held` (was: at order creation under the
`reserve_listing` trigger).

### Open Question #2 — `lost` enum and `system_listing_sold` cascade

**Conflict:**
- Doc: seven-status offer enum with `lost`; new event `system_listing_sold`.
- Schema and code: six statuses; no `lost`, no cascade, no `system_listing_sold` event.

**Severity:** High.
**Status:** UNRESOLVED — locked in doc but not implemented.
**Owner:** Person 1 (schema migration) + Person 4 (cascade logic).

**Recommended resolution:** Implement as locked in doc. Add `lost` to
`offers.status` enum in Phase 1; build cascade in Phase 2. No
product disagreement expected; this is execution.

### Open Question #3 — Audit/event tables existence

**Conflict:**
- Doc: requires `offer_events`, `order_events`, `webhook_events`.
- Schema: none of the three exist.

**Severity:** Critical.
**Status:** UNRESOLVED — locked in doc but not implemented.
**Owner:** Person 1.

**Recommended resolution:** Add per §4.8, §4.9, §4.10 in Phase 1.

### Open Question #4 — One-paid-offer-per-listing invariant mechanism

**Conflict:**
- Doc: requires DB-level invariant.
- Schema: not present.
- Implementation: relies on application-layer state checks only.

**Severity:** Critical.
**Status:** UNRESOLVED — locked as required, mechanism not chosen.
**Owner:** Person 1.

**Recommended resolution:** Choose between:
1. Unique partial index on `offers WHERE status = 'paid'` keyed on `listing_id`.
2. `listings.sold_offer_id UUID UNIQUE NULLABLE REFERENCES offers(id)`.

Both satisfy the invariant. Option 2 is slightly easier to query
("what was the winning offer for this listing?") at the cost of one
column. Option 1 is more idiomatic Postgres. Recommendation: **Option 2**
unless Person 1 has a strong preference otherwise.

### Open Question #5 — Atomic transaction primitive

**Conflict:**
- Doc: requires the winner cascade to be atomic.
- Schema: no RPC, no transaction primitive.
- Implementation: writes are sequential in handler.

**Severity:** Critical.
**Status:** UNRESOLVED — locked as required, not implemented.
**Owner:** Person 1 (RPC implementation) + Person 4 (RPC contract review).

**Recommended resolution:** Implement `finalize_winning_payment(...)`
RPC per §4.7. Phase 1.

### Open Question #6 — Pre-payment checkout lock mechanism

**Conflict:**
- Doc: requires Layer-1 pre-payment guard with TTL ~5 min.
- Schema: `reserve_listing` trigger reserves on order INSERT (different layer).
- Implementation: relies on the trigger.

**Severity:** Medium.
**Status:** UNRESOLVED — locked as required, mechanism not chosen.
**Owner:** Person 4.

**Recommended resolution:** Two acceptable mechanisms:
1. New `checkout_locks` table with TTL.
2. Reuse `payments` row with `status = 'created'` as the lock (delete
   on TTL expiry).

Option 1 is cleaner; Option 2 is parsimonious. Recommendation: **Option 1**
because checkout-creation should be possible without committing to a
Razorpay order.

### Open Question #7 — Race-loser refund mechanism

**Conflict:**
- Doc: requires automatic refund job for race losers.
- Schema and code: not implemented.

**Severity:** Critical.
**Status:** UNRESOLVED — locked as required, mechanism not designed.
**Owner:** Person 4.

**Recommended resolution:** New `refund_jobs` table, processed by a
worker (Edge Function on a schedule, or Supabase pg_cron). Or
synchronous in-handler refund call to Razorpay if simple enough.
Recommendation: synchronous for V1 (keeps the system simple);
upgrade to a job queue in V2 if volume warrants.

### Open Question #8 — Idempotency strategy for Shiprocket webhook

**Conflict:**
- Doc: `webhook_events` shared across providers.
- Schema: table does not exist.
- Code: no Shiprocket webhook yet.

**Severity:** Medium (becomes High in Phase 4).
**Status:** UNRESOLVED — depends on OQ#3 resolution.
**Owner:** Person 4.

**Recommended resolution:** Reuse the same `webhook_events` table.
`provider = 'shiprocket'`, `provider_event_id` = Shiprocket's event id
(needs verification of what Shiprocket actually sends).

### Open Question #9 — RLS gaps

**Conflict:**
- Doc: RLS gates admin actions and audit-table reads.
- Schema: minimal RLS (SELECT-only on offers/orders; nothing on payments/disputes).
- Code: bypasses RLS via admin client.

**Severity:** Medium.
**Status:** UNRESOLVED.
**Owner:** Person 1 + Person 4.

**Recommended resolution:** Add policies per §4.3, §4.4, §4.5, §4.6,
§4.8, §4.9 in Phase 1.

### Open Question #10 — Manual admin override of Shiprocket states

**Conflict:**
- Doc: forbids admin from directly setting Shiprocket-owned states.
- Schema: no enforcement.
- Code: admin panel has no current UI for this, but nothing prevents
  it from being added later.

**Severity:** Medium.
**Status:** UNRESOLVED.
**Owner:** Person 4 + Person 3.

**Recommended resolution:** Document the recovery RPC pattern (per
`payments-shipping.md` Shiprocket section). Add a check in code review
that no `PATCH /admin/orders/:id/status` route gets added.

### Open Question #11 — Naming inconsistencies and stale Razorpay doc

**Conflict:**
- `offers.offered_price` vs `offer_amount` (schema vs code/doc).
- `docs/integrations/razorpay.md` lists offer statuses including `SHIPPED`, `DELIVERED` (domain-mixed).
- The same file has copy-pasted Postman documentation text accidentally committed.

**Severity:** Low (cleanup).
**Status:** UNRESOLVED.
**Owner:** Person 4 (doc cleanup).

**Recommended resolution:**
- Pick one name for `offered_price` / `offer_amount` (recommendation: `offer_amount` matches the code-side TypeScript and is more idiomatic).
- Rewrite `docs/integrations/razorpay.md` from scratch using the
  updated lifecycle. Remove the polluted Postman section.

Phase: cleanup, can be done in parallel with Phase 1.

### Recommended-resolution-but-not-decided summary

| OQ | Severity | Owner | Default if no decision is made |
|---|---|---|---|
| 1 | Critical | Joint | **RESOLVED 2026-05-30 — Candidate B with 6 sub-decisions; see OQ#1 entry above and `payments-shipping.md`.** |
| 2 | High | P1 + P4 | Implement as locked in doc. |
| 3 | Critical | P1 | Implement as locked in doc. |
| 4 | Critical | P1 | Default to `listings.sold_offer_id` mechanism. |
| 5 | Critical | P1 + P4 | Implement RPC per §4.7. |
| 6 | Medium | P4 | Default to `checkout_locks` table. |
| 7 | Critical | P4 | Default to synchronous refund call for V1. |
| 8 | Medium | P4 | Reuse `webhook_events` from OQ#3. |
| 9 | Medium | P1 + P4 | Add policies per §4. |
| 10 | Medium | P4 + P3 | Document recovery RPC; review-time check. |
| 11 | Low | P4 | Cleanup task. |

---

## 10. Final Readiness Verdict

### Architecture Status: **Partially Ready** (OQ#1 resolved; remaining Critical OQs unresolved)

Strengthened relative to a hypothetical pre-implementation start:
- Buyer purchase flow exists end-to-end (mock-backed).
- Order lifecycle UI exists.
- Dispute UI exists.
- Razorpay/Shiprocket integration code exists on a feature branch.
- Database schema exists and is applied.
- **OQ#1 (lifecycle / `escrow_held` semantics) RESOLVED 2026-05-30**
  with the locked V1 contract documented in `payments-shipping.md`.
  The single most consequential ambiguity is closed.

Still blocking:
- ~~**Lifecycle conflict unresolved (OQ#1).**~~ ✅ Resolved.
- **Missing event tables (OQ#3).** No audit trail exists for any state
  transition. Replay, debugging, analytics, and dispute reconstruction
  all depend on these tables.
- **Missing webhook event store (OQ#3).** Idempotency by current-state-
  check works for one event type; doesn't generalize.
- **Missing winner-selection invariant (OQ#4).** Two captures for one
  listing produces two paid offers today. Now safety-critical because
  Decision 6 (listing stays available until capture) means the DB
  invariant is the only correctness guarantee against simultaneous
  captures.
- **Missing atomic transaction primitive (OQ#5).** Crashes mid-cascade
  produce irrecoverable states. Now safety-critical for the same
  reason.
- **Missing race-loser refund flow (OQ#7).** Captured-but-lost buyers
  have no automated path to refund. Promoted in importance because the
  resolved OQ#1 contract makes captures-then-refunds a normal path,
  not an exception.
- **Missing `checkout_locks` table (OQ#6, promoted by OQ#1
  resolution).** Soft lock before Razorpay order creation; first-line
  race defence under the locked V1 contract.
- **Schema contract not yet accepted (this document, §4).** Person 1
  has not reviewed the contract in §4 against their understanding.
  §4.4 now points at Candidate B as the target.
- **Doc/schema/implementation divergence (§3).** Eleven recorded
  conflicts; the §3.2/§3.3/§3.4 lifecycle conflicts collapse with the
  resolved OQ#1, but the remaining ones still block.

### Why not "Architecture Ready, Implementation Not Ready"

That verdict assumed a clean architectural foundation pending only
implementation. The audit revealed that the foundation itself is in
contention. Until OQ#1 is resolved and the schema is reconciled,
"the architecture" does not have a single definition. Calling that
"architecture ready" would misrepresent what implementation engineers
will actually face.

### Why not "Not Ready"

The pieces are present. The decisions exist (some locked, some
unresolved). The Razorpay branch demonstrates that file-by-file
implementation against the eventual contract is feasible. The schema
exists and most tables are correct. This is much further along than
"not ready" implies.

### Path to "Implementation Ready"

1. ~~Joint meeting on OQ#1. Choose lifecycle.~~ **Done 2026-05-30 —
   Candidate B with six sub-decisions. See OQ#1 entry in §9 and the
   locked V1 contract in `payments-shipping.md`.**
2. Person 1 PR landing all Phase 1 schema changes (migrations or
   amended `schema.sql`) — now scoped specifically by the resolved
   OQ#1 contract:
   - `orders.status` enum amendment to the locked V1 lifecycle.
   - `offers.status` enum: add `lost`.
   - One-paid-offer invariant (default mechanism:
     `listings.sold_offer_id UUID UNIQUE NULLABLE`).
   - `finalize_winning_payment(...)` RPC committing `escrow_held` +
     `listings.status = 'sold'` + offer transitions atomically.
   - `webhook_events`, `offer_events`, `order_events`,
     `checkout_locks` tables.
   - RLS policies on the audit tables.
   - Drop `reserve_listing` trigger.
3. Schema Contract (§4) accepted in writing by Person 1 and Person 4
   as amended by the OQ#1 resolution.
4. Cleanup of mock-checkout `payments` rows.
5. Razorpay integration doc rewritten (OQ#11).

When all five steps are complete, the verdict can be re-issued as
**Architecture Ready, Implementation Not Ready** (Phase 1 complete,
Phase 2 unblocked). Phase 2 implementation produces
**Implementation Ready** for the buyer-pay path.

---

## 11. Report Acceptance Criteria

This report is complete only if every box is checked. Each criterion
is objectively verifiable. Reviewers can sign off section-by-section.

```
[x] Every payment/shipping-related table is documented.
    (§4.1–§4.10. Eight existing tables + three new tables. payments,
    listings, offers, orders, disputes, users, plus offer_events,
    order_events, webhook_events.)

[x] Every lifecycle state is enumerated.
    (§4.3 offers, §4.4 orders. Both candidate target enums for orders
    fully listed.)

[x] Every state transition is documented with from-state, to-state,
    triggering event, actor, and resulting audit row.
    (§4.3 offers transition table. §4.4 deferred to OQ#1 resolution.
    §4.7 cascade transitions inside the RPC.)

[x] Every RLS ownership boundary is documented.
    (§4 each table. §4.8 and §4.9 explicit on losing-buyer reads.)

[x] Every webhook source has an idempotency strategy.
    (§4.10 webhook_events. §5.11 idempotency requirements. OQ#8 for
    Shiprocket-specific.)

[x] Every payment mutation has transaction requirements.
    (§4.7 RPC. §5.10 explicit.)

[x] Every conflict between docs and implementation is listed under
    Open Questions.
    (§3 catalog. §9 OQs #1–#11.)

[x] Every Open Questions item has a recommended resolution and a
    named owner.
    (§9 each OQ. §9 summary table.)

[x] The report contains a final readiness verdict.
    (§10. Partially Ready, with full justification.)

[x] No implementation code was written.
    (Verified: git status shows only this report file modified;
    the report was produced by reading and analysis only.)
```

---

## Appendix A — File-level evidence index

Every claim in this report is sourced from one of:

- `docs/context/payments-shipping.md` (locked architecture).
- `docs/context/buyer-flow.md`, `seller-flow.md`, `admin-panel.md` (cross-feature context).
- `docs/integrations/razorpay.md`, `shiprocket.md` (integration docs).
- `docs/BRANCHING.md` (process).
- `ENGINEERING.md` (project rules).
- `supabase/schema.sql` (applied schema).
- `supabase/migrations/001_initial.sql` (5-line stub pointing to schema.sql).
- `supabase/seed.sql` (seed data; not reviewed for this audit).
- `src/lib/offers/types.ts`, `state.ts`, `create.ts`, `dashboard.ts`, `queries.ts`, `draft.ts`.
- `src/lib/mock/offers.ts` (mock fixtures).
- `src/app/api/checkout/mock/route.ts` (mock checkout).
- `src/app/api/dev/sign-in/route.ts`, `advance-order/route.ts` (dev bypass routes).
- `src/app/api/disputes/route.ts` (dispute creation).
- `src/app/buy/checkout/[listingId]/page.tsx`, `CheckoutForm.tsx` (buyer checkout UI).
- `src/app/orders/purchase/[orderId]/page.tsx`, `DisputeForm.tsx`, `AdvanceOrderButton.tsx` (order detail UI).
- `origin/feature/payments-shipping` files (read via `git show`):
  - `src/lib/razorpay/client.ts`, `helpers.ts`
  - `src/lib/shiprocket/client.ts`, `helpers.ts`
  - `src/app/api/payments/create/route.ts`, `verify/route.ts`, `webhook/route.ts`
  - `src/app/api/shipping/create-shipment/route.ts`, `track/route.ts`

Repository discovery commands: §2 final block.

---

## Appendix B — Glossary

- **Locked decision**: a decision recorded in `payments-shipping.md`
  before this audit began. The audit treats locked decisions as
  product intent, not as implemented fact.
- **Implementation Inventory**: file-by-file disposition of
  `origin/feature/payments-shipping` (§5.9).
- **Schema Contract**: target shape of every payment-domain table
  (§4). The artifact Person 1's schema PR converges to.
- **Hard Prerequisite**: an item from `payments-shipping.md`'s "Hard
  Prerequisites" table. Nine total; this audit confirmed gaps in #3,
  #4, #5, #6, #7, #9.
- **Mock checkout**: `/api/checkout/mock` plus the buyer-flow surfaces
  built on it. Decision A (§5 Finding 5): transitional; replaced in
  Phase 2.
- **Winner cascade**: the set of writes performed atomically when a
  `payment.captured` event makes one offer the winner of a listing.

---

End of report.
