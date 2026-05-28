# Buyer Flow — Context File
**Owner:** Person 2
**Tool:** Kiro
**Branch:** feature/buyer-flow
**Last updated:** 2026-05-29

---

## What This Feature Does

Lets a buyer browse listings without an account, view product detail pages,
make purchases (fixed price or negotiated), track orders, manage watchlist
and saved searches, and raise disputes. Covers: homepage, browse page,
single listing page, checkout, order dashboard, watchlist, saved searches.

---

## Current Status

```
[x] Foundation session — branch created, dev verified buildable, shared component primitives in place
[x] cn utility extracted to canonical src/lib/utils/cn.ts (sole source of truth for class merging)
[x] ConditionBadge — color-coded grade pill (S/A/B/C/D), compact + full variants, sm/md sizes
[x] ListingCard — 4:3 cover, condition overlay, mono accent price, optional rating + city
[x] ListingGrid — 1/2/3/4-col responsive layout, loading skeletons, empty slot
[x] next.config.mjs — images.remotePatterns allows *.supabase.co/storage/v1/object/public/**
[x] Pre-existing scaffold lint errors fixed (page.tsx apostrophe, Card.tsx empty interface)
[x] dev is fully buildable: tsc clean, lint clean, prod build green
[ ] Mock dataset (src/lib/mock/{listings,users,offers}.ts) — realistic, messy, intentionally not "perfect"
[ ] Listings access boundary (src/lib/listings/browse.ts → getBrowseListings()) — UI must call this, not Supabase or mocks directly
[ ] /browse page — filter sidebar, sort, ListingGrid integration
[ ] Homepage integration — wire featured listings via getBrowseListings()
[ ] Single listing page (/listing/[id])
[ ] Account gate (modals/redirects on watchlist/offer/checkout intent)
[ ] Checkout, order tracking, watchlist, saved searches, disputes — defer
```

---

## Files Created This Session

```
src/lib/utils/cn.ts                            ✓ canonical class-name helper
src/components/listing/ConditionBadge.tsx      ✓ SHARED — see registry
src/components/listing/ListingCard.tsx         ✓ SHARED — see registry
src/components/listing/ListingGrid.tsx         ✓ SHARED — see registry
```

## Files Modified This Session

```
next.config.mjs                                ✓ images.remotePatterns for Supabase Storage
src/lib/utils/formatting.ts                    ✓ cn removed; only formatPrice + formatDate
src/components/{ui/Button,ui/Input,ui/Card,ui/Badge,ui/Spinner,layout/Nav}.tsx  ✓ cn import path updated
src/app/page.tsx                               ✓ apostrophe escape (lint fix)
src/components/ui/Card.tsx                     ✓ empty interface → type alias (lint fix)
ENGINEERING.md                                      ✓ build status + Shared Components Registry
```

---

## Files To Create (next)

```
src/lib/mock/listings.ts                       # Realistic, messy listing fixtures
src/lib/mock/users.ts                          # Seller fixtures referenced by listings
src/lib/mock/offers.ts                         # Offer fixtures (for buyer dashboard later)
src/lib/listings/browse.ts                     # getBrowseListings() — abstraction, mock-backed for now
src/app/(main)/page.tsx                        # Homepage — currently lives at src/app/page.tsx; move under (main) when route group is set up
src/app/(main)/browse/page.tsx                 # Browse + search + filters
src/app/(main)/listing/[id]/page.tsx           # Single listing page
src/app/(main)/listing/search/page.tsx         # Search results
src/app/(main)/buy/checkout/[listingId]/page.tsx
src/app/(main)/buy/confirm/[orderId]/page.tsx
src/app/(main)/orders/page.tsx
src/app/(main)/orders/[orderId]/page.tsx
src/app/(main)/orders/watchlist/page.tsx
src/app/(main)/orders/saved-searches/page.tsx
src/app/(main)/orders/disputes/page.tsx
src/components/listing/PriceHistory.tsx        # SHARED — listing detail + maybe seller dashboard
src/components/listing/PhotoGallery.tsx        # SHARED
src/components/listing/SellerCard.tsx          # SHARED
src/components/listing/AccessoryList.tsx       # SHARED — inclusions display
src/components/shared/TrackingTimeline.tsx     # SHARED — buyer + seller order views
src/components/shared/DisputeForm.tsx          # SHARED
src/components/shared/RatingPrompt.tsx         # SHARED
src/app/api/orders/route.ts
src/app/api/orders/[id]/route.ts
src/app/api/watchlist/route.ts
src/app/api/offers/route.ts
src/app/api/offers/[id]/route.ts
```

