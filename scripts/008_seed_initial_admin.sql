-- Seed first local admin user for clean-slate AWS deployment
-- Usage (psql):
--   \set admin_email 'admin@kuaminisystems.com'
--   \set admin_password 'ChangeMe123!'
--   \set admin_full_name 'Kuamini Admin'
--   \set org_name 'Kuamini Systems'
--   \i scripts/008_seed_initial_admin.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_email TEXT := :'admin_email';
  v_password TEXT := :'admin_password';
  v_full_name TEXT := :'admin_full_name';
  v_org_name TEXT := :'org_name';
  v_user_id UUID;
  v_account_id UUID;
  v_tier_id UUID;
BEGIN
  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RAISE EXCEPTION 'admin_email is required';
  END IF;

  IF v_password IS NULL OR length(v_password) < 8 THEN
    RAISE EXCEPTION 'admin_password must be at least 8 characters';
  END IF;

  SELECT id INTO v_tier_id FROM license_tiers WHERE name = 'free' LIMIT 1;
  IF v_tier_id IS NULL THEN
    RAISE EXCEPTION 'license_tiers not seeded. Run 004_seed_license_tiers.sql first';
  END IF;

  INSERT INTO app_users (email, password_hash, full_name, email_verified, is_active)
  VALUES (
    lower(v_email),
    crypt(v_password, gen_salt('bf', 12)),
    NULLIF(v_full_name, ''),
    TRUE,
    TRUE
  )
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = COALESCE(EXCLUDED.full_name, app_users.full_name),
        email_verified = TRUE,
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_user_id;

  INSERT INTO accounts (name, level, license_tier_id, total_licenses, allocated_licenses, used_licenses, is_active)
  VALUES (
    COALESCE(NULLIF(v_org_name, ''), 'Kuamini Organization'),
    1,
    v_tier_id,
    5,
    0,
    0,
    TRUE
  )
  RETURNING id INTO v_account_id;

  INSERT INTO profiles (id, account_id, email, full_name, role, is_active)
  VALUES (v_user_id, v_account_id, lower(v_email), NULLIF(v_full_name, ''), 'super_admin', TRUE)
  ON CONFLICT (id) DO UPDATE
    SET account_id = EXCLUDED.account_id,
        role = 'super_admin',
        is_active = TRUE,
        updated_at = NOW();
END $$;
