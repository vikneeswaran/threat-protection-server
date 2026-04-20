// Database types for KuaminiThreatProtectAgent

export type UserRole = "super_admin" | "admin" | "operator" | "viewer"
export type EndpointOS = "windows" | "macos" | "linux"
export type EndpointStatus = "online" | "offline" | "disconnected"
export type PolicyType =
  | "real_time_protection"
  | "scheduled_scan"
  | "exclusions"
  | "threat_actions"
  | "network_protection"
  | "device_control"
export type ThreatSeverity = "critical" | "high" | "medium" | "low" | "info"
export type ThreatStatus = "detected" | "quarantined" | "killed" | "allowed" | "resolved"
export type ThreatActionType = "quarantine" | "kill" | "allow" | "restore" | "delete"
export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "policy_change"
  | "policy_assign"
  | "policy_unassign"
  | "threat_action"
  | "license_allocate"
  | "license_revoke"
  | "user_create"
  | "user_update"
  | "user_delete"
  | "account_create"
  | "account_update"
  | "settings_change"

export interface LicenseTier {
  id: string
  name: string
  min_endpoints: number
  max_endpoints: number
  price_per_endpoint: number
  support_type: "none" | "email" | "email_phone"
  response_time: string | null
  trial_days: number
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  name: string
  parent_account_id: string | null
  level: number
  license_tier_id: string | null
  total_licenses: number
  allocated_licenses: number
  used_licenses: number
  license_expires_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined fields
  license_tier?: LicenseTier
  parent_account?: Account
}

export interface Profile {
  id: string
  account_id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined fields
  account?: Account
}

export interface Endpoint {
  id: string
  account_id: string
  hostname: string
  os: EndpointOS
  os_version: string | null
  agent_version: string | null
  agent_id: string | null
  ip_address: string | null
  mac_address: string | null
  status: EndpointStatus
  last_seen_at: string | null
  registered_at: string
  created_at: string
  updated_at: string
}

export interface Policy {
  id: string
  account_id: string
  name: string
  description: string | null
  type: PolicyType
  config: Record<string, unknown>
  is_default: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Threat {
  id: string
  account_id: string
  endpoint_id: string
  name: string
  description: string | null
  severity: ThreatSeverity
  status: ThreatStatus
  file_path: string | null
  file_hash: string | null
  process_name: string | null
  detection_engine: string | null
  detected_at: string
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  endpoint?: Endpoint
}

export interface ThreatAction {
  id: string
  threat_id: string
  action: ThreatActionType
  performed_by: string | null
  notes: string | null
  performed_at: string
}

export interface AuditLog {
  id: string
  account_id: string
  user_id: string | null
  action: AuditAction
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
  // Joined fields
  user?: Profile
}

export interface AccountSettings {
  id: string
  account_id: string
  settings: {
    theme?: "light" | "dark"
    notifications_enabled?: boolean
    email_alerts?: boolean
    auto_quarantine?: boolean
    scan_schedule?: string
    target_agent_version?: string
    [key: string]: unknown
  }
  locked_settings: string[]
  created_at: string
  updated_at: string
}

export interface LicenseAllocation {
  id: string
  from_account_id: string
  to_account_id: string
  quantity: number
  allocated_by: string | null
  allocated_at: string
  revoked_at: string | null
  revoked_by: string | null
}

// Dashboard stats types
export interface DashboardStats {
  total_endpoints: number
  online_endpoints: number
  offline_endpoints: number
  total_threats: number
  critical_threats: number
  high_threats: number
  medium_threats: number
  low_threats: number
  available_licenses: number
  used_licenses: number
}
