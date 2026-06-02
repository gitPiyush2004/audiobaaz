# Deployment + Domains + Auth Infrastructure

> Single source of truth for how Audiobaaz is hosted, how domains map to
> environments, how databases are separated, and how auth is configured.
> Update this file whenever any of those change.

**Last updated:** 2026-06-03

---

## Infrastructure Overview

Everything runs on a single VPS managed by **Dokploy**. There is no Vercel.

| Environment | Domain | Branch | Database |
|-------------|--------|--------|----------|
| Production | `https://audiobaaz.com` | `main` | `supabase.audiobaaz.com` |
| Staging / Dev | `https://dev.audiobaaz.com` | `dev` | `supabase-dev.audiobaaz.com` |

DNS and edge caching are handled by **Cloudflare**, which proxies both domains to the VPS.

---

## Dokploy Project Layout

**Project:** AudioBaaz → **Environment:** production

| Service | Domain | Branch | Auto-deploy |
|---------|--------|--------|-------------|
| Production | `audiobaaz.com` | `main` | On push to `main` |
| Staging | `dev.audiobaaz.com` | `dev` | On push to `dev` |

Both are Next.js 14 apps built with Nixpacks (Node 20 — pinned via `.node-version`).

---

## Database Layout

Two separate Supabase instances, both self-hosted on the same VPS.

| Instance | Domain | Used by | Access |
|----------|--------|---------|--------|
| Production DB | `supabase.audiobaaz.com` | `audiobaaz.com` only | Internal VPS only (no public DNS) |
| Dev DB | `supabase-dev.audiobaaz.com` | `dev.audiobaaz.com` + local dev | Public (Cloudflare-proxied) |

**Rules:**
- Production DB is never touched by dev work. `supabase.audiobaaz.com` has no public DNS record — it only resolves inside the VPS.
- Dev DB is used for all development, testing, and staging. Local `.env.local` points here.
- All migrations must be applied to dev DB first, verified on `dev.audiobaaz.com`, then applied to production DB when promoting `main`.

---

## Environment Variables

### Local development (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase-dev.audiobaaz.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
PAYMENT_PROVIDER=dev
```

### Staging (Dokploy env vars for `dev.audiobaaz.com`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase-dev.audiobaaz.com
NEXT_PUBLIC_APP_URL=https://dev.audiobaaz.com
PAYMENT_PROVIDER=dev
ENABLE_DEV_ROUTES=true
PAYMENT_DEV_SECRET=<any non-empty string>
```

### Production (Dokploy env vars for `audiobaaz.com`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.audiobaaz.com
NEXT_PUBLIC_APP_URL=https://audiobaaz.com
# PAYMENT_PROVIDER must NOT be set — factory defaults to Razorpay
# ENABLE_DEV_ROUTES must NOT be set — dev endpoints must be inaccessible
RAZORPAY_KEY_ID=<populate when credentials arrive>
RAZORPAY_KEY_SECRET=<populate when credentials arrive>
RAZORPAY_WEBHOOK_SECRET=<populate when credentials arrive>
SHIPROCKET_EMAIL=<populate when credentials arrive>
SHIPROCKET_PASSWORD=<populate when credentials arrive>
```

---

## DNS — Cloudflare

| Type | Name | Target | Proxy | Purpose |
|------|------|--------|-------|---------|
| A | `audiobaaz.com` | VPS IP | Proxied | Production app |
| CNAME | `www` | `audiobaaz.com` | Proxied | Redirects to apex |
| CNAME | `dev` | VPS IP | Proxied | Staging app |
| CNAME | `supabase-dev` | VPS IP | Proxied | Dev Supabase Studio + API |
| MX | `audiobaaz.com` | Cloudflare Email Routing | — | Inbound email |
| TXT | `audiobaaz.com` | SPF record | — | Sender authentication |
| TXT | `_dmarc` | DMARC policy | — | Mail policy |

`supabase.audiobaaz.com` (production Supabase) has **no Cloudflare DNS record** — accessible only from within the VPS.

---

## Authentication

### Supabase Auth — Site URL & Redirect URLs

| Setting | Value |
|---------|-------|
| Site URL | `https://dev.audiobaaz.com` |
| Allowed redirect URLs | `http://localhost:3000/**`, `https://dev.audiobaaz.com/**`, `https://audiobaaz.com/**`, `https://www.audiobaaz.com/**` |

