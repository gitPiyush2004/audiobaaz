-- ============================================================
-- AUDIOBAAZ — CI bootstrap (Supabase compatibility layer)
-- ============================================================
--
-- Production runs on Supabase, which provisions:
--   - the `service_role` Postgres role
--   - the `auth` schema with `auth.uid()` reading the JWT
--
-- A vanilla Postgres (Docker postgres:15, the GitHub Actions
-- service container, a fresh `apt install postgresql`) has
-- neither. Migrations that reference `service_role` or
-- `auth.uid()` would otherwise fail at parse / GRANT time on
-- those environments.
--
-- This file is the ONLY place CI-environment concerns live.
-- Application migrations (002+) assume Supabase primitives
-- already exist — they do not contain compatibility shims of
-- their own. Apply this file BEFORE schema.sql in any
-- non-Supabase Postgres.
--
-- On a real Supabase project, do NOT run this file. Supabase
-- already provides everything below; running it would add a
-- redundant CREATE ROLE call that silently no-ops, but
-- philosophically: production should never touch CI bootstrap
-- code.
--
-- The CI workflow (.github/workflows/phase1-verification.yml)
-- runs this file as the first step against the postgres:15
-- service container.
-- ============================================================


-- ----------------------------------------------------------------
-- 1 — service_role
-- ----------------------------------------------------------------
-- Supabase provisions this; vanilla Postgres does not. Migrations
-- 002–004 grant EXECUTE on their RPCs to this role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;


-- ----------------------------------------------------------------
-- 2 — auth schema + auth.uid()
-- ----------------------------------------------------------------
-- Supabase's real auth.uid() reads `current_setting('request.jwt.claims', true)`
-- and extracts `sub`. Tests run as the postgres superuser, which has
-- no JWT context, so the stub returns NULL. RLS policies that read
-- auth.uid() evaluate `<lhs> = NULL` as NULL, which RLS treats as
-- deny — the safe default.
--
-- Tests bypass RLS anyway because they run as postgres (superuser),
-- so this stub does not affect test outcomes. It exists only so
-- `CREATE POLICY` statements that reference `auth.uid()` parse
-- without error.
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE 'CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS ''SELECT NULL::UUID;'' ';
  END IF;
END
$$;
