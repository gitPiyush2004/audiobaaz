# First Session Guide — What To Do Right Now

> **HISTORICAL — kept for the audit trail.** This document records the
> very first AI coding tool session that bootstrapped the project. The
> foundation it describes (Next.js scaffolding, Supabase setup, base
> components, design system) has been live on `dev` since session 1.
>
> **For new contributors:** read `README.md` and `docs/TEAM.md` first.
> The active branch is `feature/order-lifecycle-shipping`; the active
> work is lifecycle validation per
> `docs/reviews/lifecycle-validation-runbook.md`.

This was the step-by-step guide for the very first AI coding tool session.
This session set up the foundation that everyone else builds on.

---

## Step 1 — Initialize Next.js in the repo

Open terminal in the repo folder and run:

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-git \
  --import-alias "@/*"
```

Say YES to all prompts.

---

## Step 2 — Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install razorpay
npm install zustand
npm install lucide-react
npm install clsx tailwind-merge
npm install @tanstack/react-query
```

---

## Step 3 — Set up Supabase project

1. Go to supabase.com → New project
2. Name: audiobaaz
3. Copy your project URL and anon key
4. Create `.env.local` from `.env.example`
5. Fill in Supabase URL and anon key
6. Go to SQL Editor in Supabase dashboard
7. Paste the entire contents of `supabase/schema.sql`
8. Run it — all tables, indexes, triggers created

---

## Step 4 — First AI coding tool prompt

Open AI coding tool and paste this exactly:

---

*"Read ENGINEERING.md in this repo. Then read docs/FIRST-SESSION.md.
I need you to set up the foundation for our Next.js project.
After reading, tell me what you understand about the project before writing any code.
Then do the following in order:*

*1. Update tailwind.config.js to include our custom colors and fonts from the design system in ENGINEERING.md*

*2. Update src/app/globals.css with all CSS variables from our design system*

*3. Add Google Fonts import for Syne and DM Sans*

*4. Create src/lib/supabase/client.ts — browser Supabase client*

*5. Create src/lib/supabase/server.ts — server Supabase client for API routes*

*6. Create src/lib/utils/formatting.ts with:*
   *- formatPrice(paise: number): string — converts paise to ₹ display format*
   *- formatDate(date: string): string — readable date format*

*7. Create src/types/index.ts with TypeScript types for:*
   *- User, Listing, Offer, Order, Dispute, Rating*
   *Based on the database schema in supabase/schema.sql*

*8. Create these base UI components in src/components/ui/:*
   *- Button.tsx — variants: primary, secondary, ghost, danger*
   *- Input.tsx — with label and error state*
   *- Badge.tsx — variants: success, warning, error, info, grade-s, grade-a, grade-b, grade-c, grade-d*
   *- Card.tsx — surface background, border, rounded*
   *- Spinner.tsx — loading indicator*

*Use the design system exactly as specified in ENGINEERING.md.*
*Dark theme. Syne for headings. DM Sans for body. Accent color #E8FF4D."*

---

## Step 5 — After foundation is built

Each person creates their feature branch:

```bash
# Person 1
git checkout -b feature/seller-flow

# Person 2
git checkout -b feature/buyer-flow

# Person 3
git checkout -b feature/admin-panel

# Person 4
git checkout -b feature/payments-shipping
```

Each person reads ENGINEERING.md + their context file at the start of their first session.

---

## Step 6 — Supabase storage bucket

In Supabase dashboard → Storage → New bucket:
- Name: `listings`
- Public: YES (listing photos are public)
- File size limit: 10MB
- Allowed types: image/jpeg, image/png, image/webp

---

## Step 7 — Telegram bot setup

1. Open Telegram → search @BotFather
2. Send `/newbot`
3. Name: Audiobaaz
4. Username: audiobaaz_bot (or whatever is available)
5. Copy the token → add to .env.local as TELEGRAM_BOT_TOKEN
6. Test: `curl https://api.telegram.org/bot{TOKEN}/getMe`

---

## You're ready to build.

After this session, the foundation is live:
- Next.js running on localhost:3000
- Supabase database with full schema
- Design system configured
- Base components ready
- Each person has their feature branch

First feature to build: **ListingCard component** (Person 2)
and **Sell With Us landing page** (Person 1) — simultaneously.