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

## AI Session Start Protocol

When starting a AI coding tool session, give this prompt first:

```
Read the following files in this exact order before writing any code:
1. ENGINEERING.md — project rules, stack, design system, API conventions
2. docs/BRANCHING.md — branching rules, shared components registry, PR protocol
3. docs/context/[your-feature].md — current status, decisions, next steps
4. Any files you will modify today

Confirm the current git branch. Summarize what you understand before proceeding.
```

Replace `[your-feature]` with:
- `seller-flow` — Person 1
- `buyer-flow` — Person 2
- `admin-panel` — Person 3
- `payments-shipping` — Person 4

If your feature interacts with another feature's domain, read that context file too.