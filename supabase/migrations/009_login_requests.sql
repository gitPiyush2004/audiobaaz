-- Migration 009 — Cross-device magic-link sign-in
--
-- Lets a user request a magic link on one device (e.g. a laptop) and open the
-- email on another (e.g. a phone) while the REQUESTING device also signs in.
--
--   1. Requesting device creates a row here and keeps `secret` in memory only
--      (just its SHA-256 hash is stored).
--   2. The emailed link carries the row id. Opening it signs that device in and
--      marks the row approved for the signed-in user (email must match).
--   3. The requesting device polls with its secret; once approved it receives a
--      one-time sign-in code for that user. Each row can be consumed once.
--
-- Only the service role touches this table (server routes); clients have no access.

CREATE TABLE IF NOT EXISTS public.login_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  secret_hash      TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '60 minutes',
  approved_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at      TIMESTAMPTZ,
  consumed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS login_requests_created_at_idx ON public.login_requests (created_at);

ALTER TABLE public.login_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_requests FROM anon, authenticated;
