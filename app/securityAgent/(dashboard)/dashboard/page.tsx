import { redirect } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { StatsCard } from "@/components/security-agent/stats-card"
import { ThreatSeverityChart } from "@/components/security-agent/threat-severity-chart"
import { EndpointStatusChart } from "@/components/security-agent/endpoint-status-chart"
import { RecentThreatsTable } from "@/components/security-agent/recent-threats-table"
import { LicenseOverview } from "@/components/security-agent/license-overview"
import { Monitor, AlertTriangle, Shield, Key } from "lucide-react"
import { withComputedStatuses } from "@/lib/endpoint-status"
import { getSessionUser } from "@/lib/auth/session"
import { query } from "@/lib/db"

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect("/securityAgent/auth/login")
  }

  const profileResult = await query<{
    id: string
    email: string
    full_name: string | null
    account_id: string
    role: "super_admin" | "admin" | "operator" | "viewer"
    account_name: string
    total_licenses: number
    allocated_licenses: number
    used_licenses: number
    license_expires_at: string | null
    tier_id: string | null
    tier_name: string | null
    support_type: "none" | "email" | "email_phone" | null
    response_time: string | null
  }>(
    `
      SELECT
        p.id,
        p.email,
        p.full_name,
        p.account_id::text,
        p.role::text as role,
        a.name as account_name,
        a.total_licenses,
        a.allocated_licenses,
        a.used_licenses,
        a.license_expires_at,
        lt.id::text as tier_id,
        lt.name as tier_name,
        lt.support_type,
        lt.response_time
      FROM profiles p
      INNER JOIN accounts a ON a.id = p.account_id
      LEFT JOIN license_tiers lt ON lt.id = a.license_tier_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [user.id]
  )

  const profile = profileResult.rows[0]
  if (!profile) {
    redirect("/securityAgent/auth/setup")
  }

  const endpointsResult = await query<{ id: string; status: "online" | "offline" | "disconnected"; last_seen_at: string | null }>(
    `SELECT id::text, status::text as status, last_seen_at FROM endpoints WHERE account_id = $1`,
    [profile.account_id]
  )
  const endpoints = endpointsResult.rows

  const endpointsWithComputedStatus = endpoints ? withComputedStatuses(endpoints) : []
  const endpointStats = {
    total: endpointsWithComputedStatus.length,
    online: endpointsWithComputedStatus.filter((e) => e.computed_status === "online").length,
    offline: endpointsWithComputedStatus.filter((e) => e.computed_status === "offline").length,
    disconnected: endpointsWithComputedStatus.filter((e) => e.computed_status === "disconnected").length,
  }

  const threatsResult = await query<{ severity: "critical" | "high" | "medium" | "low" | "info"; status: "detected" | "quarantined" | "killed" | "allowed" | "resolved" }>(
    `SELECT severity::text as severity, status::text as status FROM threats WHERE account_id = $1`,
    [profile.account_id]
  )
  const threats = threatsResult.rows

  const threatStats = {
    total: threats?.length || 0,
    critical: threats?.filter((t) => t.severity === "critical").length || 0,
    high: threats?.filter((t) => t.severity === "high").length || 0,
    medium: threats?.filter((t) => t.severity === "medium").length || 0,
    low: threats?.filter((t) => t.severity === "low").length || 0,
    info: threats?.filter((t) => t.severity === "info").length || 0,
    unresolved: threats?.filter((t) => t.status === "detected").length || 0,
  }

  const recentThreatsResult = await query<{
    id: string
    account_id: string
    endpoint_id: string
    name: string
    description: string | null
    severity: "critical" | "high" | "medium" | "low" | "info"
    status: "detected" | "quarantined" | "killed" | "allowed" | "resolved"
    file_path: string | null
    file_hash: string | null
    process_name: string | null
    detection_engine: string | null
    detected_at: string
    resolved_at: string | null
    resolved_by: string | null
    created_at: string
    updated_at: string
    endpoint_hostname: string | null
  }>(
    `
      SELECT
        t.id::text,
        t.account_id::text,
        t.endpoint_id::text,
        t.name,
        t.description,
        t.severity::text as severity,
        t.status::text as status,
        t.file_path,
        t.file_hash,
        t.process_name,
        t.detection_engine,
        t.detected_at,
        t.resolved_at,
        t.resolved_by::text,
        t.created_at,
        t.updated_at,
        e.hostname as endpoint_hostname
      FROM threats t
      LEFT JOIN endpoints e ON e.id = t.endpoint_id
      WHERE t.account_id = $1
      ORDER BY t.detected_at DESC
      LIMIT 5
    `,
    [profile.account_id]
  )

  const recentThreats = recentThreatsResult.rows.map((t) => ({
    ...t,
    endpoint: { hostname: t.endpoint_hostname || "Unknown" },
  }))

  const availableLicenses =
    profile.total_licenses - profile.used_licenses - profile.allocated_licenses

  return (
    <>
      <SecurityHeader title="Dashboard" subtitle={`Welcome back, ${profile.full_name || profile.email}`} />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Endpoints"
            value={endpointStats.total}
            description={`${endpointStats.online} online`}
            icon={Monitor}
            variant="default"
          />
          <StatsCard
            title="Active Threats"
            value={threatStats.unresolved}
            description={`${threatStats.critical} critical`}
            icon={AlertTriangle}
            variant={threatStats.critical > 0 ? "destructive" : "default"}
          />
          <StatsCard
            title="Protection Status"
            value={
              endpointStats.total > 0 ? `${Math.round((endpointStats.online / endpointStats.total) * 100)}%` : "N/A"
            }
            description="Endpoints protected"
            icon={Shield}
            variant="success"
          />
          <StatsCard
            title="Available Licenses"
            value={availableLicenses}
            description={`of ${profile.total_licenses} total`}
            icon={Key}
            variant="default"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ThreatSeverityChart data={threatStats} />
          <EndpointStatusChart data={endpointStats} />
          <LicenseOverview
            account={{
              id: profile.account_id,
              name: profile.account_name,
              parent_account_id: null,
              level: 1,
              license_tier_id: profile.tier_id,
              total_licenses: profile.total_licenses,
              allocated_licenses: profile.allocated_licenses,
              used_licenses: profile.used_licenses,
              license_expires_at: profile.license_expires_at,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              license_tier: profile.tier_id
                ? {
                    id: profile.tier_id,
                    name: profile.tier_name || "free",
                    min_endpoints: 1,
                    max_endpoints: 5,
                    price_per_endpoint: 0,
                    support_type: profile.support_type || "none",
                    response_time: profile.response_time,
                    trial_days: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }
                : undefined,
            }}
          />
        </div>

        {/* Recent Threats */}
        <RecentThreatsTable threats={recentThreats as never[]} />
      </main>
    </>
  )
}
