# Seller Flow — Context File
**Owner:** Person 1
**Tool:** AI coding tool
**Branch:** feature/seller-flow
**Last updated:** [date]

---

## What This Feature Does

Lets a seller create a listing from scratch and manage it after it goes live.
Covers: Sell With Us landing page, 6-step listing intake form with draft
auto-save, photo upload, condition grading, inclusions checklist, pricing
with oracle, negotiation settings, submission to review queue, and the full
seller dashboard (7 sections).

---

## Current Status

```
[ ] Not started
```

---

## Files To Create

```
src/app/(main)/sell/page.tsx                    # Sell With Us landing
src/app/(main)/sell/new/page.tsx                # Intake form
src/app/(main)/sell/draft/[id]/page.tsx         # Resume draft
src/app/(main)/dashboard/page.tsx               # Dashboard overview
src/app/(main)/dashboard/listings/page.tsx      # My listings
src/app/(main)/dashboard/offers/page.tsx        # Offers & negotiations
src/app/(main)/dashboard/orders/page.tsx        # Order tracking (seller)
src/app/(main)/dashboard/payouts/page.tsx       # Earnings & payouts
src/app/(main)/dashboard/account/page.tsx       # Profile & settings
src/components/forms/PhotoUpload.tsx
src/components/forms/PriceInput.tsx
src/components/forms/ConditionSelector.tsx
src/components/forms/ProductSearch.tsx
src/components/forms/AccessoryChecklist.tsx
src/app/api/listings/route.ts
src/app/api/listings/[id]/route.ts
src/app/api/upload/route.ts
```

---

## Database Tables This Feature Uses

| Table | Operation | Notes |
|-------|-----------|-------|
| listings | INSERT, UPDATE, SELECT | All listing operations |
| products | SELECT, INSERT | Product search + manual entry |
| offers | SELECT, PATCH | Accept/decline offers |
| orders | SELECT | View order status |
| price_history | SELECT | Show price oracle |
| users | SELECT, UPDATE | Seller profile, UPI, availability |
| notifications | SELECT | Activity feed |

---

## Key Business Logic To Implement

### Listing intake form — 6 steps
1. Select product type (IEM / DAC / Headphone / Amp / DAC+Amp / Cable / Source / Other)
2. Search product name → auto-fill from DB or manual entry
3. Condition grade (S/A/B/C/D) — category-specific checklist
4. Inclusions — checkbox list auto-generated per product type
5. Photos — guided per-slot upload, min 1200×900px client-side
6. Price + negotiation settings

### Auto-save
- Save draft to database on every step completion
- On return: show banner "Resume your listing for [product name]"
- Drafts appear in My Listings under Drafts tab

### Photo upload
- Enforce 1200×900px minimum client-side before upload
- Upload to Supabase storage at: `listings/{listing_id}/{index}.jpg`
- Each photo slot has a reference sample image

### Pricing
- Show price oracle: last 5 sold prices for same model from price_history
- Show live payout calculation: price × 0.90 (10% platform fee)
- Soft warning if price >30% above market average

### Negotiation
- Toggle off by default
- If on: seller sets private floor_price and auto_accept_threshold
- floor_price NEVER sent to client — server-side only

### Listing status after submit
- Set status to 'pending'
- Send Telegram notification to admin
- Show seller: "Under review — typically 2-4 hours (9am-9pm)"

### Reserve mode
- When a buyer starts checkout: listing status → 'reserved' for 15 min
- Triggered by database trigger — not application code
- Seller sees "Reserved" badge in dashboard

### Seller dashboard sections
1. Overview — active listings count, total earnings, pending payouts, active offers
2. My Listings — tabs: Live / Pending / Draft / Sold / Delisted
3. Offers & Negotiations — countdown timers, accept/decline
4. Order Tracking — status timeline per sold order
5. Payouts & Earnings — UPI management, per-sale breakdown
6. Activity — notification timeline, Telegram preferences
7. Account & Trust — profile, seller rating, availability toggle

---

## Next Session Starts Here

Initialize this file when starting. First task:
Build the Sell With Us landing page at /sell/page.tsx.
It should show: how it works, seller guarantee, 10% fee, timeline.
Use the design system from ENGINEERING.md. Dark theme, Syne headings, accent #E8FF4D.
Do NOT build the form yet — just the landing page.

---

## Decisions Made In This Feature

- Auto-save triggers on step completion, not on timer
- Photos stored at: listings/{listing_id}/{index}.jpg in Supabase storage
- Draft slug format: {brand-lowercase}-{4-random-digits} e.g. moondrop-2394
- Negotiation default: OFF — seller must opt in
- floor_price never leaves the server — excluded from all client responses
- Price warning is soft — seller is informed but not blocked
- No counter-offers — accept or decline only
- Active negotiation windows unaffected by price edits
- Parallel negotiations: multiple accepted offers, first to pay wins