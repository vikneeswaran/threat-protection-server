-- Local auth replacement for Supabase auth
-- Run against RDS database after schema restore.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Local users table
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- 2) Session table (server-side sessions)
CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);

-- 3) Remove Supabase auth FK on profiles and attach to app_users.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'profiles'
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%auth.users%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'profiles'
      AND c.contype = 'f'
      AND c.conname = 'profiles_id_fkey_app_users'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_id_fkey_app_users
      FOREIGN KEY (id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4) Backfill app_users from existing profiles (password_hash remains null).
INSERT INTO app_users (id, email, full_name, email_verified, is_active)
SELECT p.id, p.email, p.full_name, TRUE, p.is_active
FROM profiles p
LEFT JOIN app_users u ON u.id = p.id
WHERE u.id IS NULL;

-- 5) Keep updated_at maintained
CREATE OR REPLACE FUNCTION app_users_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_app_users_updated_at ON app_users;
CREATE TRIGGER trigger_app_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION app_users_set_updated_at();