---

## Architectural Decisions Made (this session)

### 1. One canonical `cn` — `src/lib/utils/cn.ts`
The class-name helper (`clsx` + `tailwind-merge`) was previously co-located inside
`formatting.ts`. Extracted to its own module so there is one obvious home and no
ambiguity about where to import from. **Never duplicate this** — no inline
`twMerge(clsx(...))` anywhere else in the repo.

### 2. View-model props (structural subsets), not raw DB rows
UI components must NOT accept raw `Listing` rows. They accept a structural subset
designed for the view — `ListingCardData` is the first example. This prevents
server-only fields (`floor_price`, `auto_accept_threshold`, `seller_score`,
`buyer_score`) from accidentally leaking into client bundles or the DOM.

**Rule:** every shared listing component defines its own `*Data` view-model type
that omits server-only fields. Callers must map DB rows → view models at the
boundary (API route / server component), not pass them through.

### 3. Shared component prop convention
- Every shared component exports an explicit `interface ...Props` (or `type ...Props`).
  No anonymous prop typing.
- Every shared component accepts `className?: string`. No exceptions.
- Components are server components by default. Interactivity (e.g. watchlist
  save button) ships as a separate client island composed alongside, not baked
  into the shared primitive.
- Inputs are optional with sensible defaults; required props are the ones the
  component cannot meaningfully render without.

### 4. Listings access boundary (introduce next session)
UI must NOT read directly from Supabase or from mock files. All buyer-flow
listing reads go through `src/lib/listings/browse.ts` (or sibling files like
`detail.ts`, `search.ts`). Initial implementation can return mock data; later
swap in Supabase queries, then add caching/pagination, without touching UI.

```ts
// src/lib/listings/browse.ts (planned)
export async function getBrowseListings(filters: BrowseFilters): Promise<ListingCardData[]> { ... }
```

### 5. Mock data must be realistically messy
When building `src/lib/mock/listings.ts`, do not produce sanitised, perfect
fixtures. Include:
- missing accessories (incomplete `inclusions`)
- visible wear (lower grades, longer condition notes)
- mix of negotiable and fixed-price
- mix of cities (Mumbai, Bangalore, Delhi, Pune, Hyderabad, Kolkata, Chennai, Ahmedabad)
- mix of brands — popular (Sennheiser, Sony) and obscure (CCA, Tin HiFi)
- old models alongside new ones
- a few with single-photo coverage
- blank-rating sellers (new accounts)
- weird/short descriptions
"Perfect" data hides UI weaknesses we'll only discover with real listings.

### 6. `next/image` configured for Supabase Storage
Storage URLs follow `https://<project>.supabase.co/storage/v1/object/public/listings/...`.
`images.remotePatterns` whitelists `*.supabase.co` with the storage path prefix
so `<Image>` works across any Supabase project we ever connect (incl. previews).

### 7. Always-green dev
Pre-existing lint errors are fixed in the same PR that surfaces them, not punted
to a follow-up. `tsc`, `lint`, and `build` must all pass on `feature/*` and
`dev` at every commit. Do not normalise leaving `dev` red "for a few minutes" —
that mindset compounds.

---

## Database Tables This Feature Uses

| Table | Operation | Notes |
|-------|-----------|-------|
| listings | SELECT | Browse, search, listing page |
| products | SELECT | Product info on listing page |
| price_history | SELECT | Price history chart |
| offers | INSERT, SELECT | Submit and track offers |
| orders | INSERT, SELECT | Create and track orders |
| watchlist | INSERT, DELETE, SELECT | Save/unsave listings |
| saved_searches | INSERT, DELETE, SELECT | Manage search alerts |
| ratings | INSERT | Post-delivery rating |
| disputes | INSERT, SELECT | Raise and track disputes |
| users | SELECT | Seller profile on listing page |

---

## Key Business Logic To Implement

### Browse page filters
- Category: IEM / Headphone / DAC / Amp / DAC+Amp / Cable / Source
- Condition grade: S / A / B / C / D (multi-select)
- Price range: Under ₹5k / ₹5k-15k / ₹15k-30k / ₹30k+
- Negotiable only toggle
- Sort: Newest / Price ↑ / Price ↓ / Seller rating ↓ / Most viewed
- Default sort: Seller rating (higher rated sellers first)
- Only show listings with status = 'approved'

