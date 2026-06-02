# Git Branching Guide — Audiobaaz

**Last updated:** 2026-05-30 (post vertical-slice consolidation onto `feature/order-lifecycle-shipping`)

---

## Current branch state

```
main          ← stable. never commit directly.
└── dev       ← integration. tip 7b294e9 (PR #3 merge).
    └── feature/order-lifecycle-shipping  ← ACTIVE — single branch for
                                             remaining V1 transaction-engine
                                             work (payments, shipping,
                                             escrow lifecycle, timeline,
                                             admin operations). Tip d2f9bc6.
```

| Branch | State | Notes |
|--------|-------|-------|
| `main` | release | Production. Auto-deploys to `audiobaaz.com`. |
| `dev` | integration | Auto-deploys to `dev.audiobaaz.com`. Tip `7b294e9`. |
| `feature/order-lifecycle-shipping` | **ACTIVE** | All remaining V1 transaction-engine work lands here. Branched off `dev`. |
| `feature/checkout-razorpay-wire` | **SUPERSEDED** | PR #4 OPEN. Code (CheckoutForm wiring + `/api/checkout/mock` removal) lives on the active branch as commit `5ae8cd7` (cherry-pick of `413bc77`). Recommendation: close PR #4 without merging; delete branch after the active branch lands. |
| `feature/payment-routes` | **MERGED** | Merged via PR #3. Zero commits ahead of `dev`. Safe to delete from origin. |
| `feature/payments-shipping` | **MERGED** | Merged via PR #2. Zero commits ahead of `dev`. Safe to delete from origin. |
| `feature/buyer-flow` | **MERGED** | Earlier merge. Zero commits ahead of `dev`. Safe to delete from origin. |
| `feature/admin-panel`, `feature/seller-flow`, `feature/ui-redesign` | historical | Remote-only refs. Pre-V1 history; deletion deferred. |

### Verifying before deleting

Run before pushing any `--delete`:

```bash
git fetch origin
git log --oneline dev..feature/payment-routes        # expect empty
git log --oneline dev..feature/payments-shipping     # expect empty
git log --oneline dev..feature/buyer-flow            # expect empty
git diff feature/checkout-razorpay-wire..feature/order-lifecycle-shipping --stat
# expect: active branch is a strict superset (large +/- but no missing files)
```

After confirming:

```bash
git push origin --delete feature/payment-routes
git push origin --delete feature/payments-shipping
git push origin --delete feature/buyer-flow
# After PR #4 is closed:
git push origin --delete feature/checkout-razorpay-wire
```

---

## Daily start routine

```bash
git fetch origin
git checkout feature/order-lifecycle-shipping        # or whatever's active
git pull
```

Then load `ENGINEERING.md` + the relevant `docs/context/<feature>.md` into your AI tool before writing code.

---

## Daily end routine

```bash
# Update context files for the work you did
# Update ENGINEERING.md "Current Build Status" if a feature changed state

git add -A             # but verify .kiro/ and .vscode/ are gitignored — they should be
git commit -m "feat(scope): one-line summary"
git push
```

`.kiro/` and `.vscode/` are local editor state and must NOT be committed. They appear as untracked in `git status` and stay that way.

---

## Commit message format

```
feat(scope):  what you built
fix(scope):   what you fixed
chore(scope): setup, config, no user-facing change
docs(scope):  documentation only

Examples:
feat(payments): introduce PaymentProvider abstraction with Razorpay + Dev impls
fix(verify): mark losing payment captured before initiate_refund
chore(db): apply migration 007 to dev Supabase project
docs(context): synchronise project state — PR #2 + PR #3 merged
```

---

## Merging to `dev`

1. `git pull origin dev` from your feature branch first.
2. `git push origin <your-branch>`.
3. Open a PR on GitHub: `<your-branch> → dev`.
4. PR description references any audit / runbook docs (e.g. `docs/reviews/order-lifecycle-shipping-audit.md`).
5. Required reviewer signs off (see "Reviewer ownership" below).
6. Merge.

Never commit directly to `dev` or `main`. Doc-only commits to `dev` are tolerated for emergencies but should be rare.

---

## Branch strategy for remaining V1

**Rule 1 — One active branch.**
All payments / shipping / order-lifecycle / admin-operations work goes
on `feature/order-lifecycle-shipping`. Do not branch a sibling for "the
timeline" or "the admin pages" or "the Shiprocket swap." If a genuine
cross-cutting concern surfaces (e.g. a Phase 1.5 schema amendment that
touches Phase 2 routes), it ships on the same branch.

