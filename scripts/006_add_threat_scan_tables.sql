-- Migration: Add Threat Scan and Remote Command Tables
-- Creates tables for scan summaries and remote scan commands

-- ============================================
-- SCAN SUMMARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scan_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  scan_id TEXT NOT NULL,
  scan_type TEXT NOT NULL, -- 'quick', 'full', 'realtime'
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  total_threats INTEGER DEFAULT 0,
  severity_breakdown JSONB DEFAULT '{
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  }',
  status TEXT DEFAULT 'completed', -- 'running', 'completed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, scan_id)
);

-- ============================================
-- SCAN COMMANDS TABLE (Remote commands from console)
-- ============================================
CREATE TABLE IF NOT EXISTS scan_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL, -- 'quick', 'full', 'realtime'
  priority INTEGER DEFAULT 1, -- 1=low, 5=urgent
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result_scan_id TEXT, -- links to scan_summaries.scan_id
  error_message TEXT,
  UNIQUE(account_id, endpoint_id, status) -- only one pending command per endpoint
);

-- ============================================
-- AGENT INSTANCED TABLE (Track agent registrations with agent_id)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL UNIQUE,
  hostname TEXT NOT NULL,
  os TEXT NOT NULL,
  os_version TEXT,
  agent_version TEXT,
  ip_address TEXT,
  mac_address TEXT,
  last_heartbeat TIMESTAMPTZ,
  last_threat_scan TIMESTAMPTZ,
  threat_count_last_scan INTEGER DEFAULT 0,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALTER THREATS TABLE TO ADD MISSING COLUMNS
-- ============================================
DO $$ 
BEGIN
  -- Add 'type' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'threats' AND column_name = 'type'
  ) THEN
    ALTER TABLE threats ADD COLUMN type TEXT DEFAULT 'unknown';
  END IF;

  -- Add 'process_id' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'threats' AND column_name = 'process_id'
  ) THEN
    ALTER TABLE threats ADD COLUMN process_id INTEGER;
  END IF;

  -- Add 'detection_source' column if it doesn't exist (for real-time vs scan detection)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'threats' AND column_name = 'detection_source'
  ) THEN
    ALTER TABLE threats ADD COLUMN detection_source TEXT DEFAULT 'unknown'; -- 'scan', 'realtime_monitor'
  END IF;
END $$;

-- ============================================
-- ALTER ENDPOINTS TABLE TO ADD AGENT_ID IF MISSING
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'endpoints' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE endpoints ADD COLUMN agent_id TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'endpoints' AND column_name = 'public_ip'
  ) THEN
    ALTER TABLE endpoints ADD COLUMN public_ip TEXT;
  END IF;
END $$;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scan_summaries_account ON scan_summaries(account_id);
CREATE INDEX IF NOT EXISTS idx_scan_summaries_endpoint ON scan_summaries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_scan_summaries_scan_type ON scan_summaries(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_summaries_created ON scan_summaries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_commands_account ON scan_commands(account_id);
CREATE INDEX IF NOT EXISTS idx_scan_commands_endpoint ON scan_commands(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_scan_commands_status ON scan_commands(status);
CREATE INDEX IF NOT EXISTS idx_scan_commands_created ON scan_commands(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_instances_account ON agent_instances(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_endpoint ON agent_instances(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_agent_id ON agent_instances(agent_id);

CREATE INDEX IF NOT EXISTS idx_threats_detection_source ON threats(detection_source);
CREATE INDEX IF NOT EXISTS idx_threats_process_id ON threats(process_id) WHERE process_id IS NOT NULL;


-- ============================================
-- CREATE THREAT_SCAN_DATA TABLE (if missing)
-- ============================================
CREATE TABLE IF NOT EXISTS threat_scan_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  threat_id UUID NOT NULL REFERENCES threats(id) ON DELETE CASCADE,
  scan_id TEXT NOT NULL,
  endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  threat_type TEXT,
  severity TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(threat_id, scan_id)
);
