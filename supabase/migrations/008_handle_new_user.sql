-- Allow users to insert their own row.
-- Needed so the onboarding PATCH can upsert (insert on first save).
-- A handle_new_user trigger is not viable here because phone is NOT NULL
-- and is only collected at onboarding time, not at signup.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_insert_own'
  ) THEN
    EXECUTE 'CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id)';
  END IF;
END$$;
