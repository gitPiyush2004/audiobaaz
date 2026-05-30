# Supabase Phase 1 acceptance tests

Database-layer scenarios that prove `supabase/migrations/002_phase1_marketplace_core.sql` is transactionally correct.

These tests do not require a Node runtime, JS test framework, or any application code. They exercise `finalize_winning_payment(...)` directly via plain SQL inside `psql` (or the Supabase SQL editor), plus a multi-connection stress harness using `pgbench`.

## What they prove

Per `docs/context/payments-shipping.md` "Phase 1 acceptance criteria":

- **A — Concurrent captures, one winner.** Two captures for one listing → exactly one `escrow_held` order, the other `cancelled` with the right audit event.
- **B — Mid-cascade crash.** RPC followed by a synthetic handler crash → all writes rolled back. No half-state.
- **C — Refunded winner immutability.** Buyer-favourable dispute → `listings.status` and `sold_offer_id` unchanged. Subsequent capture attempts conflict.
- **D — High-concurrency race + auditability.** 10 sequential captures → 1 winner, 9 losers, all 9 losers discoverable from `order_events` alone (no Razorpay dashboard needed).
- **E1 — Webhook replay (same payment).** Same captured-payment webhook delivered repeatedly → first call wins, subsequent calls return `noop` with byte-for-byte identical state and zero duplicate audit rows.
- **E2 — Replay interleaved with second buyer.** Replay of A's webhook arriving after B's conflict has been recorded → A's replay still no-ops, B's cancellation is not duplicated, no cascade fires twice.

The stress harness adds:

- **Multi-connection concurrency (100+ parallel clients).** True OS-level parallelism via pgbench. Verifies the lifetime invariant + `SELECT ... FOR UPDATE` locks hold under real contention, not just sequential calls in one connection.

## Verification gate

**This branch must not merge to `dev` until all of the following pass.** No exceptions.

| Gate | What | How |
|------|------|-----|
| 1 | All five SQL scenarios pass | `psql -f supabase/tests/phase1_scenarios.sql` |
| 2 | Multi-connection stress at concurrency = 100 | `bash supabase/tests/phase1_stress.sh` |
| 3 | Schema Contract review (audit §4) | Person 1 + Person 4 sign off |

Scenario B is the gate-of-gates. If it fails, fix before continuing — atomicity bugs cannot be papered over with retries or refunds.

## How to run the SQL scenarios

### Option A — local Supabase via the CLI

```bash
# from repo root
supabase db reset                                              # applies schema.sql + 002 + 003 + 004 migrations
supabase db execute --file supabase/tests/phase1_scenarios.sql
```

`supabase db reset` requires a running local Supabase (`supabase start`).

### Option B — direct psql against any Postgres instance

```bash
# 1. apply the base schema
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql

# 2. apply Phase 1 migrations
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/002_phase1_marketplace_core.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/003_phase1_refund_lifecycle.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/004_phase1_checkout_locks.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/005_phase1_invariant_guards.sql

# 3. run the scenarios
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase1_scenarios.sql
```

The script uses `SAVEPOINT` / `ROLLBACK TO SAVEPOINT` between scenarios so a failure in one does not poison the rest, and so the database is left clean if every scenario passes.

### Option C — paste into Supabase SQL editor

Run them one scenario at a time in the SQL editor against a non-production project. The `RAISE NOTICE` lines surface in the editor's output panel; any `RAISE EXCEPTION` halts execution with the failing assertion as the error message.

## How to run the stress harness

```bash
# Default: 100 parallel clients
DATABASE_URL=postgres://... bash supabase/tests/phase1_stress.sh

# Higher concurrency
DATABASE_URL=postgres://... CONCURRENCY=500 bash supabase/tests/phase1_stress.sh
```

Requires `psql` and `pgbench` on the PATH. Both ship with Postgres.

The harness:

