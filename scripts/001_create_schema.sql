-- KuaminiThreatProtectAgent Database Schema
-- Multi-tenant threat protection management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. LICENSE TIERS (Reference Table)
-- ============================================
CREATE TABLE IF NOT EXISTS license_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  min_endpoints INTEGER NOT NULL,
  max_endpoints INTEGER NOT NULL,
  price_per_endpoint DECIMAL(10,2) NOT NULL,
  support_type TEXT NOT NULL, -- 'none', 'email', 'email_phone'
  response_time TEXT, -- e.g., '12-48 hours', '2-8 hours', '<15 mins'
  trial_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default license tiers
INSERT INTO license_tiers (name, min_endpoints, max_endpoints, price_per_endpoint, support_type, response_time, trial_days) VALUES
  ('free', 1, 5, 0.00, 'none', NULL, 15),
  ('basic', 1, 50, 5.00, 'email', '12-48 hours', 0),
  ('pro', 50, 500, 10.00, 'email_phone', '2-8 hours', 0),
  ('enterprise', 500, 50000, 10.00, 'email_phone', '<15 mins', 0)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. ACCOUNTS (Multi-tenant with 5 levels)
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  parent_account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  license_tier_id UUID REFERENCES license_tiers(id),
  total_licenses INTEGER NOT NULL DEFAULT 0,
  allocated_licenses INTEGER NOT NULL DEFAULT 0, -- licenses given to sub-accounts
  used_licenses INTEGER NOT NULL DEFAULT 0, -- licenses used by endpoints
  license_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. USER ROLES (Reference Table)
-- ============================================
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'operator', 'viewer');

-- ============================================
-- 4. LOCAL USERS (replaces legacy external auth users)
-- ============================================
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  full_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. USERS / PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ACCOUNT SETTINGS (with inheritance/lock)
-- ============================================
CREATE TABLE IF NOT EXISTS account_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  locked_settings TEXT[] DEFAULT '{}', -- array of setting keys locked by parent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. ENDPOINTS (Agents)
-- ============================================
CREATE TYPE endpoint_os AS ENUM ('windows', 'macos', 'linux');
CREATE TYPE endpoint_status AS ENUM ('online', 'offline', 'disconnected');

CREATE TABLE IF NOT EXISTS endpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  os endpoint_os NOT NULL,
  os_version TEXT,
  agent_version TEXT,
  ip_address TEXT,
  public_ip TEXT,
  mac_address TEXT,
  status endpoint_status DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. POLICIES
-- ============================================
CREATE TYPE policy_type AS ENUM (
  'real_time_protection',
  'scheduled_scan',
  'exclusions',
  'threat_actions',
  'network_protection',
  'device_control'
);

CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type policy_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. ENDPOINT-POLICY ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS endpoint_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  UNIQUE(endpoint_id, policy_id)
);

-- ============================================
-- 9. THREATS
-- ============================================
CREATE TYPE threat_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE threat_status AS ENUM ('detected', 'quarantined', 'killed', 'allowed', 'resolved');

CREATE TABLE IF NOT EXISTS threats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  severity threat_severity NOT NULL,
  status threat_status DEFAULT 'detected',
  file_path TEXT,
  file_hash TEXT,
  process_name TEXT,
  detection_engine TEXT, -- e.g., 'signature', 'heuristic', 'behavioral'
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. THREAT ACTIONS (History)
-- ============================================
CREATE TYPE threat_action_type AS ENUM ('quarantine', 'kill', 'allow', 'restore', 'delete');

CREATE TABLE IF NOT EXISTS threat_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  threat_id UUID NOT NULL REFERENCES threats(id) ON DELETE CASCADE,
  action threat_action_type NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  notes TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. AUDIT LOGS
-- ============================================
CREATE TYPE audit_action AS ENUM (
  'login', 'logout',
  'create', 'update', 'delete',
  'policy_change', 'policy_assign', 'policy_unassign',
  'threat_action',
  'license_allocate', 'license_revoke',
  'user_create', 'user_update', 'user_delete',
  'account_create', 'account_update', 'settings_change'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action audit_action NOT NULL,
  entity_type TEXT, -- 'endpoint', 'policy', 'threat', 'user', 'account', 'license'
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. LICENSE ALLOCATIONS (Parent to Child)
-- ============================================
CREATE TABLE IF NOT EXISTS license_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  allocated_by UUID REFERENCES profiles(id),
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account ON profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_account ON endpoints(account_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_status ON endpoints(status);
CREATE INDEX IF NOT EXISTS idx_policies_account ON policies(account_id);
CREATE INDEX IF NOT EXISTS idx_threats_account ON threats(account_id);
CREATE INDEX IF NOT EXISTS idx_threats_endpoint ON threats(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_threats_status ON threats(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account ON audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
