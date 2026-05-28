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
[x] Buyer-flow files are tsc + lint clean; production build compiles successfully
[x] Mock dataset (src/lib/mock/{listings,users}.ts) — realistic, messy, intentionally not "perfect"
[x] Listings access boundary — src/lib/listings/browse.ts → getBrowseListings()
[x] /browse page — URL-driven filter sidebar, sort, ListingGrid integration
[x] Homepage integration — featured strip wired via getBrowseListings({ sort: "newest", limit: 4 })
[ ] src/lib/mock/offers.ts — offer fixtures for buyer dashboard (defer until needed)
[ ] Single listing page (/listing/[slug])
[ ] PhotoGallery, SellerCard, AccessoryList shared components
[ ] getListingDetail() access boundary
[ ] Account gate (modals/redirects on watchlist/offer/checkout intent)
[ ] Checkout, order tracking, watchlist, saved searches, disputes — defer
```

---

## Files Created This Session

### Foundation slice (primitives + lint + docs)

```
src/lib/utils/cn.ts                            ✓ canonical class-name helper
src/components/listing/ConditionBadge.tsx      ✓ SHARED — see registry
src/components/listing/ListingCard.tsx         ✓ SHARED — see registry
src/components/listing/ListingGrid.tsx         ✓ SHARED — see registry
```

### Browse slice (mock data + access boundary + UI)

```
src/lib/mock/users.ts                          ✓ 8 sellers (view-model only — no scores, phone, UPI)
src/lib/mock/listings.ts                       ✓ 12 listings, ListingCardData-shaped, intentionally messy
src/lib/listings/browse.ts                     ✓ getBrowseListings() + BrowseFilters/Sort + parseBrowseSearchParams
src/app/browse/page.tsx                        ✓ Server component, URL-driven filters and sort
```

## Files Modified This Session

```
next.config.mjs                                ✓ images.remotePatterns: *.supabase.co/storage + picsum.photos (mock dev)
src/lib/utils/formatting.ts                    ✓ cn removed; only formatPrice + formatDate
src/components/{ui/Button,ui/Input,ui/Card,ui/Badge,ui/Spinner,layout/Nav}.tsx  ✓ cn import path updated
src/app/page.tsx                               ✓ apostrophe escape (lint fix); +"Latest listings" featured strip via getBrowseListings()
src/components/ui/Card.tsx                     ✓ empty interface → type alias (lint fix)
ENGINEERING.md                                      ✓ build status + Shared Components Registry
docs/BRANCHING.md                              ✓ reviewer ownership rules + reviewer checklist
```

---

## Files To Create (next slice — listing detail page only)

Strict scope. Do NOT add anything else to this list "while you're there."

```
src/lib/listings/detail.ts                     # getListingDetail(idOrSlug) — sibling of browse.ts
src/app/listing/[slug]/page.tsx                # Server component, URL is /listing/<slug>
src/components/listing/PhotoGallery.tsx        # SHARED — see registry once landed
src/components/listing/SellerCard.tsx          # SHARED — see registry once landed
src/components/listing/AccessoryList.tsx       # SHARED — inclusions ✓/✗ display
```

## Deferred (do NOT pull into the detail-page slice)

These remain valid future work but stay out of the next PR. Each gets its own narrow slice.

```
src/lib/mock/offers.ts                         # Defer until buyer dashboard work begins
src/lib/listings/search.ts                     # Defer — /browse covers v1 needs
src/app/listing/search/page.tsx                # Defer
src/app/buy/checkout/[listingId]/page.tsx     # Defer (checkout slice)
src/app/buy/confirm/[orderId]/page.tsx        # Defer
src/app/orders/page.tsx                       # Defer (orders slice)
src/app/orders/[orderId]/page.tsx             # Defer
src/app/orders/watchlist/page.tsx             # Defer (watchlist slice)
src/app/orders/saved-searches/page.tsx        # Defer (saved-search slice)
src/app/orders/disputes/page.tsx              # Defer (disputes slice)
src/components/listing/PriceHistory.tsx        # Defer until price_history table has data
src/components/shared/TrackingTimeline.tsx     # Defer (orders slice)
src/components/shared/DisputeForm.tsx          # Defer (disputes slice)
src/components/shared/RatingPrompt.tsx         # Defer (post-delivery slice)
src/app/api/orders/route.ts                    # Defer
src/app/api/orders/[id]/route.ts               # Defer
src/app/api/watchlist/route.ts                 # Defer
src/app/api/offers/route.ts                    # Defer
src/app/api/offers/[id]/route.ts               # Defer
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

