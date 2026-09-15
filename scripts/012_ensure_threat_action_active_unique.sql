-- Migration: enforce a single active threat action command per threat/action pair
CREATE UNIQUE INDEX IF NOT EXISTS uq_threat_action_commands_active
ON threat_action_commands (threat_id, action)
WHERE status IN ('pending', 'running');
