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
| Hosting | Ubuntu VPS + Nginx + PM2 |
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

| Person | Tool | Feature | Status |
|--------|------|---------|--------|
| Person 1 | AI coding tool | Seller flow + dashboard | NOT STARTED |
| Person 2 | Kiro | Buyer flow + listing page | NOT STARTED |
| Person 3 | - | Admin panel | NOT STARTED |
| Person 4 | - | Payments + shipping | NOT STARTED |

> Update this table when features change status.

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

## How to Start Each Session

1. Read this file (ENGINEERING.md)
2. Read your feature context file from `docs/context/`
3. Read any files you'll be modifying today
4. Tell me what you understand before writing code
5. Run `git pull origin dev` before starting work

## How to End Each Session

1. Update your feature context file in `docs/context/`
2. Update the "Current Build Status" table above
3. Commit and push to your feature branch
4. Never leave uncommitted changes overnight

---

## Contact / Ownership

- Repo: github.com/[repo-url]/audiobaaz
- Parent company: Lapidaria
- Platform: StockMyNiche
- Product: Audiobaaz