### 4. Listings access boundary — implemented in `src/lib/listings/browse.ts`

The buyer surface reads listings through one indirection. This is the rule
the codebase is most likely to drift away from, so it is stated as three
hard constraints, not preferences.

**Three rules:**

1. **No page, component, hook, or route may import mock datasets directly.**
   Importing from `@/lib/mock/*` outside `src/lib/listings/*` is a code
   smell that should fail review. The `mock/` folder is an implementation
   detail of the access boundary, not a public API.
2. **All listing reads flow through `src/lib/listings/*` access functions.**
   `getBrowseListings(filters)` ships now; sibling functions (`detail.ts`,
   `search.ts`, etc.) follow the same pattern. UI never calls Supabase or
   mock data directly — it calls these functions and consumes the
   view-model they return.
3. **The future Supabase migration replaces implementations inside the
   boundary, never the callers.** When real data lands, the change is
   confined to the body of `getBrowseListings` (and siblings). UI files,
   page components, and route handlers keep their imports unchanged. If a
   migration ever requires touching call sites, the boundary has been
   bypassed somewhere — find and fix that, don't ship around it.

```ts
// src/lib/listings/browse.ts
export async function getBrowseListings(
  filters: BrowseFilters = {}
): Promise<ListingCardData[]>
```

`ListingCardData`, `BrowseFilters`, and the rest of the contract types
live in `src/lib/listings/types.ts` (see §11). Access-function files
import them; they never define them.

The function returns `ListingCardData` by construction so server-only fields
(`floor_price`, `auto_accept_threshold`, `seller_score`, `buyer_score`)
cannot leak through this boundary even if the underlying source is wrong.

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

