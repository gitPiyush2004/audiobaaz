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
| Person 1 | AI coding tool | Seller flow + dashboard | COMPLETE — all V1 features done, see docs/context/seller-flow.md |
| Person 2 | Kiro | Buyer flow + listing page | IN PROGRESS — `cn` utility extracted, shared components scaffold (ConditionBadge, ListingCard, ListingGrid). See docs/context/buyer-flow.md |
| Person 3 | - | Admin panel | NOT STARTED |
| Person 4 | AI coding tool | Payments + shipping | IN PROGRESS — payment + shipping APIs done, see docs/context/payments-shipping.md |

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
| `Button` | `src/components/ui/Button.tsx` | Scaffold | Primary, secondary, ghost, danger variants. sm/md/lg sizes. |
| `Card` | `src/components/ui/Card.tsx` | Scaffold | Basic surface card. Accepts all div props. |
| `cn` | `src/lib/utils/cn.ts` | Scaffold | Canonical class-name helper (`clsx` + `tailwind-merge`). The ONLY place to import `cn` from. Do not duplicate. |
| `ConditionBadge` | `src/components/listing/ConditionBadge.tsx` | Person 2 | Color-coded grade pill (S/A/B/C/D). Props: `grade`, `variant?: "compact" \| "full"`, `size?: "sm" \| "md"`, `className?`. Server component. |
| `ListingCard` | `src/components/listing/ListingCard.tsx` | Person 2 | Listing grid card. Props: `listing: ListingCardData`, `priority?`, `className?`. `ListingCardData` is a structural subset of `Listing` — never pass server-only fields like `floor_price`. Wraps `next/image` (4:3 cover) and links to `/listing/[slug \|\| id]`. Server component. |
| `ListingGrid` | `src/components/listing/ListingGrid.tsx` | Person 2 | Responsive grid (1/2/3/4 cols). Props: `children?`, `loading?`, `skeletonCount?`, `empty?`, `className?`. Pure layout — no data shape coupling. |

---

## Contact / Ownership

- Repo: github.com/[repo-url]/audiobaaz
- Parent company: Lapidaria
- Platform: StockMyNiche
- Product: Audiobaaz