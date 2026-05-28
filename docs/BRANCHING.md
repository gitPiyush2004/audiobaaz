# Git Branching Guide — Audiobaaz

---

## Branch Structure

```
main          ← stable only. never commit directly here.
└── dev       ← integration. all features merge here first.
    ├── feature/seller-flow         (Person 1 — AI coding tool)
    ├── feature/buyer-flow          (Person 2 — Kiro)
    ├── feature/admin-panel         (Person 3)
    └── feature/payments-shipping   (Person 4)
```

---

## Daily Start Routine

```bash
# 1. Switch to your feature branch
git checkout feature/seller-flow

# 2. Pull latest from dev (get everyone's updates)
git pull origin dev

# 3. Start AI coding tool session
# Load ENGINEERING.md + your context file first
```

---

## Daily End Routine

```bash
# 1. Update your context file in docs/context/
# 2. Update build status in ENGINEERING.md

# 3. Stage and commit
git add .
git commit -m "feat(seller): complete step 3 condition grading"

# 4. Push to your branch
git push origin feature/seller-flow
```

---

## Commit Message Format

```
feat(scope): what you built
fix(scope): what you fixed
chore(scope): setup, config, no user-facing change

Examples:
feat(seller): add photo upload with 1200x900 validation
feat(buyer): build listing card component
fix(payments): handle Razorpay webhook signature error
chore(db): add merchant_id column to orders table
```

---

## Merging To Dev

When a feature or sub-feature is complete and tested:

```bash
# On your feature branch
git pull origin dev          # get latest dev first
git push origin feature/seller-flow

# Open a Pull Request on GitHub:
# feature/seller-flow → dev
# Title: what's complete
# Description: what was built, what to test
```

---

## Rules

1. Never commit directly to `main` or `dev` — use PRs for code, docs-only direct commits to dev are OK
2. Always pull from `dev` before starting work
3. One PR per completed feature/sub-feature — not one giant PR
4. Update your context file before every PR
5. Sync your context file to dev at the end of every session (see ENGINEERING.md end routine)
6. If you touch a SHARED component — announce it to the team

---

## Shared Components Rule

Components in these folders are used by everyone:
- `src/components/ui/`
- `src/components/shared/`
- `src/components/listing/`

If you create or modify a shared component:
1. Document its props clearly with TypeScript
2. Add it to the Shared Components Registry in `ENGINEERING.md`
3. Post in team chat: "Modified Nav.tsx — now auth-aware, check ENGINEERING.md shared registry"
4. Update your context file's "What other features can use from here" section

---

## Reviewer Ownership — Required Approvals

Some paths in the repo are load-bearing. Changes to them require sign-off from the
designated reviewer **before** the PR can merge into `dev`. This is not optional.
The goal is to stop AI-assisted divergence — duplicate components, second utility
patterns, inconsistent spacing, accidentally leaked server-only fields.

| Scope | Required reviewer | Rationale |
|-------|-------------------|-----------|
| `src/components/ui/**` | Design-system owner (currently Person 2) | Visual primitives; one set of variants and sizes for the whole app |
| `src/components/listing/**` | Listing primitives owner (Person 2) | Marketplace card surface — every page consumes it |
| `src/components/shared/**` | Cross-feature owner (Person 2) | Touches multiple features by definition |
| `src/lib/utils/**` | Utilities owner (Person 2) | Things like `cn`, formatting — duplication here is a fast track to chaos |
| `supabase/schema.sql`, any DB migration | Schema owner (Person 1) | All four features depend on the same shapes |
| `src/middleware.ts`, `src/lib/supabase/{server,client,admin}.ts`, `(auth)/**`, anything that gates auth or RLS | Auth/security owner (Person 1) | Auth bugs are silent and dangerous |
| `next.config.mjs`, `tailwind.config.ts`, `src/app/globals.css`, `tsconfig.json`, `package.json` | Whoever opened the PR + one other | Foundation; affects everyone's local build |

### How to request a review
- Mention the reviewer in the PR description
- If the reviewer is the same person opening the PR, get a second pair of eyes
  from any other contributor — "self-merge into a load-bearing path" is the
  pattern we are explicitly preventing

### What reviewers must check
- New shared component? It exports an explicit `Props` interface AND accepts `className?: string`
- View-model props (structural subsets), not raw DB row spreads — no `floor_price`,
  `seller_score`, `buyer_score`, `auto_accept_threshold` reaching the client
- Class composition uses the canonical `@/lib/utils/cn` — no inline `twMerge(clsx(...))`
- No duplicate variants of an existing primitive (e.g. a second `Button`)
- No new dependencies without team agreement
- Registry in `ENGINEERING.md` updated for new shared components
- `tsc`, `lint`, and `next build` all pass on the branch

### When a reviewer is unavailable
- Time-sensitive fixes can land with a single approver, but the reviewer is
  pinged immediately after merge and is expected to flag follow-ups
- Do not normalise this. It is the exception

---

## AI Session Start Protocol

When starting a AI coding tool session, give this prompt first:

```
Read the following files in this exact order before writing any code:
1. ENGINEERING.md — project rules, stack, design system, API conventions
2. docs/BRANCHING.md — branching rules, shared components registry, PR protocol
3. docs/context/[your-feature].md — current status, decisions, next steps
4. Any files you will modify today

Confirm the current git branch. Summarize what you understand before proceeding.
Do not write any code until I confirm your summary.

At the end of this session, remind me to sync the context files to dev before we close.
```

Replace `[your-feature]` with:
- `seller-flow` — Person 1
- `buyer-flow` — Person 2
- `admin-panel` — Person 3
- `payments-shipping` — Person 4

If your feature interacts with another feature's domain, read that context file too.