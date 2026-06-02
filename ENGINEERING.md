# Audiobaaz — AI coding tool Global Context

> Read this file at the start of EVERY session before writing any code.
> After reading, summarize what you understand before proceeding.

---

## What This Project Is

**Audiobaaz** is a managed secondhand audio gear marketplace for India.
- Parent company: **Lapidaria**
- Platform architecture: **StockMyNiche** (Audiobaaz is the first vertical)
- Inspiration: Grailed (editorial, dark, community-driven secondhand marketplace)
- V1 scope: Seller listing → Buyer purchase → Escrow → Direct shipping → Payout
- V2 scope (not yet built): Distributed merchant/verifier network

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (OTP only — no passwords) |
| Storage | Supabase Storage (listing photos) |
| Payments | Razorpay (test keys for V1) |
| Shipping | Shiprocket |
| Notifications | Telegram Bot API |
| Hosting | Dokploy (VPS) + Vercel |
| Node.js | **20** (`.node-version` in repo root — Nixpacks reads this) |
| Styling | Tailwind CSS + CSS variables |
| Language | TypeScript throughout |

---

## Critical Rules — Never Break These

### Money
- ALL money is stored in **PAISE** (₹ × 100). Never use floats for currency.
- ₹10,000 is stored as `1000000` in the database.
- Display formatting: divide by 100 and use `toLocaleString('en-IN')`
- Platform fee: **10%**. Seller receives 90% of paid_price.

### Database
- Schema lives in `/supabase/schema.sql` — never modify tables without updating this file
- All IDs are UUID — use `uuid_generate_v4()`
- All timestamps are `TIMESTAMPTZ` — never plain `TIMESTAMP`
- RLS (Row Level Security) is enabled on all tables
- Use `src/lib/supabase/server.ts` for API routes (server-side)
- Use `src/lib/supabase/client.ts` for React components (browser-side)
- Never use the service role key in client-side code

### Security
- `floor_price` on listings is NEVER exposed to buyers — server-side only
- `seller_score` and `buyer_score` are internal — never shown publicly
- Admin routes (`/admin/*`) check for `role === 'admin'` in middleware

### Listing Status Flow
```
draft → pending → approved → reserved → sold → completed
                           ↘ rejected (back to editing)
                                       ↘ delisted (seller removes)
```

### Offer Status Flow
```
pending → accepted → paid
        ↘ declined
        ↘ expired (no seller response in 24hrs)
        ↘ cancelled (buyer retracted before acceptance)
```

### Order Status Flow
```
payment_pending → escrow_held → shipped → delivered →
inspection → completed
                              ↘ disputed → resolved
                              ↘ refunded
```

> **Source of truth:** `docs/context/payments-shipping.md` is canonical
> for the offer enum, the order state machine (incl. branches), the
> offer→order handoff at `paid`, escrow timing, race-condition handling,
> and refund flow. The two diagrams above are summary views; if they
> disagree with `payments-shipping.md`, the context file wins. Update
> both together.

---

## Design System

### Colors (use CSS variables — defined in globals.css)
```css
--bg: #0F0F0F
--surface: #1A1A1A
--surface-2: #222222
--border: #333333
--text: #F0F0F0
--text-2: #999999
--accent: #E8FF4D        /* electric yellow-green — primary CTA */
--success: #4DFF91
--error: #FF4D4D
--warning: #FFB84D
```

### Fonts
- Headings: **Syne** (geometric, technical)
- Body: **DM Sans** (clean, readable)
- Prices/codes: **JetBrains Mono**

### Condition Grade Colors
```
S — Sealed:    #E8FF4D (accent)
A — Mint:      #4DFF91 (success)
B — Excellent: #4D9FFF (blue)
C — Good:      #FFB84D (warning)
D — Fair:      #FF4D4D (error)
```

---

## Directory Structure (Key Paths)

