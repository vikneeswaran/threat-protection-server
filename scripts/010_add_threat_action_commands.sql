-- Migration: Add immediate threat action command queue for endpoint execution

-- Ensure uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum type if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'threat_action_type') THEN
    CREATE TYPE threat_action_type AS ENUM ('quarantine', 'kill', 'allow', 'restore', 'delete');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS threat_action_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  threat_id UUID NOT NULL REFERENCES threats(id) ON DELETE CASCADE,
  action threat_action_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  created_by UUID REFERENCES profiles(id),
  notes TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  result_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_action_commands_account ON threat_action_commands(account_id);
CREATE INDEX IF NOT EXISTS idx_threat_action_commands_endpoint ON threat_action_commands(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_threat_action_commands_status ON threat_action_commands(status);
CREATE INDEX IF NOT EXISTS idx_threat_action_commands_created ON threat_action_commands(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_threat_action_commands_active
ON threat_action_commands (threat_id, action)
WHERE status IN ('pending', 'running');