Switch Site URL to `https://audiobaaz.com` only when production becomes the primary user-facing environment.

### Auth providers

- **Google OAuth** — preferred. No email rate limits.
- **Magic link (email OTP)** — fallback. Subject to Supabase rate limits; use the dev sign-in bypass during testing.

### Dev sign-in bypass

`POST /api/dev/sign-in` — gated by `ENABLE_DEV_ROUTES=true`. Generates a magic-link token server-side without sending email. Returns `hashed_token` which can be exchanged via `/auth/callback?token_hash=<token>&type=magiclink`.

### Origin resolution behind reverse proxy

`req.nextUrl.origin` resolves to `localhost:3000` inside the Dokploy container, not the public domain. Both the auth callback and webhook-replay route use `NEXT_PUBLIC_APP_URL` first. **Always set `NEXT_PUBLIC_APP_URL` in Dokploy env vars for every service.**

---

## Applying migrations

Migrations live in `supabase/migrations/`. They are **not auto-applied** — run them manually against each instance.

**Dev DB** — via Studio at `https://supabase-dev.audiobaaz.com/project/default` → SQL Editor.
Or via pg-meta API:
```bash
curl -X POST "https://supabase-dev.audiobaaz.com/pg/query" \
  -H "Content-Type: application/json" \
  -H "apikey: <service_role_key>" \
  -H "Authorization: Bearer <service_role_key>" \
  -d '{"query": "<SQL>"}'
```

**Production DB** — accessible only from inside the VPS. SSH in and use psql, or open the internal Supabase Studio.

Apply order:
1. Apply to dev DB → test on `dev.audiobaaz.com`
2. Merge `dev → main`
3. Apply to production DB
4. Verify production is healthy

---

## Promoting dev → production

1. Confirm `dev.audiobaaz.com` is healthy.
2. `npm run build` passes locally.
3. Merge `dev → main` on GitHub. Dokploy auto-deploys `audiobaaz.com`.
4. Apply any pending migrations to the production DB.
5. Smoke-test login + listing browse on production.

---

## Forcing a redeploy

Push an empty commit to trigger Dokploy's auto-deploy webhook:
```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push origin dev   # or main
```
Or click **Deploy** manually in the Dokploy service dashboard.

---

## Lessons Learned

### 1 — req.nextUrl.origin behind reverse proxy
`req.nextUrl.origin` and `new URL(request.url).origin` resolve to `localhost:3000` inside Dokploy containers — the internal address, not the public domain. Fix: always set `NEXT_PUBLIC_APP_URL` and read it in any server-side redirect or self-fetch.

### 2 — Supabase redirect URL allowlist
Auth callbacks fail silently if the redirect domain isn't in the Supabase Auth allowlist. When adding any new subdomain, add `https://<subdomain>/**` to allowed redirect URLs before routing traffic to it.

### 3 — Supabase email OTP rate limits
Heavy testing exhausts magic-link email quotas. Use `POST /api/dev/sign-in` (requires `ENABLE_DEV_ROUTES=true`) to bypass.

### 4 — Nixpacks defaults to Node 18
Without a version pin, Nixpacks builds with Node 18. Keep `.node-version` set to `20` in the repo root.

### 5 — Migrations not auto-applied
Supabase self-hosted does not run migrations automatically. After any schema change, manually apply the migration to both dev and production DBs. Verify with a quick `SELECT` against the new table/column before deploying the app code that depends on it.

### 6 — webhook_events table was missing from dev DB (2026-06-02)
Migration `002_phase1_marketplace_core.sql` was not fully applied to the dev Supabase, leaving `webhook_events` absent. This caused `/api/payments/webhook` to 500 on every call. Applied manually via pg-meta. Always verify all migrations are present after a fresh Supabase setup — check with `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`.

---

## Cross-references

- Project rules, money/DB invariants — `ENGINEERING.md`
- Branching and PR protocol — `docs/BRANCHING.md`
- V1 launch checklist — `docs/V1-LAUNCH.md`
- Lifecycle validation results — `docs/reviews/lifecycle-validation-results.md`
