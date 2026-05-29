# Supabase Phase 1 acceptance tests

Database-layer scenarios that prove `supabase/migrations/002_phase1_marketplace_core.sql` is transactionally correct.

These tests do not require a Node runtime, JS test framework, or any application code. They exercise `finalize_winning_payment(...)` directly via plain SQL inside `psql` (or the Supabase SQL editor).

## What they prove

Per `docs/context/payments-shipping.md` "Phase 1 acceptance criteria — four scenarios at the database layer":

- **A — Concurrent captures, one winner.** Two captures for one listing → exactly one `escrow_held` order, the other `cancelled` with the right audit event.
- **B — Mid-cascade crash.** RPC followed by a synthetic handler crash → all writes rolled back. No half-state.
- **C — Refunded winner immutability.** Buyer-favourable dispute → `listings.status` and `sold_offer_id` unchanged. Subsequent capture attempts conflict.
- **D — High-concurrency race + auditability.** 10 captures → 1 winner, 9 losers, all 9 losers discoverable from `order_events` alone (no Razorpay dashboard needed).

## How to run

### Option A — local Supabase via the CLI

```bash
# from repo root
supabase db reset                                              # applies schema.sql + 002_phase1_marketplace_core.sql
supabase db execute --file supabase/tests/phase1_scenarios.sql
```

`supabase db reset` requires a running local Supabase (`supabase start`).

### Option B — direct psql against any Postgres instance

```bash
# 1. apply the base schema
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql

# 2. apply the Phase 1 migration
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/002_phase1_marketplace_core.sql

# 3. run the scenarios
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase1_scenarios.sql
```

The script uses `SAVEPOINT` / `ROLLBACK TO SAVEPOINT` between scenarios so a failure in one does not poison the rest, and so the database is left clean if every scenario passes.

### Option C — paste into Supabase SQL editor

Run them one scenario at a time in the SQL editor against a non-production project. The `RAISE NOTICE` lines surface in the editor's output panel; any `RAISE EXCEPTION` halts execution with the failing assertion as the error message.

## Expected output

```
=== Scenario A — Concurrent captures, one winner ===
NOTICE:  Scenario A PASSED

=== Scenario B — Mid-cascade crash, no split brain ===
NOTICE:  Scenario B PASSED — no split brain

=== Scenario C — Refunded winner immutability ===
NOTICE:  Scenario C PASSED — sold_offer_id immutable post-refund

=== Scenario D — 10 captures, 1 winner, full audit trail ===
NOTICE:  Scenario D PASSED — 1 winner, 9 losers, 0 ownership corruption, full audit trail

=== ALL FOUR SCENARIOS PASSED ===
```

If any scenario fails, the script aborts non-zero on the assertion that broke and prints the failing condition.

## Notes on what's NOT proven

- **True multi-connection concurrency.** Scenario D is sequential within a single session; it proves correctness against the invariant + `SELECT ... FOR UPDATE` locks but not against true OS-level parallelism. A pgbench-style multi-connection stress test belongs in a separate CI job.
- **Razorpay or Shiprocket integration.** Phase 2 scope. These tests deliberately stop at the marketplace state boundary; they do not call any external API.
- **Refund-lifecycle transitions.** Lands in a follow-up migration (`003_phase1_refund_lifecycle.sql`). These tests exercise the `cancelled` state for race losers but not the `payments.refund_status` enum (which doesn't exist yet).
- **`checkout_locks` table.** Phase 1 priority 4; lands after refund-lifecycle.
