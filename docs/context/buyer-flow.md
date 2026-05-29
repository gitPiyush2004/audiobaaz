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
[x] Foundation slice — primitives (cn, ConditionBadge, ListingCard, ListingGrid)
[x] Browse slice — getBrowseListings() queries real Supabase (status=approved, createAdminClient, filters+sort at DB level, seller ratings batch-fetched); force-dynamic on browse + homepage prevents stale router cache after purchases
[x] Listing detail slice — getListingDetail() now queries real Supabase (createAdminClient, by slug or UUID, seller data joined); /listing/[slug] detects seller vs buyer server-side (shows "This is your listing" + dashboard link for own listings)
[x] Offer composition slice — /offer/new/[listing], OfferAmountInput, getOfferRange, parseOfferDraftFromSearchParams, buildOfferAuthRedirect, validateOfferAmount
[x] Offer domain slice — OfferStatus, state machine (state.ts), createOfferDraft (mock), wired into /offer/new server action
[x] Buyer dashboard slice — getMyOffers, BuyerOfferRow projection, /orders/offers with three sections (Action needed / Awaiting response / History)
[x] Offer detail slice — getOfferDetail (queries.ts), /orders/offers/[id]
[x] Auth gate slice — /orders/* protected by middleware; /offer/new/* remains public; pay/cancel actions disabled until persistence exists
[x] Buyer-flow files: tsc clean, lint clean, dev smoke-tested
[ ] Real offers persistence — replace mock createOfferDraft / getMyOffers / getOfferDetail with Supabase
[ ] Buyer-side offer cancel — RLS policy + API route (coordinate with Person 1 first)
[ ] Real Pay now flow — checkout / Razorpay (Person 4 dependency)
[x] Nav updated (Person 1) — profile avatar dropdown; My Orders counts both offers + orders tables; links to /orders/purchases
[x] Mock checkout flow (Person 1) — /buy/checkout/[listingId] collects delivery address (pre-filled from profile); POST /api/checkout/mock skips Razorpay, creates order (escrow_held) + mock payment, marks listing sold, Telegrams seller
[x] /orders/purchases — lists all buy-now orders with status + links to order detail
[x] /orders/purchase/[orderId] — full order detail page: status timeline, delivery address, price breakdown, dev advance-order button, dispute form during inspection window
[x] POST /api/disputes — buyer raises dispute; validates inspection window, creates dispute record, marks order disputed
[x] POST /api/dev/advance-order — dev-only; pushes order to inspection (delivered_at + inspection_expires_at = now+48h)
[ ] Watchlist, saved searches, disputes, orders dashboard, ratings — defer
[x] /buy/checkout/[listingId] (mock) + /orders/purchase/[orderId] (post-purchase) — live; real Razorpay swap deferred to Person 4's Phase 2 (see docs/reviews/payments-session-zero.md §8)
```

---

## Routes Now Implemented

| Route | Purpose | Auth | Component |
|-------|---------|------|-----------|
| `/` | Homepage with hero + Latest listings strip | public | `src/app/page.tsx` |
| `/browse` | Filter + sort + grid | public | `src/app/browse/page.tsx` |
| `/listing/[slug]` | Single listing detail | public | `src/app/listing/[slug]/page.tsx` |
| `/offer/new/[listing]` | Offer composition (slider + amount input) | public — auth at submit | `src/app/offer/new/[listing]/page.tsx` |
| `/orders` | Redirect to `/orders/offers` | protected | `src/app/orders/page.tsx` |
| `/orders/offers` | Buyer offer dashboard (3 sections) | protected | `src/app/orders/offers/page.tsx` |
| `/orders/offers/[id]` | Offer detail | protected | `src/app/orders/offers/[id]/page.tsx` |
| `/buy/checkout/[listingId]` | Mock checkout — collects delivery address, calls `/api/checkout/mock` | protected | `src/app/buy/checkout/[listingId]/page.tsx` |
| `/orders/purchases` | Buyer purchases list (buy-now orders) | protected | `src/app/orders/purchases/page.tsx` |
| `/orders/purchase/[orderId]` | Order detail — status timeline, address, dispute form during inspection window, dev advance-order button | protected | `src/app/orders/purchase/[orderId]/page.tsx` |

`protected` routes redirect anonymous users to `/login?redirect=<path>` via `src/middleware.ts`.

---

## Buyer Journey

```
Browse                   (public)
  ↓
Listing Detail           (public)
  ↓
Offer Composition        (public — friction lives at submit, not entry)
  ↓
Authentication           (login + magic link → /auth/callback)
  ↓
Offer Created (pending)  (createOfferDraft — mock today)
  ↓ seller_accept
Accepted                 (24h payment window starts)
  ↓ buyer_pay
Paid                     (terminal)
```

Branches off the happy path resolve through the state machine — see
"Offer State Machine" below.

The auth boundary is a deliberate product decision, not an implementation
detail: friction lives at *intent*, not at *entry*. Browsing, viewing a
listing, and composing an offer all work without an account; auth happens
at submission. Drafts survive the boundary via the URL carrier, replaceable
with a server-stored `draft_id` later. Do not move this boundary without a
deliberate product call.

---

## Files Owned By Buyer-Flow

### Domain types & access boundaries

```
src/lib/listings/types.ts        Canonical buyer view-models — see §11
src/lib/listings/browse.ts       getBrowseListings(filters)
src/lib/listings/detail.ts       getListingDetail(idOrSlug)

src/lib/offers/types.ts          OfferRange, OfferDraftData, OfferStatus,
                                 OfferSummary, OfferDetailData
src/lib/offers/state.ts          Pure state machine — TRANSITIONS table,
                                 validateOfferTransition, predicates
                                 (canBuyerCancel/canBuyerPay/canSellerAccept/
                                 canSellerDecline/isTerminal/isAwaitingSeller/
                                 isAwaitingBuyer), buyerStatusLabel,
                                 statusToneToken. Open-questions block above
                                 the transition table — see "Open Questions".
src/lib/offers/draft.ts          getOfferRange, parseOfferDraftFromSearchParams,
                                 buildOfferAuthRedirect, validateOfferAmount
src/lib/offers/create.ts         createOfferDraft → CreateOfferResult
                                 (typed error codes), PENDING_TTL_MS
src/lib/offers/dashboard.ts      BuyerOfferRow projection, getMyOffers
                                 (bucketed: awaiting_seller / action_needed /
                                 history)
src/lib/offers/queries.ts        getOfferDetail (single offer)
```

### Mock data

```
src/lib/mock/users.ts            8 sellers (view-model only — no scores, no
                                 phone, no UPI). Includes `member_since`.
src/lib/mock/listings.ts         12 listings, ListingCardData-shaped + detail
                                 fields (condition_notes, known_defects,
                                 inclusions) on a curated subset. Realistic
                                 mess: missing accessories, single-photo
                                 listings, obscure brands, mixed cities.
src/lib/mock/offers.ts           7 offers as MockOffer (OfferSummary +
                                 message? + listing_was_negotiable). One per
                                 status branch + one without thumbnail + one
                                 without slug.
```

### Shared components (registered in ENGINEERING.md)

```
src/lib/utils/cn.ts                          (Scaffold)
src/components/listing/ConditionBadge.tsx    (Person 2)
src/components/listing/ListingCard.tsx       (Person 2)
src/components/listing/ListingGrid.tsx       (Person 2)
src/components/listing/PhotoGallery.tsx      (Person 2)
src/components/listing/PhotoGalleryView.tsx  (Person 2 — client island
                                              for PhotoGallery)
src/components/listing/SellerCard.tsx        (Person 2)
src/components/listing/AccessoryList.tsx     (Person 2)
src/components/offers/OfferAmountInput.tsx   (buyer-only client island)
src/components/offers/OfferStatusBadge.tsx   (buyer-only — wraps Badge with
                                              statusToneToken + buyerStatusLabel)
```

### Files modified outside buyer-flow's domain

```
next.config.mjs                              images.remotePatterns:
                                             *.supabase.co/storage + picsum.photos
src/middleware.ts                            /orders added to protectedPaths
                                             (auth-gate slice)
src/components/ui/Badge.tsx                  Added `neutral` status variant
                                             (offer terminal states use it)
src/components/ui/{Button,Input,Card,Badge,Spinner}.tsx
src/components/layout/Nav.tsx                cn import path updated to
                                             @/lib/utils/cn (refactor slice)
src/lib/utils/formatting.ts                  cn extracted out; only formatPrice
                                             + formatDate remain
src/app/page.tsx                             Apostrophe escape (lint fix);
                                             "Latest listings" featured strip
                                             via getBrowseListings()
src/components/ui/Card.tsx                   Empty interface → type alias (lint fix)
ENGINEERING.md                                    Build status, registry updates,
                                             Project-Level Known Issues
docs/BRANCHING.md                            Reviewer ownership rules + checklist
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

### 12. Offers are a separate domain — `src/lib/offers/*`
Offers and listings are different bounded contexts. Listings = discovery;
offers = negotiation. The two domains have separate folders, separate
canonical type files, and separate access functions. Do NOT fold offer
view-models into `lib/listings/types.ts`.

```
src/lib/listings/      Discovery domain
└── types.ts             ListingCardData / ListingDetailData / SellerCardData
                         BrowseFilters / BrowseSort / PriceBucket
└── browse.ts, detail.ts (access boundaries)

src/lib/offers/        Negotiation domain
└── types.ts             OfferRange / OfferDraftData / OfferStatus /
                         OfferSummary / OfferDetailData
└── state.ts             Pure state machine — single source of truth for
                         offer transitions and predicates
└── draft.ts             Pre-creation helpers (range, URL parsing,
                         auth-redirect URL builder, validation)
└── create.ts            createOfferDraft entry point (mock-backed today)
└── dashboard.ts         BuyerOfferRow projection + getMyOffers
└── queries.ts           Domain reads returning offer-domain types
                         (getOfferDetail today; siblings later)
```

`dashboard.ts` and `queries.ts` are sibling files with sharp purposes:
projection layer vs domain reads. Keep them separate so a future
`listOffersForListing()` (a domain read) doesn't accidentally land in
`dashboard.ts` and pull display fields with it.

### 13. Buyer offer view-models layer cleanly
Same separation as listings:

```
OfferSummary       = offer-domain object — what an offer IS
BuyerOfferRow      = dashboard projection — what one ROW shows
OfferDetailData    = offer-domain object for the detail surface
                     (extends OfferSummary with `message` and
                     `listing_was_negotiable`)
```

UI components consume projections (BuyerOfferRow) on multi-row surfaces
and domain types (OfferDetailData) on single-item surfaces. Domain types
must NOT carry display fields like `listing_href` or `offer_pct_of_asking` —
those live in projections. Projections must NOT add fields the domain
doesn't logically own.

### 14. Buyer auth boundary
The marketplace follows intent-driven auth:

```
public:    /, /browse, /listing/[slug], /offer/new/[listing]
protected: /orders, /orders/offers, /orders/offers/[id]
```

`/offer/new/[listing]` is intentionally public — buyers compose the offer,
then auth happens at submission via `buildOfferAuthRedirect()`. The draft
survives the auth boundary; the URL carrier (`?offer=<paise>`) is
replaceable with `?draft=<id>` later when drafts are server-persisted.

Middleware (`src/middleware.ts`) only handles route protection. It contains
NO buyer-vs-seller logic, NO role checks, NO ownership checks.
Authorisation lives in the access boundaries (`getMyOffers`,
`getOfferDetail`, etc.) which will read `auth.uid()` server-side once
persistence lands. Pages MUST NOT thread userId through props or URLs.

### 15. State machine owns offer status semantics
`src/lib/offers/state.ts` is the single source of truth for what an offer
status means and what transitions are legal. Predicates (`canBuyerCancel`,
`canBuyerPay`, `canSellerAccept`, `canSellerDecline`, `isTerminal`,
`isAwaitingSeller`, `isAwaitingBuyer`) are derived from a static
`TRANSITIONS` table. UI surfaces ask predicates, never inspect status
directly to decide affordances.

Display helpers (`buyerStatusLabel`, `statusToneToken`) live in `state.ts`
too so seller-side and admin-side surfaces (when they arrive) can use a
different label-helper but the SAME tone-token mapping — keeping colour
semantics consistent across the app.

`OfferStatusBadge` is a thin renderer:
`<Badge variant={statusToneToken(status)}>{buyerStatusLabel(status)}</Badge>`.
No switch in the component. The state machine owns semantics; the
component owns rendering.

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

Today the buyer surface is split: discovery (browse, listing detail, homepage
featured strip) and purchase (mock checkout, orders list, order detail,
disputes) run on real Supabase. Offers persistence is still mock-backed
(`src/lib/offers/*`). The next persistence slice replaces those mock
bodies inside `src/lib/offers/*` without touching pages or components.

---

## Offer State Machine

Lives in `src/lib/offers/state.ts`. Mirrors ENGINEERING.md "Offer Status Flow".

```
pending  ──seller_accept──→ accepted ──buyer_pay──→ paid       (terminal)
       ↘ seller_decline ──────────────────────→ declined   (terminal)
       ↘ buyer_cancel  ──────────────────────→ cancelled  (terminal)
       ↘ system_expire_seller ──────────────→ expired    (terminal)
                              accepted ──system_expire_buyer──→ expired (terminal)
```

Statuses (`OfferStatus`):

| Status | Meaning | Reachable from |
|--------|---------|----------------|
| `pending` | Awaiting seller's accept/decline | initial |
| `accepted` | Seller accepted; buyer must pay within 24h | `pending` |
| `paid` | Buyer paid (terminal — success) | `accepted` |
| `declined` | Seller declined (terminal) | `pending` |
| `expired` | 24h timeout — either seller didn't respond OR buyer didn't pay (terminal) | `pending`, `accepted` |
| `cancelled` | Buyer retracted before acceptance (terminal) | `pending` |

Predicates UI surfaces use:

- `canBuyerCancel(status)` — true on `pending` only
- `canBuyerPay(status)` — true on `accepted` only
- `canSellerAccept(status)` — true on `pending` only
- `canSellerDecline(status)` — true on `pending` only
- `isTerminal(status)` — true on `paid`, `declined`, `expired`, `cancelled`
- `isAwaitingSeller(status)` — true on `pending`
- `isAwaitingBuyer(status)` — true on `accepted`

Locked invariants encoded in the transition table:
- No counter-offers — only seller `accept`/`decline` events exist.
- Buyer can cancel only from `pending` — `accepted → cancelled` is absent.
- Two distinct events lead to `expired`: `system_expire_seller` (seller
  no-response from `pending`) and `system_expire_buyer` (buyer no-payment
  from `accepted`).

---

## Open Questions

Originally recorded in `src/lib/offers/state.ts` next to the transition
table. **All three are now resolved at project level** in
`docs/context/payments-shipping.md` and confirmed by the session-zero
audit (`docs/reviews/payments-session-zero.md`). Kept here for design
history; do not re-litigate.

1. **Listing visibility while an offer is `accepted`** — Resolved.
   Listing remains `approved`; parallel negotiations continue. Decided
   in `payments-shipping.md` "Locked Architecture Decisions".

2. **An `accepted` offer that loses because another buyer paid first** —
   Resolved (Option b). Adds `lost` terminal status to the offer enum,
   reached only via `system_listing_sold` cascade from a verified
   capture. See `payments-shipping.md` "New offer-domain event" and
   audit §4.3 / §4.7.

3. **`expired` collapses two distinct events** — Resolved. Stays
   collapsed; analytics live in `offer_events`, not the status enum.
   See `payments-shipping.md` "`expired` stays collapsed".

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
Build them generically and document their props clearly.

Shipped (registered in ENGINEERING.md):

- `ListingCard` — homepage, browse, search, similar listings, watchlist
- `ListingGrid` — anywhere listings are shown in a grid
- `ConditionBadge` — everywhere a condition grade is shown
- `PhotoGallery` (+ `PhotoGalleryView` client island) — listing detail
- `SellerCard` — listing detail; profile pages later
- `AccessoryList` — listing detail inclusions display

Buyer-specific (not registered as repo-shared because they only render
buyer-side surfaces):

- `OfferAmountInput` — `/offer/new/[listing]` slider + numeric input
- `OfferStatusBadge` — buyer dashboard + offer detail

Future / deferred (no implementation yet):

- `PriceHistory` — listing page, potentially seller dashboard
- `TrackingTimeline` — buyer orders AND seller dashboard
- `DisputeForm` — buyer disputes, admin may reuse
- `RatingPrompt` — buyer post-delivery widget

---

## What Other Features Can Use From Here

### Listings domain

| What | Path | Notes for other teams |
|------|------|-----------------------|
| `cn()` | `src/lib/utils/cn.ts` | The ONE class-name helper. Import from here only. Do not duplicate `clsx + tailwind-merge` anywhere else. |
| `ConditionBadge` | `src/components/listing/ConditionBadge.tsx` | Color-coded grade pill (S/A/B/C/D). Server component. |
| `ListingCard` | `src/components/listing/ListingCard.tsx` | Listing grid card. Accepts `ListingCardData` (NOT raw `Listing`). Server component. |
| `ListingGrid` | `src/components/listing/ListingGrid.tsx` | Pure responsive grid. Has `loading` skeletons + customisable `empty` slot. |
| `PhotoGallery` | `src/components/listing/PhotoGallery.tsx` | 4:3 main + thumb strip. Server shell + client island. |
| `SellerCard` | `src/components/listing/SellerCard.tsx` | Public seller summary. Strict subset (`SellerCardData`) — never spread a `User` row. |
| `AccessoryList` | `src/components/listing/AccessoryList.tsx` | ✓/✗ inclusions checklist. |
| `getBrowseListings()` | `src/lib/listings/browse.ts` | Canonical access function for any surface that shows a listing grid. Returns `ListingCardData[]`. Mock-backed today; will swap to Supabase. |
| `getListingDetail()` | `src/lib/listings/detail.ts` | Single listing read. Returns `ListingDetailData \| null`. Same swap-the-body migration pattern. |
| `parseBrowseSearchParams()` | `src/lib/listings/browse.ts` | Parse Next `searchParams` → typed `BrowseFilters`. |
| `BrowseFilters`, `BrowseSort`, `PriceBucket` | `src/lib/listings/types.ts` | Filter UIs in seller / admin can reuse the price-bucket and sort enums for consistency. |
| Listing view-models | `src/lib/listings/types.ts` | Single canonical home — see §11. |

### Offers domain

| What | Path | Notes for other teams |
|------|------|-----------------------|
| Offer view-models | `src/lib/offers/types.ts` | `OfferRange`, `OfferDraftData`, `OfferStatus`, `OfferSummary`, `OfferDetailData`. Single canonical home for the offers domain. View-models are intentionally lossy — `floor_price`, `auto_accept_threshold`, scores, contact data cannot be members. |
| Offer state machine | `src/lib/offers/state.ts` | Pure module. `validateOfferTransition`, predicates (`canBuyerCancel`, `canBuyerPay`, `canSellerAccept`, `canSellerDecline`, `isTerminal`, etc.), display helpers (`buyerStatusLabel`, `statusToneToken`). The seller surface MUST consume these — do not fork the transition logic. |
| `createOfferDraft()` | `src/lib/offers/create.ts` | Buyer offer-creation entry point. Returns `CreateOfferResult` (typed error codes). Mock-backed; swap body for Supabase later. |
| `getMyOffers()` | `src/lib/offers/dashboard.ts` | Returns bucketed `BuyerOfferDashboardData`. Reads `auth.uid()` server-side; callers must NOT thread `userId`. |
| `getOfferDetail()` | `src/lib/offers/queries.ts` | Returns `OfferDetailData \| null`. Same auth-uid contract. |
| `getOfferRange()` | `src/lib/offers/draft.ts` | The canonical place that decides the buyer-visible negotiation band. The seller's actual `floor_price` does NOT cross this boundary. |
| `parseOfferDraftFromSearchParams()` | `src/lib/offers/draft.ts` | URL → `OfferDraftData`. Today's carrier is `?offer=<paise>`; future is `?draft=<id>`. Pages call this helper, never `searchParams.offer` directly. |
| `buildOfferAuthRedirect()` | `src/lib/offers/draft.ts` | Single source of truth for the auth-handoff URL shape. |
| `validateOfferAmount()` | `src/lib/offers/draft.ts` | Same rule applied client-side and server-side. |
| `OfferStatusBadge` | `src/components/offers/OfferStatusBadge.tsx` | Renders `<Badge variant={statusToneToken}>{buyerStatusLabel}</Badge>`. Buyer label only — seller surface should ship a sibling component sharing the same tone tokens. |

### Cross-cutting rules

| What | Where it lives | Summary |
|------|----------------|---------|
| View-model rule | this file, §2 | Never spread raw DB rows into shared components. Map at the boundary. |
| URL-driven filters rule | this file, §8 | Filter and sort state lives in URL search params, not client state. |
| Boundary discipline | this file, §4 + §12 | UI never imports mock or Supabase directly. Reads go through `lib/{listings,offers}/*` access functions. Future Supabase migration replaces implementations inside the boundary, never callers. |
| State-machine ownership | this file, §15 | UI asks predicates, never inspects `OfferStatus` directly to decide affordances. |

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

- **Persistence is the next gap.** `createOfferDraft()`, `getMyOffers()`,
  and `getOfferDetail()` are all mock-backed. The buyer flow renders end
  to end but no offer record reaches a database. This is the single
  biggest distance between "prototype" and "marketplace" right now.
- **Buyer-side offer cancel needs RLS coordination.** `PATCH /api/offers/[id]`
  exists but is currently seller-side only (accept / decline). New RLS
  policies are required for buyer cancel. Coordinate with Person 1 before
  the persistence slice opens — schema/RLS decisions first, then code.
- **24h windows live in three places.** `PENDING_TTL_MS` in
  `src/lib/offers/create.ts`, the deadline-block copy on
  `/orders/offers/[id]`, and the countdown logic on `/orders/offers`. Not
  a problem today, but when the expiration job ships in the persistence
  slice, introduce `src/lib/offers/policy.ts` (or similar) and centralise
  `PENDING_WINDOW_MS` / `PAYMENT_WINDOW_MS`. Backend behaviour and UI
  copy should read the same source.
- **`Available in next milestone` copy is duplicated** in
  `/orders/offers/page.tsx` and `/orders/offers/[id]/page.tsx`. Tolerable
  for two surfaces. If a third needs it, extract a tiny shared component
  or a constant.
- **Buyer dashboard reachability via Nav is missing.** `/orders/offers`
  works via direct URL or post-login redirect. A `My offers` link in
  `Nav.tsx` for authenticated buyers needs its own small PR — `Nav` is
  Person 1's domain, do not "while I'm here" it.
- **Cross-feature: upstream `next build` lint failure on `dev`** owned
  by admin-panel. Tracked in ENGINEERING.md "Project-Level Known Issues" and
  `docs/context/admin-panel.md`. Does not block buyer-flow work.

---

## Next Session Starts Here

The buyer flow is end-to-end against mock data. Discovery → listing →
offer composition → auth → dashboard → detail all click-through cleanly.
**The next slice is real offers persistence** — it's now the largest gap
between this branch and a real marketplace.

### Pre-work — alignment with Person 1 BEFORE writing code

**Branch hygiene first.** `feature/buyer-flow` was reset to `dev` after the
merge — both branches now sit at `0b0572c`. Either continue on
`feature/buyer-flow` (it's now a clean pointer at dev) or open a fresh
`feature/offers-persistence` from dev. Do NOT start from a stale local
buyer-flow with merge baggage.

Schema/RLS decisions must be made before migrations. Open coordination
items:

1. **`offers` table schema** — confirm against `src/lib/offers/types.ts`.
   Proposed column set:
   ```
   id              uuid pk
   buyer_id        uuid → users.id
   seller_id       uuid → users.id          (denormalised for RLS performance)
   listing_id      uuid → listings.id
   status          offer_status enum         (matches OfferStatus exactly)
   offer_amount    bigint                    (PAISE)
   message         text null                 (OfferDetailData.message)
   was_negotiable  boolean                   (snapshot at creation time —
                                              listings.is_negotiable can flip
                                              after the offer is placed; the
                                              offer record reflects intent at
                                              creation, not later state)
   created_at      timestamptz default now()
   expires_at      timestamptz               (24h window — see policy.ts)
   accepted_at     timestamptz null
   paid_at         timestamptz null
   declined_at     timestamptz null
   cancelled_at    timestamptz null
   ```
   The `*_at` timestamps are nullable not for product reasons but for
   forensics: when the migration runs the existing seller-side
   `PATCH /api/offers/[id]` code may set them, and we want a single
   timeline source.

2. **`offers.status` enum** — must exactly match `OfferStatus` in
   `src/lib/offers/types.ts`: `pending | accepted | paid | declined |
   expired | cancelled`. No counter-offer status. No `lost` status
   unless §4 decides otherwise.

3. **RLS policies** — three personas, explicit access matrix:

   |                            | SELECT | INSERT | UPDATE status |
   |----------------------------|--------|--------|---------------|
   | Buyer (own offers)         | ✓      | ✓      | `pending → cancelled` only |
   | Seller (offers on own listings) | ✓ | ✗      | `pending → accepted`, `pending → declined` only |
   | Admin                      | ✓      | ✗      | force-expire / dispute-related transitions |
   | System (service role)      | ✓      | ✓      | `system_expire_*` transitions only |

   Status transitions are validated server-side by
   `validateOfferTransition()` from `state.ts` AND by the RLS rule. The
   state machine is the source of truth; RLS is defence in depth.

4. **Open marketplace question §2** — decide before the migration: when
   another buyer pays first on a parallel-accepted offer, does the losing
   buyer's offer transition to `expired` or to a new terminal status
   `lost`? Migrations on enums are painful — get this right once. If
   `lost` is added, update both the enum and the state machine's
   `TRANSITIONS` table in the same PR.

### In scope for the persistence slice (after alignment)

Strict scope. Two-or-three small commits, not one big PR.

1. **`offers` table migration** in `supabase/schema.sql` (Person 1 owns
   the schema file per BRANCHING.md — submit the migration there).
2. **Replace mock implementations**, body-only changes inside the
   boundary files. Call sites stay identical:
   - `src/lib/offers/create.ts` — `createOfferDraft` writes a row.
   - `src/lib/offers/dashboard.ts` — `getMyOffers` selects with
     `auth.uid()` + joins `listings`.
   - `src/lib/offers/queries.ts` — `getOfferDetail` selects + joins.
3. **Buyer cancel API + RLS policy.** Likely `PATCH /api/offers/[id]`
   extended (currently seller-only). Real Cancel offer button wires
   here; the `disabled` state added in the auth-gate slice gets removed
   for buyers.
4. **Architectural decision before code:** centralise Supabase access
   for the offers domain. Three independent files (`create.ts`,
   `dashboard.ts`, `queries.ts`) each writing `createClient()` and
   inline queries gets messy. Possible shapes:
   - (a) Each file uses `lib/supabase/server.ts` directly. Simplest;
     three independent query implementations.
   - (b) Add `src/lib/offers/db.ts` — a thin data-access layer that
     returns mapped domain objects. The three boundary files call into it.
   Make this call before writing the first SELECT.
5. **Centralise the 24h windows** into `src/lib/offers/policy.ts` (or
   add to `state.ts`). Replace the inline 24h figure in `create.ts` and
   the deadline-block copy on `/orders/offers/[id]`.

### Explicitly out of scope for the persistence slice

- Real Pay now flow (Person 4's checkout/Razorpay)
- Seller offer inbox (separate slice; coordinate when persistence lands)
- `My offers` link in `Nav.tsx` (separate small PR; Person 1 reviews)
- Watchlist, saved searches, disputes, orders dashboard
- Counter-offers (locked product decision: not happening)
- Auto-accept threshold logic
- Telegram notifications on offer events (later slice)

### How to start the session

1. Coordinate with Person 1 on the four pre-work items above. Do this
   before opening a feature branch.
2. `git checkout feature/buyer-flow && git pull origin dev`
3. Re-read ENGINEERING.md, BRANCHING.md, this file
4. Confirm branch + summarize before writing code
5. Resolve the (a) vs (b) data-access decision before writing migrations
6. Migrate, swap bodies, test, ship as 2–3 small commits

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
- Offers are a separate domain — `src/lib/offers/*` with its own types.ts; do not fold into listings
- Buyer offer view-models layer cleanly: `OfferSummary` (domain) ↔ `BuyerOfferRow` (dashboard projection) ↔ `OfferDetailData` (domain detail). UI consumes the right tier; domain types do not carry display fields
- Public surface: `/`, `/browse`, `/listing/[slug]`, `/offer/new/[listing]` — composing an offer requires no account; auth happens at submission via `buildOfferAuthRedirect()`
- Protected surface: `/orders`, `/orders/offers`, `/orders/offers/[id]` — middleware redirects anonymous users to `/login` with the original path preserved
- Middleware stays boring: route protection only. No buyer-vs-seller logic, no role checks, no ownership checks. Authorisation lives in access boundaries (`getMyOffers`, `getOfferDetail`, future `cancelOffer`) which read `auth.uid()` server-side
- Pages MUST NOT thread `userId` through props or URLs — ownership is enforced at the boundary
- Offer-status semantics live in `src/lib/offers/state.ts`. UI surfaces ask predicates (`canBuyerCancel`, `canBuyerPay`, etc.), never inspect status directly to decide affordances
- Slug-vs-id rule: public navigation paths use slug, internal references use id. Documented inline on `ListingCardData.slug`
- `getOfferRange()` is the only place the server's `floor_price` becomes a buyer-visible band. The 70% placeholder is explicitly NOT business logic — see the inline warning in `src/lib/offers/draft.ts`
