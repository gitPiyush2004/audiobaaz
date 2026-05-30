# Phase 1 verification — runbook

Copy-pasteable steps to take a fresh Ubuntu VPS (or local macOS / Linux machine) from "no Postgres tooling installed" to a green Phase 1 verification run.

If you're tracking the architecture work via `docs/context/payments-shipping.md`, this is the gate that has to pass before `feature/payments-shipping` merges to `dev` and Phase 2 (Razorpay route revisions) starts. **Code written ≠ correctness proven** — this runbook exists so the proof actually happens.

The acceptance gate has three checks:

1. All five SQL scenarios pass (`phase1_scenarios.sql`)
2. Multi-connection stress at concurrency = 100 passes (`phase1_stress.sh`)
3. Higher-margin stress at concurrency = 500 passes

Scenario B is the gate-of-gates. If atomicity is broken, fix that before debugging anything else.

---

## On a fresh Ubuntu VPS (recommended)

### 1. Install PostgreSQL tooling

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
psql --version       # expect: psql (PostgreSQL) 15.x or later
pgbench --version    # expect: pgbench (PostgreSQL) 15.x or later
```

`pgbench` ships with `postgresql-contrib`. If your distro splits it into a separate package, install `postgresql-client` plus the `pgbench` binary explicitly.

### 2. Create a fresh test database

```bash
sudo -u postgres createdb audiobaaz_phase1
sudo -u postgres psql -d audiobaaz_phase1 -c "ALTER USER postgres WITH PASSWORD 'postgres';"
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/audiobaaz_phase1
```

### 3. Apply schema + migrations

```bash
cd /path/to/audiobaaz
git checkout feature/payments-shipping
git pull origin feature/payments-shipping

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/002_phase1_marketplace_core.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/003_phase1_refund_lifecycle.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/004_phase1_checkout_locks.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/005_phase1_invariant_guards.sql
```

Each `psql` should exit 0. If any fails, fix that migration before continuing — running tests against a partial schema is meaningless.

### 4. Run the five acceptance scenarios

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase1_scenarios.sql
```

Expected output (NOTICE lines, exit 0):

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

If any scenario raises, the script aborts non-zero and prints the failing assertion. Fix in this priority order:

- **Scenario B fails** → atomicity bug in `finalize_winning_payment`. Stop everything and fix this. Nothing else matters.
- **Scenario A or D fails** → race-condition bug. Likely `SELECT ... FOR UPDATE` ordering or the unique constraint timing.
- **Scenario C fails** → invariant guard bug, or a code path that updates `sold_offer_id` post-set.
- **Scenario E1 / E2 fails** → idempotency bug. The `payment.status = 'captured'` early-return is the place to look.

### 5. Run the stress harness at concurrency = 100

```bash
DATABASE_URL="$DATABASE_URL" bash supabase/tests/phase1_stress.sh
```

Expected output ends with:

```
=== STRESS PASSED at concurrency = 100 ===
```

The script self-cleans its fixtures on success.

### 6. Run the stress harness at concurrency = 500 for margin

```bash
DATABASE_URL="$DATABASE_URL" CONCURRENCY=500 bash supabase/tests/phase1_stress.sh
```

If 500 passes too, the marketplace core is considered de-risked.

### 7. (Optional) Reset the database for a clean slate

```bash
sudo -u postgres dropdb audiobaaz_phase1
sudo -u postgres createdb audiobaaz_phase1
```

---

## On macOS

```bash
brew install postgresql@15
brew services start postgresql@15
createdb audiobaaz_phase1
export DATABASE_URL=postgres://$(whoami)@localhost:5432/audiobaaz_phase1
```

Then jump to step 3 above.

---

## Via GitHub Actions (automated)

`.github/workflows/phase1-verification.yml` runs the entire gate on:

- every push to `dev` or `main` that touches `supabase/migrations/**`, `supabase/schema.sql`, or `supabase/tests/**`
- every pull request touching the same paths
- manual `workflow_dispatch` (UI button) with optional concurrency override

The Actions runner spins up a fresh `postgres:15` service container, applies the schema + four Phase 1 migrations, runs `phase1_scenarios.sql`, then `phase1_stress.sh` at the configured concurrency. Manual dispatch can pass a higher concurrency for margin runs.

This means: once `feature/payments-shipping` merges to `dev`, every subsequent change touching marketplace-core SQL gets verified automatically. Regressions become visible at PR time.

---

## What "passing" means

- All six scenario assertions print `PASSED`.
- Stress at 100 prints `STRESS PASS: 1 winner, 99 losers, ...`.
- Stress at 500 prints `STRESS PASS: 1 winner, 499 losers, ...`.
- The post-run sanity dump (in CI) confirms the RPC, unique constraint, and trigger guards are all attached.

When the gate passes, the Phase 1 PR can open against `dev`, the Schema Contract review with Person 1 can sign off, and Phase 2 (Razorpay route revisions per the migration 005 docblock and the context-doc cleanup checklist) can start.

When the gate fails, **the failing assertion is more valuable than the passing ones**. It points at exactly the bug the architecture lock was designed to prevent. Fix the SQL, re-run, repeat.
