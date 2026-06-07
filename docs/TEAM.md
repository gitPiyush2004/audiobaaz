# Audiobaaz — Team Onboarding Summary

Welcome to the team. Read this first. It covers what we're building, how the
team works, and exactly what to do when you sit down to work.

---

## What We're Building

Audiobaaz is a managed secondhand audio gear marketplace for India.
Sellers list their used headphones, DACs, amps, speakers, and cables.
Buyers browse and purchase. Audiobaaz sits in the middle — verifying
listings, holding payments in escrow, coordinating shipping, and resolving
disputes.

**The full sale flow:**
1. Seller submits a listing → admin reviews and approves
2. Buyer sees the listing → pays or makes an offer
3. Money held in escrow via Razorpay
4. Seller ships via Shiprocket
5. Buyer gets 48hrs to inspect
6. Buyer confirms → seller gets paid
7. Both rate each other

---

## Tech Stack

| What | Tool |
|------|------|
| Website | Next.js 14 (App Router), TypeScript |
| Database + Auth + Storage | Supabase |
| Payments | Razorpay |
| Shipping | Shiprocket |
| Notifications | Telegram Bot |
| Styling | Tailwind CSS |

Login is email magic-link + Google OAuth via Supabase Auth. No passwords.
All prices are stored in **paise** (₹1 = 100 paise). Never use floats for money.

---

## The Team

