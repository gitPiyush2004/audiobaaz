# Deployment + Domains + Auth Infrastructure

> Single source of truth for how Audiobaaz is hosted, how domains map to
> environments, how email is routed, and how authentication redirects
> are configured. Update this file whenever any of those change.

**Last updated:** 2026-05-30

---

## Environment Overview

| Environment | Domain | Branch | Hosting | Deploy trigger |
|-------------|--------|--------|---------|----------------|
| Production | `https://audiobaaz.com` (apex) | `main` | Vercel | Auto-deploy on push to `main` |
| Production (www) | `https://www.audiobaaz.com` | n/a | Vercel | 308 redirect → apex |
| Development | `https://dev.audiobaaz.com` | `dev` | Vercel | Auto-deploy on push to `dev` |
| Future — Operations dashboard | `https://app.audiobaaz.com` | TBD | Vercel | TBD |

### Why we run two environments

- **`dev` is the integration / preview environment.** All four feature
  branches merge into `dev` first. The team uses `dev.audiobaaz.com` to
  click through merged work end-to-end, demo to stakeholders, and
  reproduce bugs against real Supabase data without putting the
  production domain at risk.
- **`main` (production) serves public traffic.** It deploys only what
  has been validated on `dev` and explicitly promoted. No feature branch
  ever auto-merges into `main`.
- The split also lets us point Supabase email rate limits, OAuth
  consent screens, and webhook URLs at the right environment without
  cross-contamination.

---

## Domain & DNS — Cloudflare

The domain `audiobaaz.com` was purchased and its nameservers were
delegated to Cloudflare. Cloudflare proxies all traffic and handles
DNS, edge-level caching, and email routing.

### DNS records (verified working)

| Type | Name | Target | Proxy | Purpose |
|------|------|--------|-------|---------|
| A / CNAME | `audiobaaz.com` (apex) | Vercel anycast IP / `cname.vercel-dns.com` | Proxied | Production |
| CNAME | `www` | `cname.vercel-dns.com` | Proxied | Production www → redirects to apex via Vercel project settings |
| CNAME | `dev` | `cname.vercel-dns.com` | Proxied | Development environment |
| MX | `audiobaaz.com` | Cloudflare Email Routing MX hosts | n/a | Inbound email |
| TXT | `audiobaaz.com` | SPF (`v=spf1 include:_spf.mx.cloudflare.net ~all`) | n/a | Sender authentication |
| TXT | `cf2024-1._domainkey` (or similar) | DKIM record from Cloudflare | n/a | Mail signing |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; ...` | n/a | DMARC policy |

> Exact A/CNAME values and DKIM selector strings live in the Cloudflare
> dashboard. Use that as the runtime source of truth; this table is the
> conceptual map.

### `www` redirect strategy

`www.audiobaaz.com` resolves through Vercel and is configured in the
Vercel project's **Domains** tab to issue a `308 Permanent Redirect` to
the apex `audiobaaz.com`. This keeps a single canonical origin for SEO
and avoids Supabase auth-callback fan-out across two hostnames.

---

## Vercel Project Configuration

- **Connected Git provider:** GitHub (`github.com/audiobaaz/audiobaaz`)
- **Production branch:** `main`
- **Preview branches:** all non-`main` branches; `dev` specifically
  aliases to the `dev.audiobaaz.com` domain.
- **Build command:** `next build` (default).
- **Environment variables (set in Vercel project settings):**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TELEGRAM_BOT_TOKEN` (currently empty — wire when bot is ready)
  - `RAZORPAY_*`, `SHIPROCKET_*` — not yet populated; payment-shipping
    feature is blocked behind Phase 1 schema work.
- **Commit-author validation:** Vercel enforces that commit authors
  resolve to a GitHub-recognised email. See "Lessons Learned" below.

---

## Authentication

Two providers wired through Supabase Auth.

### Magic-link (email OTP)

- Implemented end-to-end. Auth callback at `src/app/auth/callback/route.ts`
  exchanges the PKCE code, runs the onboarding check
  (`/onboarding` if `full_name` is unset), and redirects to the original
  destination.
- Redirect handling uses `window.location.origin` on the client, so the
  same login page works across `localhost`, `dev.audiobaaz.com`, and
  `audiobaaz.com` without per-environment URL hardcoding.
- Subject to Supabase email-OTP rate limits (see "Lessons Learned").
- Dev-only bypass: `POST /api/dev/sign-in` (gated by `NODE_ENV !== 'production'`)
  generates the magic link server-side via the admin client without
  sending an email. Use during testing when rate limits hit.

### Google OAuth (preferred long-term)

- Google Cloud OAuth credentials created (Client ID + Client Secret).
- Google provider enabled inside Supabase Auth.
- Google OAuth button added to the login page in commit `15ff3f1`.
- Selected as the preferred long-term auth path because it:
  - sidesteps Supabase email OTP rate limits during demos and dev
    testing;
  - reduces signup friction (no inbox round-trip);
  - already verifies the user's identity at the IdP level.
