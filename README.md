# Audiobaaz

> Managed second-hand audio gear marketplace for India. Sellers list used
> headphones, IEMs, DACs, amps, cables; buyers browse and purchase; Audiobaaz
> sits in the middle — verifying listings, holding payments in escrow,
> coordinating shipping, and resolving disputes.

**Status:** active V1 development. The marketplace transaction engine
(payments, shipping, escrow, timeline) runs end-to-end on `feature/order-lifecycle-shipping`
without external Razorpay or Shiprocket credentials, behind provider
abstractions that swap in real gateways once credentials land.

---

## Where to start

Read these in order before touching code:

1. [`ENGINEERING.md`](./ENGINEERING.md) — project rules, money handling, database invariants, design system, current build status, branch state.
2. [`docs/V1-LAUNCH.md`](./docs/V1-LAUNCH.md) — bounded launch checklist; what's done, what's open, what's deferred.
3. [`docs/BRANCHING.md`](./docs/BRANCHING.md) — branching workflow + reviewer ownership.
4. [`docs/context/<feature>.md`](./docs/context/) — per-feature context for whichever feature you're working on.

---

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 14 (App Router), TypeScript |
| Database, Auth, Storage | Supabase (Postgres 15+) |
| Payments | Razorpay (production) / DevPaymentProvider (validation) — selected via `PAYMENT_PROVIDER` env |
| Shipping | Shiprocket (planned) / MockShippingProvider (default) — selected via `SHIPPING_PROVIDER` env |
| Notifications | Telegram Bot |
| Hosting | Vercel (production: `audiobaaz.com`, dev: `dev.audiobaaz.com`) |
| DNS, edge, email routing | Cloudflare |

All money is stored in **paise** (₹1 = 100 paise). Never use floats for money.

---

## Local development

```bash
# 1. Clone
git clone https://github.com/audiobaaz/audiobaaz.git
cd audiobaaz

# 2. Install
npm install

# 3. Configure env
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
# For local validation without Razorpay credentials, also set:
#   PAYMENT_PROVIDER=dev
# (See docs/DEPLOYMENT.md for the full env-var reference.)

# 4. Run
npm run dev
# http://localhost:3000
```

Database setup and Supabase storage bucket creation are documented in
[`docs/FIRST-SESSION.md`](./docs/FIRST-SESSION.md) (kept as historical
reference — the foundation is already built on `dev`).

---

## End-to-end flow without external credentials

Set `PAYMENT_PROVIDER=dev` (non-prod only). The buyer can complete the
full marketplace lifecycle:

```
Browse → Listing detail → Buy now / Offer → Checkout
   ↓
/api/payments/create  (dev provider returns synthetic order_id)
   ↓
CheckoutForm — synthetic branch — POST /api/dev/payments/simulate
   ↓
/api/payments/verify  → finalize_winning_payment RPC → escrow_held
   ↓
Seller: /dashboard/orders/<id> → Create shipment → MockShippingProvider issues AWB
   ↓
record_shipment_created RPC → seller_confirmed
   ↓
Seller advances mock shipment: picked_up → in_transit → out_for_delivery → delivered
   ↓
record_shipment_status_change RPC → orders.status walks shipped → inspection
   ↓
Buyer's order detail renders the full audit timeline + tracking
```

Real Razorpay and Shiprocket integrations replace the synthetic
providers when credentials arrive — no caller code changes.

See [`docs/reviews/lifecycle-validation-runbook.md`](./docs/reviews/lifecycle-validation-runbook.md)
for the eight-scenario validation matrix.

---

## Repository layout

```
src/app/                 Next.js routes (App Router)
  ├── (auth)/            login + onboarding
  ├── (main)/            buyer + seller surfaces
  ├── admin/             admin panel (role-gated)
  ├── api/               backend routes
  │   ├── payments/      /create, /verify, /webhook
  │   ├── shipping/      /create, /track
  │   └── dev/           dev-only utilities (simulate, webhook-replay, advance)
  └── auth/              Supabase auth callback

src/components/          UI components (shared + feature-local)
src/lib/
  ├── payments/          PaymentProvider abstraction
  ├── shipping/          ShippingProvider abstraction
  ├── supabase/          server / client / admin Supabase clients
  ├── listings/          buyer-domain access boundary
  ├── offers/            offer-domain access boundary + state machine
  └── telegram/          Telegram notification helpers

supabase/
  ├── schema.sql         base schema
  ├── migrations/        001 → 007 (Phase 1 + shipping substrate)
  ├── tests/             SQL acceptance + smoke tests
  └── ci/                Postgres bootstrap (Supabase compat)

docs/
  ├── V1-LAUNCH.md       launch checklist
  ├── BRANCHING.md       git workflow
  ├── DEPLOYMENT.md      hosting, domains, env vars
  ├── TEAM.md            onboarding summary
  ├── FIRST-SESSION.md   historical (foundation already built)
  ├── context/           per-feature context files
  ├── integrations/      Razorpay + Shiprocket reference
  └── reviews/           audits, runbooks, session-zero artifacts
```

---

## Hard rules — never break these

- All money in paise. ₹10,000 = `1000000`. Never floats.
- Platform fee is 10%. Seller gets 90%.
- `floor_price` on listings never goes to the client. Server-side only.
- `seller_score` and `buyer_score` are internal. Never displayed publicly.
- Admin routes (`/admin/*`) check `role === 'admin'` server-side at every entry point.
- `SUPABASE_SERVICE_ROLE_KEY` never appears in client bundles.
- All notifications via Telegram only.
- No counter-offers — sellers can only accept or decline.
- Buyer has 48h to inspect after delivery (`inspection_expires_at` set by the `set_inspection_window` trigger).
- The lifetime ownership anchor on listings is `sold_order_id` (not `sold_offer_id`). See migration 006.
- All marketplace state transitions go through locked RPCs (`finalize_winning_payment`, `record_shipment_created`, `record_shipment_status_change`, `initiate_refund`, `record_refund_outcome`). No direct `UPDATE listings`/`UPDATE orders` from route code.

---

## License

Private. Not for redistribution.