1. Stages a fresh listing + N orders + N payments (one per concurrency slot).
2. Runs `pgbench -c N -j N -t 1` against `finalize_winning_payment()`, with each client targeting a distinct payment_id but the same listing.
3. Asserts marketplace state at the end: exactly 1 `escrow_held`, exactly N-1 `cancelled`, listing flipped to `sold`, exactly 1 `payment_captured` event, exactly N-1 `order_cancelled` events.
4. Cleans up its own fixtures.

A run with `CONCURRENCY=100` exercises the lifetime invariant + `SELECT ... FOR UPDATE` locks under real contention. If the system survives 100 parallel captures with byte-perfect marketplace state, the same logic survives 2 — and 2 is what you'll actually see in production.

## Expected output

`phase1_scenarios.sql`:

```
=== Scenario A — Concurrent captures, one winner ===
NOTICE:  Scenario A PASSED

=== Scenario B — Mid-cascade crash, no split brain ===
NOTICE:  Scenario B PASSED — no split brain

=== Scenario C — Refunded winner immutability ===
NOTICE:  Scenario C PASSED — sold_offer_id immutable post-refund

=== Scenario D — 10 captures, 1 winner, full audit trail ===
NOTICE:  Scenario D PASSED — 1 winner, 9 losers, 0 ownership corruption, full audit trail

=== Scenario E1 — Webhook replay (same payment_id) ===
NOTICE:  Scenario E1 PASSED — replay is byte-for-byte idempotent

=== Scenario E2 — Replay interleaved with second buyer capture ===
NOTICE:  Scenario E2 PASSED — replay does not re-cascade or re-cancel

=== ALL FIVE SCENARIOS PASSED ===
```

`phase1_stress.sh` at concurrency=100:

```
=== Phase 1 stress test ===
  Concurrency:  100 parallel clients
  ...

Setting up 100 orders...
Running pgbench with 100 clients (1 transaction each)...
[pgbench summary stats]

=== Assertions ===
NOTICE:  STRESS PASS: 1 winner, 99 losers, full audit trail

=== STRESS PASSED at concurrency = 100 ===
```

If any scenario or stress assertion fails, the script aborts non-zero on the failing condition.

## Notes on what's NOT proven

- **Razorpay or Shiprocket integration.** Phase 2 scope. These tests deliberately stop at the marketplace state boundary; they do not call any external API.
- **Refund-lifecycle transitions under load.** Scenarios cover the `cancelled` state for race losers but not the full `payments.refund_status` state machine. Refund-lifecycle tests land in a follow-up commit on this branch before merge to dev.
- **`checkout_locks` contention behaviour.** The lock-acquire/release RPCs are tested for correctness in the migration but not stressed in this harness. Adding `acquire_checkout_lock` to the pgbench script before `finalize_winning_payment` is a small extension worth doing before Phase 2.
- **Real network webhook duplication.** Scenario E covers application-level idempotency. End-to-end webhook delivery semantics (5xx retry, signature verification, `webhook_events` upsert) live in the Phase 2 handler and need their own integration test once that lands.

## Rogue write paths to remove in Phase 2

A grep audit on `feature/payments-shipping` found four code paths that bypass `finalize_winning_payment` and would now trigger the migration 005 invariant guards. None of these paths exist on `dev`, but they exist on the parked branch and must be replaced before the Razorpay routes go live:

| File | Issue | Phase 2 fix |
|------|-------|-------------|
| `src/app/api/payments/webhook/route.ts:88` | `UPDATE listings SET status='sold'` without `sold_offer_id` | Replace with `rpc('finalize_winning_payment', ...)` |
| `src/app/api/payments/webhook/route.ts:138` | On `payment.failed`: `UPDATE listings SET status='approved'` (the resurrection path) | Remove entirely. Decision 6 dropped the reservation flow; failed payments leave the listing alone |
| `src/app/api/payments/verify/route.ts:99` | Same as webhook line 88 | Replace with the RPC |
| `src/app/api/checkout/mock/route.ts:97` | Same — mock checkout is transitional | Delete the route; `CheckoutForm` points at `/api/payments/create` |

Until those four are removed, attempting to run the Razorpay flow against a database with migration 005 applied will produce a `check_violation` from the trigger — which is the correct behaviour. The trigger is the safety net; the application code is the broken path.