### 8. Browse filters live in URL search params, never hidden client state
The `/browse` page is a server component. Every filter and the sort control
update the URL via `<Link>` — no `useState`, no client-side filter store. This
keeps the surface shareable, back-button friendly, and SSR-cacheable. It also
means `parseBrowseSearchParams()` is the single parser; client islands (when
they're added) read from the URL and write back to it, never around it.

### 9. Homepage and `/browse` consume the same access boundary
The homepage's "Latest listings" strip calls `getBrowseListings({ sort: "newest", limit: 4 })` —
the exact same function `/browse` uses. This is intentional: every place that
shows listing cards must go through the boundary, including marketing pages.
If a feature ever needs a listing read that doesn't fit the existing access
functions, add a new one to `src/lib/listings/*` rather than bypassing.

### 10. Coordinate with seller-flow before introducing shared layouts
Buyer-flow and seller-flow each render under their own page tree today
(`/`, `/browse`, future `/listing/[slug]` for buyer; `/sell/*`, `/dashboard/*`
for seller — Person 1's). The root layout (`src/app/layout.tsx`) is the only
shared layout, owned by no single feature.

If buyer-flow ever needs a layout that wraps multiple buyer routes (e.g. an
account-aware header that differs from seller-flow's, or a buyer-side cart
strip), introduce it through one coordinated change — not a unilateral
refactor. The layout decision lives at the same level as `Nav`, which is
Person 1's domain. Same applies in reverse: seller-flow does not get to add
a layout that scoops up `/`, `/browse`, or `/listing/*` without buyer-flow
agreement.

The point is that the directory shape (route groups, shared layouts) is a
multi-feature decision. It changes once, deliberately, with both owners
present — never as an incidental tidy-up inside a feature PR.

### 11. Buyer view-models live in `src/lib/listings/types.ts`
There is exactly one canonical home for every type that crosses an access
boundary into the UI: `src/lib/listings/types.ts`. `ListingCardData`,
`ListingDetailData`, `SellerCardData`, `BrowseFilters`, `BrowseSort`, and
`PriceBucket` are all defined there. Component files only define their own
`*Props` (which take a view-model as a field).

Rules enforced by this module:

- **One import path per type.** No `export type { … }` re-exports from
  component or access-function files. Every consumer imports from
  `@/lib/listings/types` directly. Two valid paths is the seed of drift.
- **View-models are intentionally lossy.** The transformation
  `DB row → access boundary → view-model` throws information away on
  purpose. Server-only fields (`floor_price`, `auto_accept_threshold`,
  `seller_score`, `buyer_score`, contact data) cannot be members of any
  type in this file. The compiler is the guardrail.
- **Field names describe what the UI shows, not what the DB column is
  called.** Where the mapping is non-obvious, `types.ts` documents the
  source of record inline (e.g. `member_since ← users.created_at`).
- **New buyer view-models go here, not adjacent to a component.**

`ListingDetailData extends ListingCardData` because every card field is
also part of the detail surface; the detail surface adds richer copy and
inclusions. The seller field is unified on `SellerCardData` across both —
the card UI ignores fields it doesn't render. This is the only inheritance
in the module today.

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
| `getBrowseListings()` | `src/lib/listings/browse.ts` | Canonical access function for any surface that shows a listing grid. Returns `ListingCardData[]`. Filters: `categories[]`, `conditions[]`, `priceBucket`, `negotiableOnly`, `sort`, `limit`. Mock-backed today; will swap to Supabase. |
| `parseBrowseSearchParams()` | `src/lib/listings/browse.ts` | Parse a Next `searchParams` object into typed `BrowseFilters`. Use this in any server component that shows filtered listings — do not roll your own URL parsing. |
| `BrowseFilters`, `BrowseSort`, `PriceBucket` | `src/lib/listings/browse.ts` | The contract types. Filter UIs in seller dashboard / admin can reuse the price-bucket and sort enums for consistency. |
| View-model rule | this file, "Architectural Decisions Made" §2 | Never spread raw DB rows into shared components. Map at the boundary. |
| URL-driven filters rule | this file, §8 | Filter and sort state lives in the URL, not in client state. |

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

- No real listings exist in the DB yet. UI development runs against mock
  data via `getBrowseListings()` until Person 1's seller flow + Person 3's
  approval queue produce approved listings end-to-end. The mock layer is
  the development substrate, not a fallback — when real data lands, swap
  the implementation inside `browse.ts` and `detail.ts`, not the call sites.
- `PATCH /api/offers/[id]` exists but is currently seller-side only (accept /
  decline). Buyer-side offer cancel needs new RLS policies — coordinate with
  Person 1 before adding.
- Per ENGINEERING.md, middleware protects `/sell/*`, `/dashboard`, and `/admin`.
  Buyer routes that require auth (`/buy/*`, `/orders/*`) need to be added to
  the same middleware — do not create a parallel middleware.
- Cross-feature: there is an upstream `next build` lint failure on `dev`
  owned by admin-panel. Tracked in ENGINEERING.md "Project-Level Known Issues"
  and `docs/context/admin-panel.md`. Does not block buyer-flow work.

---

## Next Session Starts Here

Buyer browse surface is shipping. The next slice is the listing detail page —
**strict scope, no scope creep, no "while I'm here" refactors.**

### In scope (this slice only)

1. **`src/lib/listings/detail.ts`** — sibling of `browse.ts`. Export:
   ```ts
   export async function getListingDetail(idOrSlug: string): Promise<ListingDetailData | null>
   ```
   - Mock-backed initially; reads from `mockListings` plus richer fields
     (inclusions, condition_notes, known_defects, more photos)
   - Define `ListingDetailData` colocated — extends `ListingCardData` with
     the additional view-model fields the detail page needs
   - **MUST exclude `floor_price`, `auto_accept_threshold`, and any scores**
     even if those fields end up on the underlying record. View-model maps
     them out at the boundary.
   - Returns `null` for not-found (callers translate to a Next 404)

2. **`src/components/listing/PhotoGallery.tsx`** — SHARED
   - Server component shell + tiny client island for active-photo state
   - Props: `photos: string[]`, `alt: string`, `className?`
   - Renders one main image + a thumbnail strip; click to swap
   - No zoom/lightbox in this slice — defer

3. **`src/components/listing/SellerCard.tsx`** — SHARED
   - Server component
   - Props: `seller: SellerCardData` (subset of `User` — `full_name`, `city`,
     `rating`, `rating_count`, `member_since`; absolutely no `seller_score`,
     `phone`, `email`, `upi_id`, `telegram_chat_id`, internal flags)
   - Compact card — used on detail page and possibly profile page later

4. **`src/components/listing/AccessoryList.tsx`** — SHARED
   - Server component
   - Props: `inclusions: Record<string, boolean>`, `className?`
   - Renders ✓/✗ visual checklist of expected items (e.g. original_box,
     stock_cable, spare_tips)

5. **`src/app/listing/[slug]/page.tsx`** — server component
   - Calls `getListingDetail(slug)`; `notFound()` if null
   - Renders `<PhotoGallery>` + heading + `<ConditionBadge variant="full">` +
     asking price + condition notes + `<AccessoryList>` + `<SellerCard>`
   - Negotiation slider only renders if `is_negotiable` — slider itself is a
     stub button for this slice ("Make an offer" → links to `/login` for now)
   - No price-history chart yet (defer until `price_history` has data)
   - No similar-listings strip yet (can add as a follow-up using
     `getBrowseListings({ categories: [listing.category], limit: 4 })`)

6. **Mock data extensions** — in `src/lib/mock/listings.ts`, augment a few
   listings with realistic `condition_notes`, `known_defects`, and
   `inclusions` so the detail page renders plausibly. Do not perfect every
   listing; match the existing intentional mess.

7. **Update ENGINEERING.md** Shared Components Registry with `PhotoGallery`,
   `SellerCard`, `AccessoryList`. Build-status row stays IN PROGRESS.

### Explicitly out of scope (do NOT touch this slice)

- Watchlist save button or any auth-gated interactivity
- Account gate / login modal
- Pricing engine, negotiation slider logic, real offer submission
- Checkout flow, orders, disputes, ratings
- Auth or middleware changes
- Admin code (Person 3's domain) — including the upstream lint failures
- Refactors to existing primitives "while you're there"
- `src/app/(main)/layout.tsx` introduction (separate, coordinated PR)
- Real Supabase reads — the boundary stays mock-backed for one more slice

### How to start the session

1. `git checkout feature/buyer-flow && git pull origin dev`
2. Re-read ENGINEERING.md, BRANCHING.md, this file
3. Confirm branch + summarize before writing code (per session protocol)
4. Implement in the order above; tsc + lint + build between commits
5. Two small commits ideal:
   - `feat(buyer): getListingDetail + detail-page primitives`
   - `feat(buyer): /listing/[slug] page`
6. Open PR into `dev` immediately when the slice is shippable —
   do not stack the next slice on this branch.

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
- Browse filter and sort state lives in URL search params, never client state
- Homepage and `/browse` consume the same `getBrowseListings()` boundary by design
- Directory-shape changes (route groups, shared layouts) are multi-feature decisions — coordinate with seller-flow before introducing one
- Buyer view-models live in `src/lib/listings/types.ts` — one canonical home, one import path per type, no re-exports from component or access-function files
