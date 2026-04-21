-- Add public IP capture for endpoints (backward-compatible)
ALTER TABLE endpoints
ADD COLUMN IF NOT EXISTS public_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_endpoints_public_ip ON endpoints(public_ip);