### Single listing page
- Photos: zoomable gallery, all required angles
- Condition grade badge (S/A/B/C/D) with color coding
- Inclusions: visual checklist (✓/✗ per item)
- Price history chart: sold prices for same model from price_history table
- Seller profile card: rating, review count, total sales, member since
- Similar listings: same category, same approximate price
- Negotiation slider: only shown if listing.is_negotiable = true
- NEVER show listing.floor_price to buyer — server must exclude it

### Account gate
- Browse and view listing: no account needed
- Add to watchlist: requires account (prompt to sign up)
- Submit offer: requires account
- Checkout: requires account
- Quick signup: phone + OTP only — 60 seconds
- Cart and offer preserved through signup flow

### Negotiation offer flow
- Slider range: show floor_price+buffer → asking_price (get range from server, not floor)
- Submit offer → server creates offer record with status 'pending'
- Seller has 24hrs to accept/decline
- If auto_accept_threshold met → auto-accept immediately
- On acceptance: buyer gets 24hr payment window
- Payment window shown as countdown in Active Offers dashboard
- On expiry: price resets for this buyer, listing stays live

### Parallel offers
- Multiple buyers can have active accepted offers simultaneously
- First to pay wins — listing status → 'reserved' → 'sold'
- Other buyers notified: "This listing was purchased by someone else"
- No "sale pending" indicator shown on listing page

### Checkout
- Address collection: name, line1, line2, city, pincode, state, phone
- Validate pincode against serviceable zones before payment
- Order summary: product price + shipping fee + total (no hidden fees)
- Payment via Razorpay (Person 4 owns the payment API)
- On success: order created, escrow held, seller notified

### Order tracking
- Telegram notification at every status change
- Full timeline: escrow held → shipped → at verifier → delivered
- 48hr inspection window starts on delivery
- Telegram reminder at 24hrs remaining
- Confirm button → triggers escrow release
- Auto-release if window expires without dispute

### Saved searches
- Save a search query with filters
- Instant Telegram alert when new matching listing goes live
- Cap: max 3 alerts per day per saved search
- If >3 matches: consolidate into one message
- Broad search warning at save time if likely to generate many alerts

### Watchlist
- Save specific listing
- Alert if price drops since saving
- Show price change indicator in watchlist view

---

## Components Marked SHARED

The following components in this feature are used by other features.
Build them generically and document their props clearly:

- `ListingCard` — homepage, browse, search, similar listings, watchlist
- `ListingGrid` — anywhere listings are shown in a grid
- `ConditionBadge` — everywhere a condition grade is shown
- `PriceHistory` — listing page, potentially seller dashboard
- `PhotoGallery` — listing page; admin review may reuse
- `SellerCard` — listing page, profile pages
- `AccessoryList` — listing page; admin and seller may reuse
- `TrackingTimeline` — buyer orders AND seller dashboard
- `DisputeForm` — buyer disputes, admin may reuse
- `RatingPrompt` — buyer post-delivery widget

---

## What Other Features Can Use From Here

| What | Path | Notes for other teams |
|------|------|-----------------------|
| `cn()` | `src/lib/utils/cn.ts` | The ONE class-name helper. Import from here only. Do not duplicate `clsx + tailwind-merge` anywhere else. |
| `ConditionBadge` | `src/components/listing/ConditionBadge.tsx` | Color-coded grade pill (S/A/B/C/D). Props: `grade`, `variant?: "compact" \| "full"`, `size?: "sm" \| "md"`, `className?`. Server component, no client hooks. |
| `ListingCard` | `src/components/listing/ListingCard.tsx` | Listing grid card. Accepts `ListingCardData` (NOT raw `Listing` — view-model subset that excludes `floor_price`, scores, etc). Wraps `next/image` (4:3) and links to `/listing/[slug \|\| id]`. Server component. |
| `ListingGrid` | `src/components/listing/ListingGrid.tsx` | Pure responsive grid. No data shape coupling. Has `loading` skeletons and customisable `empty` slot. |
| View-model rule | this file, "Architectural Decisions Made" §2 | Never spread raw DB rows into shared components. Map at the boundary. |
| Listings access boundary | `src/lib/listings/*` (upcoming) | All listing reads in buyer flow go through this layer. UI does not call Supabase directly. |

