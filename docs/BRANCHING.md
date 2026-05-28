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

1. Never commit directly to `main` or `dev`
2. Always pull from `dev` before starting work
3. One PR per completed feature/sub-feature — not one giant PR
4. Update your context file before every PR
5. If you touch a SHARED component — announce it to the team

---

## Shared Components Rule

Components in these folders are used by everyone:
- `src/components/ui/`
- `src/components/shared/`
- `src/components/listing/`
If you create or modify a shared component:
1. Document its props clearly with TypeScript
2. Post in team chat: "Added ListingCard — import from components/listing/ListingCard"
3. Update your context file's "What other features can use from here" section