| Person | Tool | What They Build | Branch (history) |
|--------|------|-----------------|------------------|
| 1 | AI coding tool | Seller flow — listing intake, seller dashboard, shipment flow | `feature/seller-flow` (merged); active work on `feature/order-lifecycle-shipping` |
| 2 | Kiro | Buyer flow — browse, listing page, checkout, orders, timeline | `feature/buyer-flow` (merged); active work on `feature/order-lifecycle-shipping` |
| 3 | — | Admin panel — review listings, resolve disputes, payouts, orders monitor | merged; orders monitor + dispute→refund wiring pending on `feature/order-lifecycle-shipping` |
| 4 | AI coding tool | Payments + shipping — Razorpay + Shiprocket integrations behind provider abstractions | `feature/payments-shipping` (merged via PR #2), `feature/payment-routes` (merged via PR #3); active work on `feature/order-lifecycle-shipping` |

> The remaining V1 transaction-engine work (admin operations, real
> credentials swap, closed beta) is consolidated on a single active
> branch: **`feature/order-lifecycle-shipping`**. See `docs/BRANCHING.md`
> for the full branch state and rules.

---

## How Branches Work

```
main    → stable only. never commit here directly.
  └── dev   → integration. all features merge here first.
        └── feature/order-lifecycle-shipping   ← ACTIVE
                                                 (single branch for all
                                                  remaining V1 work)
```

Earlier per-feature branches (`feature/seller-flow`, `feature/buyer-flow`,
`feature/admin-panel`, `feature/payment-routes`, `feature/payments-shipping`)
are merged-ancestor branches — zero commits ahead of `dev`. Active V1
work is now consolidated. See `docs/BRANCHING.md` for the audit and
deletion plan.

You work on the active branch. When a chunk is done, open a Pull
Request on GitHub from your branch → `dev`. Someone reviews it and
merges it. Then everyone pulls from `dev`.

**Never commit directly to `dev` or `main`.**

---

## Starting Your First Session

```bash
# 1. Clone the repo (first time only)
git clone https://github.com/audiobaaz/audiobaaz.git
cd audiobaaz

# 2. Install dependencies
npm install

# 3. Copy env file and fill in your values
cp .env.example .env.local
# For local validation without Razorpay credentials, also set:
#   PAYMENT_PROVIDER=dev
# (See docs/DEPLOYMENT.md for the full env-var reference.)

# 4. Switch to the active branch
git checkout dev
git pull
git checkout feature/order-lifecycle-shipping
git pull
```

---

## Starting Every Session After That

```bash
# 1. Switch to the active branch
git checkout feature/order-lifecycle-shipping

# 2. Pull latest
git pull

# 3. Open your AI tool (AI coding tool)
# 4. Load ENGINEERING.md + docs/BRANCHING.md + docs/V1-LAUNCH.md +
#    docs/context/<your-feature>.md
# 5. Build
```

---

## The Two Files You Must Read Every Session

**1. `ENGINEERING.md`** — global rules for the whole project. Money handling,
database rules, status flows, design system, security rules. Everyone reads
this. Nobody breaks these rules.

**2. `docs/context/your-feature.md`** — your personal context file. What
you're building, where you left off, what decisions have already been made,
and exactly what to build next. This is your memory between sessions.

At the start of every session, tell your AI tool:
> *"Read ENGINEERING.md and docs/context/[your-file].md. Tell me what you
> understand before writing any code."*

---

## Ending Every Session

```bash
# 1. Update your context file in docs/context/
#    — mark what's done
#    — write the "Next Session Starts Here" section

# 2. Update the build status table in ENGINEERING.md if a feature changed state

# 3. Verify .kiro/ and .vscode/ are NOT staged (they're local editor state)
git status

# 4. Commit and push
git add -A   # or stage explicit paths if you have unrelated changes
git commit -m "feat(scope): one-line summary of what shipped"
git push
```

**Never leave uncommitted work at the end of a session.**

---

## Commit Message Format

```
feat(scope):  something new you built
fix(scope):   something broken you fixed
chore(scope): config, setup, no user-facing change

Examples:
feat(seller): add photo upload with resolution validation
feat(buyer): build listing card component
fix(payments): handle Razorpay webhook signature mismatch
chore(db): add tracking_number index to orders table
```

---

## Shared Components Rule

These folders are used by everyone:
- `src/components/ui/` — base components (Button, Input, Card, etc.)
- `src/components/shared/` — cross-feature components
- `src/components/listing/` — listing display components

If you create or change something in these folders:
1. Keep the TypeScript props clean and documented
2. Tell the team in chat: *"Added ListingCard — import from components/listing/ListingCard"*
3. Update your context file's "What other features can use from here" section

---

## Context Files

Each feature has a context file in `docs/context/`:

| File | Owner |
|------|-------|
| `docs/context/seller-flow.md` | Person 1 |
| `docs/context/buyer-flow.md` | Person 2 |
| `docs/context/admin-panel.md` | Person 3 |
| `docs/context/payments-shipping.md` | Person 4 |

Each file has a **"Next Session Starts Here"** section at the bottom.
That's where you pick up. That's where you leave off. Keep it updated.

---

## Database

The full schema is in `supabase/schema.sql`. To set it up:
1. Create a project at supabase.com
2. Go to SQL Editor → paste the entire contents of `supabase/schema.sql` → Run
3. Go to Storage → create a bucket named `listings` (public, 10MB limit)

Key tables:

| Table | What it stores |
|-------|---------------|
| `users` | Everyone — buyers, sellers, admins |
| `listings` | Items for sale |
| `offers` | Buyer negotiation offers |
| `orders` | Confirmed purchases with escrow |
| `payments` | Razorpay records |
| `disputes` | Problems raised after delivery |
| `ratings` | Post-sale star ratings |
| `products` | Product catalogue for search |
| `price_history` | Historical sold prices |

---

## Key Rules — Never Break These

- All money in **paise**. ₹10,000 = `1000000`. Never floats.
- Platform fee is **10%**. Seller gets 90%.
- `floor_price` on listings **never goes to the client**. Server-side only.
- `seller_score` and `buyer_score` are internal. Never show publicly.
- Admin routes `/admin/*` check `role === 'admin'` server-side.
- Supabase service role key: **never in client-side code**.
- All notifications via **Telegram only**. No email, no WhatsApp.
- No counter-offers. Seller can only accept or decline.
- Listing reserved for **15 minutes** when checkout starts (DB trigger).
- Buyer has **48 hours** to inspect after delivery.

---

## Where Everything Lives

```
ENGINEERING.md              → global rules — read every session
README.md              → project overview + how to run locally
docs/V1-LAUNCH.md      → launch checklist
docs/BRANCHING.md      → git workflow + branch strategy
docs/DEPLOYMENT.md     → hosting, domains, env vars, deploy runbooks
docs/TEAM.md           → this file
docs/context/          → per-feature context files
docs/integrations/     → Razorpay + Shiprocket reference (we wrap these via Provider abstractions)
docs/reviews/          → audits + runbooks
supabase/schema.sql    → base schema
supabase/migrations/   → 001 → 007 (Phase 1 + shipping substrate)
supabase/tests/        → SQL acceptance + smoke tests
src/app/               → all pages
src/components/        → all UI components
src/lib/payments/      → PaymentProvider abstraction (RazorpayPaymentProvider + DevPaymentProvider)
src/lib/shipping/      → ShippingProvider abstraction (MockShippingProvider; ShiprocketProvider deferred)
src/lib/supabase/      → server / client / admin clients
src/lib/listings/      → buyer-domain access boundary
src/lib/offers/        → offer-domain access boundary + state machine
src/lib/telegram/      → notification helpers
src/types/             → TypeScript types for everything
src/hooks/             → custom React hooks (when needed)
src/store/             → global state (Zustand, when needed)
```

---

## Questions?

Read `ENGINEERING.md` first — most answers are there.
For anything not covered, ask in team chat.
