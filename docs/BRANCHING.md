# Git Branching Guide — Audiobaaz

**Last updated:** 2026-06-08

---

## Current branch state

```
main   ← production. audiobaaz.com. tip de07529.
dev    ← integration. dev.audiobaaz.com. tip c22bfc5.
feature/ui-redesign  ← ACTIVE — remaining V1 transaction-engine work
                        (payments, shipping, lifecycle, admin ops).
```

**main and dev have diverged.** Main has ~10 commits dev doesn't (launch page
sprint done directly on main). Dev has ~5 commits main doesn't (admin panel
extraction, docs). They are NOT on the same line — do not `git merge` them.
Use cherry-pick to move specific commits between them.

| Branch | Remote | State | Notes |
|--------|--------|-------|-------|
| `main` | `origin/main` | **release** | Production. Vercel auto-deploy → `audiobaaz.com`. Tip `de07529`. |
| `dev` | `origin/dev` | **integration** | Staging. Vercel auto-deploy → `dev.audiobaaz.com`. Tip `c22bfc5`. |
| `feature/ui-redesign` | `origin/feature/ui-redesign` | **ACTIVE** | All remaining V1 transaction-engine work. Lifecycle validation complete (all 8 scenarios passed 2026-06-02). Ready to merge → `dev`. |
| All other feature branches | gone | **deleted** | `feature/order-lifecycle-shipping`, `feature/checkout-razorpay-wire`, `feature/payment-routes`, `feature/payments-shipping`, `feature/buyer-flow`, `feature/admin-panel`, `feature/seller-flow` — all removed from remote. |

---

## What still needs to land

| Step | Action |
|------|--------|
| 1 | Open PR: `feature/ui-redesign → dev`. Run `tsc + lint + next build`. Get reviewer sign-off. Merge. |
| 2 | After merge: PR `dev → main` to ship transaction-engine to production. |
| 3 | Post-merge surgical branches: `feature/razorpay-go-live`, `feature/shiprocket-provider` when credentials arrive. Keep them small — the provider abstractions were built for exactly this. |

---

## Two classes of change — different push rules

### Class A — Launch page (`audiobaaz_launch.html` / `public/launch.html`)

The launch page is standalone HTML with no build step. The actual workflow is:

```bash
# 1. Edit audiobaaz_launch.html — this is the source of truth
# 2. Sync:
cp audiobaaz_launch.html public/launch.html
# 3. Commit directly on main:
git add audiobaaz_launch.html public/launch.html
git commit -m "feat(launch): ..."
git push origin main
# 4. Cherry-pick to dev:
git checkout dev
git cherry-pick <hash>
# If conflict on launch files: take main's version
git checkout main -- audiobaaz_launch.html public/launch.html
git cherry-pick --continue --no-edit
git push origin dev
git checkout main
```

Direct commits to `main` are acceptable for launch page work because it is
pre-app, standalone HTML, and the PR gate would add friction without adding
safety. **Do not use this exception for any Next.js app code.**

### Class B — App code (Next.js features, API routes, components, schema)

Must go through a PR. Never commit directly to `main` or `dev`.

```bash
git checkout feature/ui-redesign   # or new feature branch off dev
git pull origin dev
# ... do work ...
git push origin feature/ui-redesign
# Open PR on GitHub → dev
# Pass: tsc, lint, next build
# Reviewer sign-off (see table below)
# Merge to dev
# When ready for production: PR dev → main
```

### Class C — Context / docs only

Doc-only commits (`ENGINEERING.md`, `docs/context/*.md`) may go directly to `dev`
without a PR. This is the "sync context to dev" step done at end of each session.

```bash
git checkout dev
git checkout main -- ENGINEERING.md docs/context/<your-feature>.md
git add ENGINEERING.md docs/context/<your-feature>.md
git commit -m "docs: sync <feature> context to dev"
git push origin dev
git checkout main
```

---

## Daily start routine

```bash
git fetch origin
git checkout feature/ui-redesign   # or whichever branch is active
git pull
```

Load `ENGINEERING.md` + `docs/context/<your-feature>.md` into your AI tool before writing code.

---