- **Status:** button shipped on `dev`. End-to-end verification on
  `dev.audiobaaz.com` and `audiobaaz.com` is the next-session priority
  (see "Next Session Starts Here" below).

### Supabase Auth — Site URL & Redirect URLs

| Setting | Current value |
|---------|---------------|
| Site URL | `https://dev.audiobaaz.com` |
| Allowed redirect URLs | `http://localhost:3000/auth/callback`, `http://localhost:3000/**`, `https://dev.audiobaaz.com/auth/callback`, `https://dev.audiobaaz.com/**`, `https://audiobaaz.com/auth/callback`, `https://audiobaaz.com/**`, `https://www.audiobaaz.com/auth/callback`, `https://www.audiobaaz.com/**` |

> The Site URL stays at `dev` while the team is actively testing.
> Switch to `https://audiobaaz.com` only when production is the primary
> environment for end users — note that the redirect-URL allowlist
> already covers the production hostnames, so the switch is a one-field
> change in Supabase Auth settings.

> **Important:** Supabase appends the requested `redirectTo` only if it
> matches the allowlist. Adding a new environment hostname (or a new
> path under an existing hostname) requires updating this list before
> the callback will succeed.

---

## Email Routing — Cloudflare

Inbound email is handled by Cloudflare Email Routing.

- **MX**, **SPF**, **DKIM**, and **DMARC** records configured on the
  apex domain.
- **Public-facing email decision:** `hello@audiobaaz.com` is the
  primary support address. All public touchpoints (footer, contact
  pages, transactional email "from" / "reply-to" headers when we
  introduce them) should funnel through this single address.
- Additional aliases (`abuse@`, `security@`, `payments@`, `legal@`)
  can be added later as catch-alls; they are not required for V1.

---

## Future — Operations Dashboard (`app.audiobaaz.com`)

Planned, not built. When implemented this subdomain will host:

### Admin access
- Dedicated admin sign-in page (separate from the consumer login).