```
src/
├── app/
│   ├── (auth)/login/          # OTP login
│   ├── (main)/
│   │   ├── page.tsx           # Homepage
│   │   ├── browse/            # Browse listings
│   │   ├── listing/[id]/      # Single listing page
│   │   ├── sell/              # Seller flow (Person 1)
│   │   ├── dashboard/         # Seller dashboard (Person 1)
│   │   ├── buy/               # Buyer checkout (Person 2)
│   │   ├── orders/            # Buyer dashboard (Person 2)
│   │   └── merchant/          # V2 placeholder (empty)
│   ├── admin/                 # Admin panel (Person 3)
│   └── api/                   # Backend routes (Person 4)
├── components/
│   ├── ui/                    # Base components — Button, Input, Card etc
│   ├── listing/               # Listing-specific components
│   ├── forms/                 # Form components
│   ├── layout/                # Nav, Footer, Sidebar
│   └── shared/                # Cross-feature components
├── lib/
│   ├── supabase/              # client.ts, server.ts, admin.ts
│   ├── razorpay/
│   ├── shiprocket/
│   └── telegram/
├── hooks/                     # Custom React hooks
└── types/                     # TypeScript types — shared
```

---

## Database Tables (V1)

| Table | Purpose |
|-------|---------|
| `users` | All users — buyers, sellers, admins |
| `products` | Product catalogue — grows over time |
| `listings` | Seller listings |
| `price_history` | Sold prices — market intelligence |
| `offers` | Negotiation offers |
| `orders` | Confirmed orders with escrow |
| `payments` | Razorpay payment records |
| `disputes` | Buyer disputes |
| `ratings` | Post-sale ratings |
| `watchlist` | Saved listings |
| `saved_searches` | Saved search alerts |
| `notifications` | Telegram message log |
| `listing_reviews` | Admin review log |

Full schema: `/supabase/schema.sql`

---

## Locked Product Decisions

These are final. Do not suggest alternatives.

- No counter-offers — seller can only accept or decline
- Negotiation floor price is NEVER shown to buyers
- Parallel negotiations allowed — first buyer to pay wins
- Photo minimum resolution: 1200×900px — enforced client-side
- No automated OCR on photos — manual admin review only
- Listings stay live indefinitely — no auto-delist
- 48hr buyer inspection window — escrow auto-releases on expiry
- Telegram for all notifications — not WhatsApp or email
- Saved search alerts capped at 3 per day per search
- Offer retraction allowed before seller accepts
- No payment hold on offers — reputation is accountability
- Reserve listing for 15 minutes when checkout starts
- Seller packing video — mandatory before shipping
- Rating prompt sent 48hrs after escrow release
- Rating prompt expires after 7 days

---

## Current Build Status

> **Launch focus:** see `docs/V1-LAUNCH.md` for the bounded checklist
> from "where the codebase is today" to "shippable V1 marketplace."
> Anything not on that list is V2 by definition until V1 ships.

| Person | Tool | Feature | Status |
|--------|------|---------|--------|
| Person 1 | AI coding tool | Seller flow + dashboard | COMPLETE — onboarding, nav profile menu, rejected listings tab, resubmit flow, Google OAuth on login page (commit 15ff3f1). Magic-link OTP retained as fallback. See docs/context/seller-flow.md |
| Person 2 | Kiro | Buyer flow + listing page | READY TO MERGE — full lifecycle tested on `feature/order-lifecycle-shipping`: checkout (dev simulator) → escrow → seller shipment → tracking → delivery → inspection → confirm receipt (completed) + dispute flow. tsc + next build clean. Pending: Vercel env var `PAYMENT_PROVIDER=dev` for dev.audiobaaz.com, Supabase CLI setup for migration tracking. See docs/context/buyer-flow.md |
| Person 3 | - | Admin panel | MERGED to dev — core panel complete (listings review, disputes, users, payouts queue + history). Orders monitor remains a stub. Vercel build lint failures resolved in commit e0d84e4. See docs/context/admin-panel.md |
| Person 4 | AI coding tool | Payments + shipping | VALIDATED — lifecycle runbook scenarios A–H all pass on `ui.audiobaaz.com` (2026-06-02). All transaction-engine code lives on `feature/order-lifecycle-shipping` (absorbed into `feature/ui-redesign`). Ready to merge. See docs/context/payments-shipping.md, docs/reviews/lifecycle-validation-results.md, and docs/V1-LAUNCH.md. |
| Project | — | Deployment + domain + auth infrastructure | LIVE — production at audiobaaz.com, dev at dev.audiobaaz.com, both on Vercel with Cloudflare DNS + Email Routing. Magic-link + Google OAuth wired through Supabase. See docs/DEPLOYMENT.md |
| Design | AI coding tool | UI redesign exploration | VALIDATED — lifecycle runbook scenarios A–H all pass on `ui.audiobaaz.com` (2026-06-02). Ready to merge `feature/ui-redesign → dev`. See docs/context/ui-redesign.md and docs/reviews/lifecycle-validation-results.md |