**Rule 2 — PR #4 is closed without merging.**
The CheckoutForm wiring + `/api/checkout/mock` removal already exist on
the active branch as commit `5ae8cd7` (cherry-pick of `413bc77`).
Merging PR #4 separately would create a phantom commit pair. Close PR
#4; delete `feature/checkout-razorpay-wire` after the active branch
merges.

**Rule 3 — Merged-ancestor branches are deleted.**
After verification (above), delete `feature/payment-routes`,
`feature/payments-shipping`, and `feature/buyer-flow` from origin.

**Rule 4 — One PR for the active branch.**
When `feature/order-lifecycle-shipping` is ready, it opens as a single
PR against `dev`. The PR is large by design — payments, shipping,
lifecycle, timeline, and admin operations are tightly coupled.
Splitting them into smaller PRs would require designing intermediate
commits that don't represent a usable marketplace state.

**Rule 5 — Real-credential swaps are post-merge, separate, surgical.**
When Razorpay or Shiprocket credentials arrive, the swap-in branches
(`feature/shiprocket-provider`, `feature/razorpay-go-live`) are
separate, small, and designed specifically to be reviewable on their
own. The provider abstractions exist so those swaps stay small.

---

## Shared components rule

These folders are used by everyone:
- `src/components/ui/` — base components (Button, Input, Card, Badge, Spinner)
- `src/components/listing/` — listing display components
- `src/components/orders/` — `OrderTimeline`, `ShipmentTracking` (shared across buyer + seller + admin surfaces)

If you create or change a shared component:
1. Keep TypeScript props clean and documented (explicit `interface ...Props`, accept `className?: string`).
2. Use view-model props (structural subsets) — not raw DB rows. Server-only fields like `floor_price`, `seller_score`, `buyer_score`, `auto_accept_threshold` must not reach the client.
3. Update the Shared Components Registry in `ENGINEERING.md`.
4. Tell the team in chat.
5. Update your context file's "What other features can use from here" section.

---

## Reviewer ownership — required approvals

Some paths are load-bearing. Changes require sign-off from the designated reviewer **before** merge into `dev`.

| Scope | Required reviewer | Rationale |
|-------|-------------------|-----------|
| `src/components/ui/**` | Design-system owner (Person 2) | Visual primitives; one set of variants for the whole app |
| `src/components/listing/**` | Listing primitives owner (Person 2) | Marketplace card surface |
| `src/components/orders/**` | Cross-feature owner (Person 2 + Person 4) | Buyer + seller + admin surfaces |
| `src/lib/utils/**` | Utilities owner (Person 2) | `cn`, formatting — duplication here cascades |
| `src/lib/payments/**`, `src/lib/shipping/**` | Person 4 | Provider abstractions; swap-in points for real gateways |
| `supabase/schema.sql`, any DB migration | Schema owner (Person 1) + Person 4 if Phase 1+ | All four features depend on these shapes |
| `src/middleware.ts`, `src/lib/supabase/{server,client,admin}.ts`, `(auth)/**`, anything that gates auth or RLS | Auth/security owner (Person 1) | Auth bugs are silent and dangerous |
| `next.config.mjs`, `tailwind.config.ts`, `src/app/globals.css`, `tsconfig.json`, `package.json` | PR opener + one other | Foundation; affects everyone's local build |

### What reviewers check

- New shared component? Explicit `Props` interface AND `className?: string`.
- View-model props (structural subsets), not raw DB row spreads — no `floor_price`, scores, or contact data reaching the client.
- Class composition uses canonical `@/lib/utils/cn` — no inline `twMerge(clsx(...))`.
- No duplicate variants of an existing primitive (e.g. a second `Button`).
- No new dependencies without team agreement.
- Registry in `ENGINEERING.md` updated for new shared components.
- `tsc`, `lint`, and `next build` all pass on the branch.
- Any DB migration is **applied against a real local Postgres** before merge — not just type-checked. Add a smoke test under `supabase/tests/` when introducing new RPCs.

---

## AI session start protocol

Give this prompt at the start of every AI coding tool session:

```
Read these files in this exact order before writing any code:
1. ENGINEERING.md
2. docs/BRANCHING.md
3. docs/V1-LAUNCH.md
4. docs/context/<your-feature>.md
5. Any files you intend to modify

Confirm the current git branch and the tip commit hash.
Summarize what you understand before proceeding.
Do not write code until I confirm the summary.

At the end of this session, remind me to update the context file
and verify .kiro/ and .vscode/ remain untracked before commit.
```

Replace `<your-feature>` with `seller-flow`, `buyer-flow`, `admin-panel`, or `payments-shipping`.

If your work touches another feature's domain (e.g. admin reading listings, buyer making offers), read that feature's context file too.