### Merchant / curator access
- Dedicated signup and sign-in for Audiobaaz curators (V2 distributed
  verifier network from ENGINEERING.md's V2 scope).

### Dashboards
- Main dashboard for merchants.
- Main dashboard for admins.

### Merchant onboarding flow
1. User signs up as a merchant.
2. Completes onboarding form.
3. Submits application.
4. Audiobaaz team reviews and contacts them out-of-band.
5. Merchant tracks application status from the dashboard.

This subdomain is not yet wired in DNS. Add it via Cloudflare and the
Vercel project Domains tab when the operations app is ready to deploy.

---

## Lessons Learned (this deployment session)

Recorded so the next time we hit a similar class of issue, the
diagnosis is faster.

### 1 — Vercel was building an old commit

**Symptom:** Vercel deployment header read `Source dev 4b651ac` even
after we'd "fixed" the lint errors.

**Root cause:** Edits sat in the working tree only — never committed
or pushed. Vercel kept building the last hash GitHub had.

**Resolution:** Run `git status` and `git ls-remote origin dev` to
confirm what GitHub actually holds before claiming a fix is deployed.
Stage explicitly (avoid `git add .` so untracked IDE folders don't
sneak in), commit, push, and verify `origin/dev` advanced.

**Avoid going forward:** When the Vercel deployment fingerprint
doesn't match local `HEAD`, the bug is almost always git-side, not
Vercel-side. Check authoritative sources first: `git ls-remote origin
<branch>` for the actual GitHub state, the Vercel deployment "Source"
field for what was built. If they disagree, push or trigger a fresh
deploy — never click "Redeploy" on an old failed deployment, that
rebuilds the original commit.

### 2 — Git commit author was an invalid `.local` address

**Symptom:** Vercel returned `Deployment Blocked. The commit author
email chinmayathakral@Chinmayas-MacBook-Air.local is not valid.`

**Root cause:** `git config --global user.email` was unset; git fell
back to deriving an email from the local hostname. Vercel enforces
that commit authors resolve to a GitHub-known email.

**Resolution:** Set the global identity:
```
git config --global user.name "audiobaaz"
git config --global user.email "audiobaazindia@gmail.com"
```
Rewrite the offending commits using `git rebase HEAD~N --exec 'git
commit --amend --no-edit --reset-author --allow-empty'`, then force-
push with `git push --force-with-lease origin dev`.

**Avoid going forward:** New machines / new repos: configure
`user.name` and `user.email` before the first commit. Use a verified
GitHub email (or the no-reply form `<id>+<user>@users.noreply.github.com`)
to ensure Vercel and GitHub attribution both work.

### 3 — Vercel blocked deployments because the commit author wasn't recognised

**Symptom:** Same as #2 — but it's worth recording the policy
explicitly. Vercel can be configured (project- or team-level) to
require that commit authors map to a known GitHub identity.

**Resolution:** Use a verified email or the GitHub no-reply email so
the mapping resolves automatically. Alternative (not chosen): disable
the policy in Vercel project settings.

### 4 — Supabase redirect URLs caused localhost callback issues

**Symptom:** Magic-link callbacks worked from one environment but not
another; localhost flows silently failed.

**Root cause:** Supabase Auth only honours `redirectTo` values that
appear in the allowlist. Missing entries silently fall back to the
Site URL or fail outright.

**Resolution:** Allowlisted all of:
- `http://localhost:3000/auth/callback` and `/**`
- `https://dev.audiobaaz.com/auth/callback` and `/**`
- `https://audiobaaz.com/auth/callback` and `/**`
- `https://www.audiobaaz.com/auth/callback` and `/**`

**Avoid going forward:** Whenever a new hostname (preview deployment,
new subdomain, custom domain) is introduced, add the corresponding
`/auth/callback` and `/**` entries to the Supabase redirect allowlist
**before** routing traffic to it.

### 5 — Supabase email OTP rate limits during repeated testing

**Symptom:** Magic links stopped arriving after a burst of test logins.

**Root cause:** Supabase enforces a per-recipient and per-project rate
limit on email OTP sends to protect against abuse. Hitting it makes
the auth flow look broken when it isn't.

**Resolution (short-term):** Use the dev sign-in bypass at
`POST /api/dev/sign-in` (gated by `NODE_ENV !== 'production'`) to
generate magic links server-side without sending an email. Documented
in `ENGINEERING.md` under "Development Utilities".

**Resolution (long-term):** Google OAuth as the primary auth path —
no email sent, no rate limit. Magic link kept as a fallback.

---

## Operational Runbooks

### Promoting `dev` → `main` (production deploy)

1. Confirm `dev.audiobaaz.com` is healthy (manual click-through of
   buyer flow, seller flow, admin panel).
2. `next build` passes locally (`npm run build`).
3. Open a PR `dev → main`.
4. Wait for Vercel preview deployment to finish; click through it.
5. Merge the PR. Vercel auto-deploys to `audiobaaz.com`.
6. Verify the production deployment hash matches the merge commit.
7. Smoke-test login + a public listing browse on production.

### Forcing a Vercel rebuild

If a webhook fired but Vercel didn't pick up a new commit, push an
empty commit:
```
git commit --allow-empty -m "chore: trigger vercel rebuild"
git push origin dev
```

Avoid clicking "Redeploy" on a previous deployment row — that rebuilds
the *original* commit, not the latest branch tip.

### Rotating Supabase service role key

1. Generate a new service role key in Supabase project settings.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel for both
   Production and Preview environments.
3. Trigger a redeploy of `main` and `dev`.
4. Revoke the old key in Supabase.
5. Update `.env.local` for any local development checkouts (out of
   band — never commit the new value).

---

## Next Session Starts Here

Documentation is now caught up. The next on-the-keyboard work is
auth verification and admin/merchant testing on the live domains.

### High priority

1. **Implement Google OAuth button on login page.** *Already shipped
   in commit `15ff3f1` — verify it renders and triggers the OAuth flow
   correctly on both `dev.audiobaaz.com` and `audiobaaz.com`.*
2. **Keep magic-link login as fallback.** Confirm the magic-link path
   still works alongside the Google button.
3. **Verify Google OAuth flow on `dev.audiobaaz.com`** end-to-end:
   click Sign in with Google → Google consent screen → redirect back
   to `/auth/callback` → onboarding (for first-time users) →
   destination route.
4. **Test auth callback flow on `dev.audiobaaz.com` and
   `audiobaaz.com`.** Both magic-link and Google flows. Confirm
   redirect URLs in Supabase still match what each origin sends.
5. **Verify role-based onboarding flow after OAuth login.** First
   Google sign-in must:
   - create the `public.users` row via the `handle_new_auth_user`
     trigger;
   - redirect to `/onboarding` because `full_name` is unset;
   - send the user to their original destination after onboarding
     submit.
6. **Continue admin and merchant authentication testing.** Confirm an
   admin user lands on `/admin` and is gated correctly; confirm a
   non-admin user is redirected away from `/admin/*`. Merchant
   onboarding is V2 (operations-dashboard subdomain) — not in this
   pass.

### Lower priority (after the above)

- Wire `TELEGRAM_BOT_TOKEN` in Vercel so order/dispute notifications
  flow on `dev.audiobaaz.com`.
- Decide whether the production Site URL flips from
  `https://dev.audiobaaz.com` to `https://audiobaaz.com` now that
  production is live, or whether to wait until external traffic
  starts hitting the apex.
- Plan the `app.audiobaaz.com` subdomain for the operations dashboard
  (admin sign-in, merchant signup, dashboards). Not built; record
  the DNS + Vercel project decisions here when it lands.

---

## Cross-references

- Project rules and money/database invariants — `ENGINEERING.md`
- Branching, reviewer ownership, PR protocol — `docs/BRANCHING.md`
- Buyer flow status — `docs/context/buyer-flow.md`
- Seller flow status — `docs/context/seller-flow.md`
- Admin panel status — `docs/context/admin-panel.md`
- Payments + shipping (blocked) — `docs/context/payments-shipping.md`
- Payments architecture audit — `docs/reviews/payments-session-zero.md`
