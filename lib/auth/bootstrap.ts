import { query } from "@/lib/db"

async function ensureExtension(extensionName: string) {
  try {
    await query(`CREATE EXTENSION IF NOT EXISTS ${extensionName}`)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("already exists") || message.includes("duplicate key")) {
      return
    }
    throw error
  }
}

export async function ensureLocalAuthSchema() {
  await ensureExtension('"uuid-ossp"')
  await ensureExtension('pgcrypto')

  await query(`
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
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      session_token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      ip_address TEXT,
      user_agent TEXT
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_at TIMESTAMPTZ
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS license_tiers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL UNIQUE,
      min_endpoints INTEGER NOT NULL DEFAULT 0,
      max_endpoints INTEGER NOT NULL DEFAULT 0,
      price_per_endpoint NUMERIC NOT NULL DEFAULT 0,
      support_type TEXT NOT NULL DEFAULT 'none',
      response_time TEXT,
      trial_days INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
      level INTEGER NOT NULL DEFAULT 1,
      license_tier_id UUID REFERENCES license_tiers(id) ON DELETE SET NULL,
      total_licenses INTEGER NOT NULL DEFAULT 0,
      allocated_licenses INTEGER NOT NULL DEFAULT 0,
      used_licenses INTEGER NOT NULL DEFAULT 0,
      license_expires_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'email_verified'
      ) THEN
        ALTER TABLE app_users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'password_hash'
      ) THEN
        ALTER TABLE app_users ADD COLUMN password_hash TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'last_login_at'
      ) THEN
        ALTER TABLE app_users ADD COLUMN last_login_at TIMESTAMPTZ;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'app_sessions' AND column_name = 'ip_address'
      ) THEN
        ALTER TABLE app_sessions ADD COLUMN ip_address TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'app_sessions' AND column_name = 'user_agent'
      ) THEN
        ALTER TABLE app_sessions ADD COLUMN user_agent TEXT;
      END IF;
    END $$;
  `)

  await query(`
    INSERT INTO license_tiers (name, min_endpoints, max_endpoints, price_per_endpoint, support_type, response_time, trial_days)
    SELECT 'free', 0, 5, 0, 'email', '24h', 14
    WHERE NOT EXISTS (SELECT 1 FROM license_tiers WHERE name = 'free')
  `)

  await query(`
    INSERT INTO app_users (id, email, full_name, email_verified, is_active)
    SELECT p.id, p.email, p.full_name, TRUE, p.is_active
    FROM profiles p
    LEFT JOIN app_users u ON u.id = p.id
    WHERE u.id IS NULL
    ON CONFLICT (id) DO NOTHING
  `)

  await query(`
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
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email)
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id)
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at)
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id)
  `)
}