## Daily end routine

```bash
# Update docs/context/<your-feature>.md with current status
# Update ENGINEERING.md "Current Build Status" if a feature changed state

git add <specific files>    # never git add -A blindly
git commit -m "feat(scope): one-line summary"
git push
```

`.kiro/` and `.vscode/` are local editor state — must NOT be committed.
Verify they remain untracked before every commit.

---

## Commit message format

```
feat(scope):  new user-facing capability
fix(scope):   bug fix
chore(scope): setup, config, no user-facing change
docs(scope):  documentation / context files only

Examples:
feat(launch): add animated Telegram chat to community section
feat(payments): introduce PaymentProvider abstraction with Razorpay + Dev impls
fix(cursor): remove cur-big expansion — glass cursor is the hover indicator
docs(context): sync seller-flow context to dev
```

---

## Merging to `dev` (app code)

1. `git pull origin dev` on your feature branch first — resolve any conflicts locally.
2. `git push origin <your-branch>`.
3. Open PR on GitHub: `<your-branch> → dev`.
4. PR description references any audit / runbook docs.
5. Required reviewer signs off (see table below).
6. Merge.

---

## Reviewer ownership — required approvals before merge to `dev`

| Scope | Required reviewer | Rationale |
|-------|-------------------|-----------|
| `src/components/ui/**` | Design-system owner (Person 2) | Visual primitives; one set of variants for the whole app |
| `src/components/listing/**` | Person 2 | Marketplace card surface |
| `src/components/orders/**` | Person 2 + Person 4 | Buyer + seller + admin surfaces |
| `src/lib/utils/**` | Person 2 | `cn`, formatting — duplication here cascades |
| `src/lib/payments/**`, `src/lib/shipping/**` | Person 4 | Provider abstractions; swap-in points for real gateways |
| `supabase/schema.sql`, any DB migration | Person 1 + Person 4 if Phase 1+ | All four features depend on these shapes |
| `src/middleware.ts`, `src/lib/supabase/{server,client,admin}.ts`, `(auth)/**` | Person 1 | Auth bugs are silent and dangerous |
| `next.config.mjs`, `tailwind.config.ts`, `src/app/globals.css`, `tsconfig.json`, `package.json` | PR opener + one other | Foundation; affects everyone's local build |

### What reviewers check

- New shared component: explicit `Props` interface + `className?: string`.
- View-model props (structural subsets) — no `floor_price`, scores, or contact data reaching the client.
- Class composition uses `@/lib/utils/cn` — no inline `twMerge(clsx(...))`.
- No duplicate variants of existing primitives.
- No new dependencies without team agreement.
- Shared Components Registry in `ENGINEERING.md` updated.
- `tsc`, `lint`, and `next build` all pass on the branch.
- DB migrations applied against a real local Postgres before merge. Smoke test under `supabase/tests/` when introducing new RPCs.

---

## Shared components rule

If you create or modify anything in:
- `src/components/ui/` — base primitives
- `src/components/listing/` — listing display
- `src/components/orders/` — cross-feature order UI

Then:
1. Keep props typed with explicit `interface ...Props`.
2. Accept `className?: string`.
3. Use view-model props — not raw DB rows. Server-only fields (`floor_price`, `seller_score`, `buyer_score`, `auto_accept_threshold`) must not reach the client.
4. Update the Shared Components Registry in `ENGINEERING.md`.
5. Tell the team in chat.

---

## AI session start protocol

Give this prompt at the start of every AI coding tool session:

```
Read these files in this exact order before writing any code:
1. ENGINEERING.md
2. docs/BRANCHING.md
3. docs/V1-LAUNCH.md
4. docs/context/<your-feature>.md
5. Any files you intend to modify today

Confirm the current git branch and the tip commit hash.
Summarize what you understand before proceeding.
Do not write code until I confirm the summary.

At the end of this session, remind me to update the context file
and verify .kiro/ and .vscode/ remain untracked before commit.
```

Replace `<your-feature>` with `seller-flow`, `buyer-flow`, `admin-panel`, or `payments-shipping`.

If your work touches another feature's domain, read that feature's context file too.
