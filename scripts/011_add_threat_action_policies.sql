-- Migration: Add threat_action_policies table for persistent threat actions by file hash
CREATE TABLE IF NOT EXISTS threat_action_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  file_hash TEXT NOT NULL,
  action threat_action_type NOT NULL, -- 'allow', 'quarantine', etc.
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_threat_action_policies_account_hash ON threat_action_policies(account_id, file_hash);