---

## Note For Kiro Users

This context file works the same way as an ENGINEERING.md.
At the start of each Kiro session:
1. Load ENGINEERING.md (global context)
2. Load BRANCHING.md (process + reviewer ownership rules)
3. Load this file (buyer flow context)
4. Load the specific files you'll edit today
5. Summarize understanding before writing code

---

## Known Blockers / Watch Out

- The `(main)` route group has no `layout.tsx` yet. The current homepage lives
  at `src/app/page.tsx` — when seller/buyer routes need shared layout
  (e.g. account-aware header decisions), a `src/app/(main)/layout.tsx` is needed.
  Coordinate with Person 1 (owns `Nav`) before introducing it.
- No real listings exist in the DB yet. UI development will run against mock
  data via `getBrowseListings()` until Person 1's seller flow + Person 3's
  approval queue produce approved listings end-to-end.
- `PATCH /api/offers/[id]` exists but is currently seller-side only (accept /
  decline). Buyer-side offer cancel needs new RLS policies — coordinate with
  Person 1 before adding.
- Per ENGINEERING.md, middleware protects `/sell/*` and `/dashboard`. Buyer routes
  that require auth (`/buy/*`, `/orders/*`) need to be added to the same
  middleware — do not create a parallel middleware.

---

## Next Session Starts Here

Foundation is in place and `dev` is buildable. Do these in order:

1. **Mock data infrastructure** — create:
   - `src/lib/mock/users.ts` — 6–8 sellers with mixed ratings (incl. 0/new), cities, names; one or two without `full_name`
   - `src/lib/mock/listings.ts` — ~12 listings of `ListingCardData` shape; mixed S/A/B/C/D, mixed negotiable, mixed photo counts (1 to 6), one or two with empty inclusions, realistic Indian-market brands. **Do not make them perfect** — see "Mock data must be realistically messy" above.
   - `src/lib/mock/offers.ts` — a few offer fixtures for the buyer dashboard later (defer if blocked)

2. **Access boundary** — `src/lib/listings/browse.ts`:
   - Export `getBrowseListings(filters: BrowseFilters): Promise<ListingCardData[]>`
   - Initial impl returns mock data; signature is the contract
   - Define `BrowseFilters` type colocated here (category[], condition[], priceBucket, negotiableOnly, sort)
   - UI calls this function only — never the mock files or Supabase directly

3. **`/browse` page** — `src/app/(main)/browse/page.tsx`:
   - Server component, calls `getBrowseListings()` with filters parsed from URL `searchParams`
   - Filter sidebar: category multi-select, condition multi-select, price bucket, negotiable toggle
   - Sort control: default Seller rating ↓
   - Renders `<ListingGrid>` with `<ListingCard>` children
   - Empty state when filters return zero results

4. **Wire homepage** to a small "Featured" strip using the same boundary
   (limit + sort by newest), to validate the abstraction in two places.

5. Update `ENGINEERING.md` build status row + Shared Components Registry as new
   primitives land. Sync to `dev` at end of session.

**Do not** start checkout, watchlist, saved searches, or any auth-gated buyer
flow until inventory display is solid against realistic mock data.

---

## Decisions Made In This Feature

- Browse requires no account — account only at purchase intent
- Quick signup at checkout: phone + OTP only
- Price history shows model-wide sold prices, not this listing's edits
- Negotiation slider range provided by server — floor never exposed
- No payment hold on offers — soft commitment only
- Watchlist alerts: price drop on saved listing
- Saved search alerts: instant Telegram, capped at 3/day
- Dispute reasons: condition_mismatch / non_functional / missing_accessory / not_received / wrong_item
- Rating prompt: 48hrs after escrow release, expires 7 days
- Auto-release escrow: if inspection window expires with no action
- One canonical `cn()` at `src/lib/utils/cn.ts` — no duplicates, ever
- Shared components export explicit prop interfaces and accept `className?: string`
- Shared components take view-model props, never raw DB rows
- Listing reads in buyer flow go through `src/lib/listings/*` access functions, not Supabase calls in UI
- Mock data must be intentionally messy — incomplete inclusions, varied condition, mixed cities/brands
- `dev` must always pass `tsc`, `lint`, and `next build`
