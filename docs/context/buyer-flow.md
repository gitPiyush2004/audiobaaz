# Buyer Flow — Context File
**Owner:** Person 2
**Tool:** Kiro
**Branch:** feature/buyer-flow
**Last updated:** [date]

---

## What This Feature Does

Lets a buyer browse listings without an account, view product detail pages,
make purchases (fixed price or negotiated), track orders, manage watchlist
and saved searches, and raise disputes. Covers: homepage, browse page,
single listing page, checkout, order dashboard, watchlist, saved searches.

---

## Current Status

```
[ ] Not started
```

---

## Files To Create

```
src/app/(main)/page.tsx                         # Homepage
src/app/(main)/browse/page.tsx                  # Browse + search + filters
src/app/(main)/listing/[id]/page.tsx            # Single listing page
src/app/(main)/listing/search/page.tsx          # Search results
src/app/(main)/buy/checkout/[listingId]/page.tsx # Checkout
src/app/(main)/buy/confirm/[orderId]/page.tsx   # Order confirmed
src/app/(main)/orders/page.tsx                  # My orders
src/app/(main)/orders/[orderId]/page.tsx        # Order detail + tracking
src/app/(main)/orders/watchlist/page.tsx        # Saved listings
src/app/(main)/orders/saved-searches/page.tsx   # Saved searches
src/app/(main)/orders/disputes/page.tsx         # Dispute history
src/components/listing/ListingCard.tsx          # Grid card — SHARED
src/components/listing/ListingGrid.tsx          # Grid layout — SHARED
src/components/listing/PriceHistory.tsx         # Price chart — SHARED
src/components/listing/PhotoGallery.tsx         # Photo gallery — SHARED
src/components/listing/SellerCard.tsx           # Seller snippet — SHARED
src/components/listing/ConditionBadge.tsx       # Grade badge — SHARED
src/components/listing/AccessoryList.tsx        # Inclusions display — SHARED
src/components/shared/TrackingTimeline.tsx      # Order timeline — SHARED
src/components/shared/DisputeForm.tsx           # Dispute form — SHARED
src/components/shared/RatingPrompt.tsx          # Rating widget — SHARED
src/app/api/orders/route.ts
src/app/api/orders/[id]/route.ts
src/app/api/watchlist/route.ts
src/app/api/offers/route.ts
src/app/api/offers/[id]/route.ts
```

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

## Important: Components Marked SHARED

The following components you create will be used by other features.
Build them generically and document their props clearly:

- `ListingCard` — used on homepage, browse, search, similar listings
- `ListingGrid` — used anywhere listings are shown in a grid
- `PriceHistory` — used on listing page, potentially seller dashboard
- `TrackingTimeline` — used in buyer orders AND seller dashboard
- `ConditionBadge` — used everywhere a condition grade is shown

---

## Note For Kiro Users

This context file works the same way as an ENGINEERING.md.
At the start of each Kiro session:
1. Load ENGINEERING.md (global context)
2. Load this file (buyer flow context)
3. Load the specific files you'll edit today
4. Summarize understanding before writing code

---

## Next Session Starts Here

Initialize this file when starting. First task:
Build the ListingCard component at src/components/listing/ListingCard.tsx
It should show: first photo, product name, condition badge, price, seller rating, city.
This is a SHARED component — make it reusable with clear TypeScript props.
Use design system from ENGINEERING.md. Dark theme, accent #E8FF4D for price.

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