-- Seed first local admin user for clean-slate AWS deployment
-- Usage (psql):
--   psql "sslmode=require" -v ON_ERROR_STOP=1 \
--     -v admin_email='admin@kuaminisystems.com' \
--     -v admin_password='ChangeMe123!' \
--     -v admin_full_name='Kuamini Admin' \
--     -v org_name='Kuamini Systems' \
--     -f scripts/008_seed_initial_admin.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Get or create license tier first
WITH tier AS (
  SELECT id FROM license_tiers WHERE name = 'free' LIMIT 1
)
-- Insert user
INSERT INTO app_users (email, password_hash, full_name, email_verified, is_active)
SELECT 
  lower(:'admin_email'),
  crypt(:'admin_password', gen_salt('bf', 12)),
  :'admin_full_name',
  TRUE,
  TRUE
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      full_name = EXCLUDED.full_name,
      email_verified = TRUE,
      is_active = TRUE,
      updated_at = NOW();

-- Get user_id from just-inserted user
WITH user_data AS (
  SELECT id FROM app_users WHERE email = lower(:'admin_email')
),
-- Create account
account_data AS (
  INSERT INTO accounts (name, level, license_tier_id, total_licenses, allocated_licenses, used_licenses, is_active)
  SELECT 
    :'org_name',
    1,
    (SELECT id FROM license_tiers WHERE name = 'free'),
    5,
    0,
    0,
    TRUE
  RETURNING id
)
-- Create profile
INSERT INTO profiles (id, account_id, email, full_name, role, is_active)
SELECT 
  u.id,
  a.id,
  lower(:'admin_email'),
  :'admin_full_name',
  'super_admin',
  TRUE
FROM user_data u, account_data a
ON CONFLICT (id) DO UPDATE
  SET account_id = EXCLUDED.account_id,
      role = 'super_admin',
      is_active = TRUE,
      updated_at = NOW();