> Update this table when features change status.

---

## CURRENT REPOSITORY STATE — 2026-05-30

### Active development branch

**`feature/order-lifecycle-shipping`** — single source of truth for all
remaining V1 transaction-engine work (payments, shipping, escrow
lifecycle, order timeline, admin operations).

### Branches and PRs

| Branch | State | Notes |
|--------|-------|-------|
| `main` | release | Production. Auto-deploys to audiobaaz.com. |
| `dev` | integration | Auto-deploys to dev.audiobaaz.com. Tip: `7b294e9` (PR #3 merge). |
| `feature/order-lifecycle-shipping` | **ACTIVE** | All remaining V1 transaction-engine work lands here. Tip: `d2f9bc6`. Branched off `dev`; cherry-picked the CheckoutForm wiring from PR #4. **Migration 007 + RPC paths validated against real local Postgres 16; smoke tests at `supabase/tests/{lifecycle_smoke,refund_lifecycle_smoke}.sql`.** |
| `feature/checkout-razorpay-wire` | **SUPERSEDED** | PR #4 OPEN. Code (CheckoutForm wiring + mock removal) lives in `feature/order-lifecycle-shipping` as commit `5ae8cd7` (cherry-pick of `413bc77`). Recommendation: **close PR #4 without merging; delete branch after the active branch lands.** |
| `feature/payment-routes` | **MERGED** | Merged via PR #3. Zero commits ahead of `dev`. Safe to delete. |
| `feature/payments-shipping` | **MERGED** | Merged via PR #2. Zero commits ahead of `dev`. Safe to delete. |
| `feature/buyer-flow` | **MERGED** | Earlier merge. Zero commits ahead of `dev`. Safe to delete. |
| `feature/ui-redesign` | **READY TO MERGE** | Superset of `feature/order-lifecycle-shipping`. Lifecycle validation complete (2026-06-02). Merge to `dev` as single PR. |
| `feature/admin-panel`, `feature/seller-flow` | historical | Remote-only. Pre-V1 history; defer cleanup. |

### Status by capability

| Capability | State | Where |
|------------|-------|-------|
| Schema (Phase 1) | ✅ on `dev` | migrations 001–006 |
| Razorpay routes (Phase 2) | ✅ on `dev` | `src/app/api/payments/{create,verify,webhook}` |
| CheckoutForm → Razorpay modal | ✅ on `feature/order-lifecycle-shipping` | `src/app/buy/checkout/[listingId]/CheckoutForm.tsx` |
| `PaymentProvider` abstraction | ✅ on `feature/order-lifecycle-shipping` | `src/lib/payments/{provider,razorpay,dev,factory}.ts` |
| `DevPaymentProvider` | ✅ on `feature/order-lifecycle-shipping` | `src/lib/payments/dev.ts`; selected via `PAYMENT_PROVIDER=dev` (non-prod only) |
| Dev payment simulator | ✅ on `feature/order-lifecycle-shipping` | `/api/dev/payments/simulate`, `/api/dev/payments/webhook-replay` |
| `ShippingProvider` abstraction | ✅ on `feature/order-lifecycle-shipping` | `src/lib/shipping/{provider,mock,factory}.ts` |
| `MockShippingProvider` | ✅ on `feature/order-lifecycle-shipping` | `src/lib/shipping/mock.ts` |
| Shipping schema (migration 007) | ✅ on `feature/order-lifecycle-shipping` | `shipments`, `shipment_events`, `mock_shipments`, `record_shipment_created`, `record_shipment_status_change` |
| Shipping routes | ✅ on `feature/order-lifecycle-shipping` | `/api/shipping/{create,track}`, `/api/dev/shipping/advance` |
| Seller shipment flow UI | ✅ on `feature/order-lifecycle-shipping` | `/dashboard/orders/[orderId]` with `CreateShipmentButton` + `AdvanceShipmentButton` |
| Order timeline UI | ✅ on `feature/order-lifecycle-shipping` | `OrderTimeline` + `ShipmentTracking` components on buyer + seller detail pages |
| DB-layer smoke tests | ✅ on `feature/order-lifecycle-shipping` | `supabase/tests/lifecycle_smoke.sql` + `refund_lifecycle_smoke.sql`. Migration 007 RPCs + race-loser refund path validated against real local Postgres 16. |
| Real Razorpay validation | ❌ blocked on credentials | Not on critical path — `DevPaymentProvider` covers the gap |
| Real Shiprocket validation | ❌ blocked on credentials | Not on critical path — `MockShippingProvider` covers the gap |
| `ShiprocketProvider` impl | ❌ deferred until credentials land | Slot exists in factory; throws on selection |
| Admin operations (refund button, payout reference, orders monitor) | ❌ not started | Next implementation task on the active branch |
| Closed beta | ❌ not started | After admin ops |

### Build status

`next build` GREEN on `feature/order-lifecycle-shipping`. All 22 API
routes compile. TypeScript + lint clean.

### Pre-merge gates

- Audit: `docs/reviews/order-lifecycle-shipping-audit.md` — ✅ five bugs surfaced, all fixed (4 by audit, 1 by smoke).
- Validation runbook: `docs/reviews/lifecycle-validation-runbook.md` — ✅ written.
- DB-layer smoke: `supabase/tests/{lifecycle_smoke,refund_lifecycle_smoke}.sql` — ✅ passing on real local Postgres 16.
- Validation results: `docs/reviews/lifecycle-validation-results.md` — ✅ all 8 scenarios pass (run against `ui.audiobaaz.com` 2026-06-02).

**Gate is closed. `feature/ui-redesign` is ready to merge to `dev`.**

---

## BRANCH STRATEGY (remaining V1)

**Rule 1 — One active branch.**
All payments / shipping / order-lifecycle / admin-operations work goes
on `feature/order-lifecycle-shipping`. Do not branch a sibling for
"the timeline" or "the admin pages" or "the Shiprocket swap." If a
genuine cross-cutting concern surfaces (e.g. a Phase 1.5 schema
amendment that touches Phase 2 routes), it ships on the same branch.

**Rule 2 — PR #4 is closed without merging.**
The CheckoutForm wiring + `/api/checkout/mock` removal already exist
on the active branch as commit `5ae8cd7` (cherry-pick of `413bc77`).
Merging PR #4 separately would create a phantom commit pair that
either git would deduplicate noisily or that would cause spurious
conflicts. Close PR #4; delete `feature/checkout-razorpay-wire`
after the active branch merges.

**Rule 3 — Merged branches are deleted.**
After this audit, delete `feature/payment-routes`,
`feature/payments-shipping`, and `feature/buyer-flow` from the
remote (they have zero commits ahead of `dev`). Local copies can
be removed at the engineer's convenience.

**Rule 4 — One PR for the active branch.**
When `feature/order-lifecycle-shipping` is ready, it opens as a
single PR against `dev`. The PR is large by design — payments,
shipping, lifecycle, timeline, and admin operations are tightly
coupled. Splitting them into smaller PRs would require designing
intermediate commits that don't actually represent a usable
marketplace state.

**Rule 5 — Real-credential swaps are post-merge.**
When Razorpay or Shiprocket credentials arrive, swap-in branches
(`feature/shiprocket-provider`, `feature/razorpay-go-live`) are
separate, surgical, and small. The provider abstractions exist
specifically to make those swaps small.

---

## Development Utilities

### Dev sign-in bypass (email rate limit workaround)
- Route: `POST /api/dev/sign-in` — blocked in production (`NODE_ENV === 'production'`)
- Usage: on the `/login` page, enter any email and click **⚡ Dev: sign in without email**
- Uses admin client to generate a magic link server-side without sending an email
- Full auth flow still runs (onboarding check, session creation, redirects)
- Use this whenever Supabase's email rate limit is hit during testing

### Deployment + domains + auth infrastructure
- Production: https://audiobaaz.com — auto-deploys from `main`
- Development: https://dev.audiobaaz.com — auto-deploys from `dev`
- DNS + email routing: Cloudflare. SPF / DKIM / DMARC configured.
- Supabase Auth providers enabled: Email magic link (primary fallback) + Google OAuth (preferred long-term)
- Public support address: hello@audiobaaz.com
- Full runbook (incidents, redirect URLs, lessons learned, troubleshooting): `docs/DEPLOYMENT.md`

---

## API Conventions

- All API routes in `/src/app/api/`
- Response format:
```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { message: string, code: string } }
```
- Always validate request body before database operations
- Always check auth in API routes using Supabase server client
- HTTP methods: GET (read), POST (create), PATCH (update), DELETE (remove)

---

## AI Session Start Protocol

**Every person, every session — give this prompt to your AI agent:**

> Read the following files in this exact order before writing any code:
> 1. `ENGINEERING.md` — project rules, stack, design system, API conventions, money rules
> 2. `docs/BRANCHING.md` — branching rules, shared components registry, PR protocol
> 3. `docs/context/[your-feature].md` — your feature's current status, decisions, next steps
> 4. Any files you will modify today
>
> Confirm the current git branch. Summarize what you understand before proceeding.
> Do not write any code until I confirm your summary.
>
> At the end of this session, remind me to sync the context files to dev before we close.

**Feature context files:**
- Person 1 (seller): `docs/context/seller-flow.md`
- Person 2 (buyer): `docs/context/buyer-flow.md`
- Person 3 (admin): `docs/context/admin-panel.md`
- Person 4 (payments): `docs/context/payments-shipping.md`

**If your feature touches another person's domain** (e.g. admin reading listings, buyer making offers), also read that feature's context file.

---

## How to Start Each Session

1. `git checkout feature/[your-branch]`
2. `git pull origin dev`
3. Give the AI the session start prompt above
4. AI reads files, summarises, confirms branch — then you proceed

## How to End Each Session

1. Update `docs/context/[your-feature].md` with current status + next session pointer
2. Update "Current Build Status" table in this file
3. Commit and push to your feature branch
4. Sync docs to dev (docs-only direct commit is allowed):
   ```bash
   git checkout dev
   git checkout feature/[your-branch] -- ENGINEERING.md docs/context/[your-feature].md
   git add ENGINEERING.md docs/context/[your-feature].md
   git commit -m "docs: sync [feature] context to dev"
   git push origin dev
   git checkout feature/[your-branch]
   ```
5. Never leave uncommitted changes overnight

---

## Shared Components Registry

Components modified or created that affect multiple features. If you use or modify these, read the notes and announce changes in team chat.

| Component | Path | Owner | Notes |
|-----------|------|-------|-------|
| `Nav` | `src/components/layout/Nav.tsx` | Person 1 | Auth-aware — shows Dashboard + New Listing when logged in, Log in + Sell With Us when logged out. Imports `createClient` from supabase/server (server component). |
| `ListingForm` | `src/components/forms/ListingForm.tsx` | Person 1 | 6-step listing intake form. Accepts `draftId?` and `initialData?` props. Used by `/sell/new` and `/sell/draft/[id]`. |
| `DashboardNav` | `src/components/layout/DashboardNav.tsx` | Person 1 | Seller dashboard sidebar. Client component, uses `usePathname`. |
| `AdminNav` | `src/components/layout/AdminNav.tsx` | Person 3 | Admin panel sidebar. Used inside `src/app/admin/layout.tsx`. |
| `Button` | `src/components/ui/Button.tsx` | Scaffold | Primary, secondary, ghost, danger variants. sm/md/lg sizes. |
| `Card` | `src/components/ui/Card.tsx` | Scaffold | Basic surface card. Accepts all div props. |
| `cn` | `src/lib/utils/cn.ts` | Scaffold | Canonical class-name helper (`clsx` + `tailwind-merge`). The ONLY place to import `cn` from. Do not duplicate. |
| Buyer view-models | `src/lib/listings/types.ts` | Person 2 | Canonical home for `ListingCardData`, `ListingDetailData`, `SellerCardData`, `BrowseFilters`, `BrowseSort`, `PriceBucket`. One import path per type — no re-exports from component or access-function files. View-models are intentionally lossy; server-only fields (`floor_price`, scores, contact data) cannot be members. |
| `ConditionBadge` | `src/components/listing/ConditionBadge.tsx` | Person 2 | Color-coded grade pill (S/A/B/C/D). Props: `grade`, `variant?: "compact" \| "full"`, `size?: "sm" \| "md"`, `className?`. Server component. |
| `ListingCard` | `src/components/listing/ListingCard.tsx` | Person 2 | Listing grid card. Props: `listing: ListingCardData`, `priority?`, `className?`. `ListingCardData` is a structural subset of `Listing` — never pass server-only fields like `floor_price`. Wraps `next/image` (4:3 cover) and links to `/listing/[slug \|\| id]`. Server component. |
| `ListingGrid` | `src/components/listing/ListingGrid.tsx` | Person 2 | Responsive grid (1/2/3/4 cols). Props: `children?`, `loading?`, `skeletonCount?`, `empty?`, `className?`. Pure layout — no data shape coupling. |
| `PhotoGallery` | `src/components/listing/PhotoGallery.tsx` | Person 2 | Listing detail photo gallery. Props: `photos: string[]`, `alt: string`, `className?`. Server-component shell + small client island (`PhotoGalleryView`) for active-photo state. No lightbox/zoom yet. |
| `SellerCard` | `src/components/listing/SellerCard.tsx` | Person 2 | Public seller summary. Props: `seller: SellerCardData`, `className?`. `SellerCardData` is a strict subset (full_name, city, rating, rating_count, member_since) — never spread a raw `User` row. Server component. |
| `AccessoryList` | `src/components/listing/AccessoryList.tsx` | Person 2 | ✓/✗ checklist of inclusions. Props: `inclusions: Record<string, boolean>`, `className?`. Server component. |
| Offer view-models | `src/lib/offers/types.ts` | Person 2 | Canonical home for `OfferRange`, `OfferDraftData`, `OfferStatus`, `OfferSummary`, `OfferDetailData`. Same intentionally-lossy rules as the listings types module — `floor_price`, `auto_accept_threshold`, scores, contact data cannot be members. Offers and listings are separate domains; do not fold types together. |
| Offer state machine | `src/lib/offers/state.ts` | Person 2 | Pure module — single source of truth for offer transitions and predicates. Anywhere a UI needs "can the buyer cancel?" / "can the seller accept?", call the predicates here. Display helpers (`buyerStatusLabel`, `statusToneToken`) are buyer-side; seller surfaces should ship a sibling label helper but reuse the same tone tokens. |
| `OfferStatusBadge` | `src/components/offers/OfferStatusBadge.tsx` | Person 2 | Buyer-facing offer status pill — `<Badge variant={statusToneToken(status)}>{buyerStatusLabel(status)}</Badge>`. Server component. |
| `OfferAmountInput` | `src/components/offers/OfferAmountInput.tsx` | Person 2 | Slider + numeric input for offer composition. Client island. Validates against `OfferRange` via `validateOfferAmount()`. Hidden input is what the form submits. |

---

## Project-Level Known Issues

Cross-feature blockers tracked here so individual feature context files don't
re-document them. Add to this section only when the issue affects more than
one feature or the project as a whole.

### CI gate for `tsc + lint + build` on PRs into `dev` (project)

The earlier admin-panel lint failure was resolved in commit `e0d84e4`
(replaced 12 `as any` Supabase relation casts with a typed `pickOne<T>`
helper at `src/lib/utils/relations.ts`; removed an unused `router` in
onboarding). `next build` is green on `dev` today and Vercel deploys
both `dev` (→ dev.audiobaaz.com) and `main` (→ audiobaaz.com) cleanly.

The systemic gap remains: no CI gate enforces `tsc + lint + build` on
PRs into `dev`. Until one exists, always-green-dev relies on developer
discipline alone. A CI workflow on PRs into `dev` is the right durable
fix; tracked as a project-level follow-up.

---

## Contact / Ownership

- Repo: github.com/audiobaaz/audiobaaz
- Production: https://audiobaaz.com (also www.audiobaaz.com → 308 redirect to apex)
- Development: https://dev.audiobaaz.com (auto-deploy from `dev` branch)
- Public support email: hello@audiobaaz.com (Cloudflare Email Routing)
- Parent company: Lapidaria
- Platform: StockMyNiche
- Product: Audiobaaz
