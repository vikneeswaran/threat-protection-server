import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { StatsCard } from "@/components/security-agent/stats-card"
import { ThreatSeverityChart } from "@/components/security-agent/threat-severity-chart"
import { EndpointStatusChart } from "@/components/security-agent/endpoint-status-chart"
import { RecentThreatsTable } from "@/components/security-agent/recent-threats-table"
import { LicenseOverview } from "@/components/security-agent/license-overview"
import { Monitor, AlertTriangle, Shield, Key } from "lucide-react"
import { withComputedStatuses } from "@/lib/endpoint-status"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/securityAgent/auth/login")
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      *,
      account:accounts(
        *,
        license_tier:license_tiers(*)
      )
    `)
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || error) {
    redirect("/securityAgent/auth/setup")
  }

  // Get endpoint stats
  const { data: endpoints } = await supabase.from("endpoints").select("status, last_seen_at")

  const endpointsWithComputedStatus = endpoints ? withComputedStatuses(endpoints) : []
  const endpointStats = {
    total: endpointsWithComputedStatus.length,
    online: endpointsWithComputedStatus.filter((e) => e.computed_status === "online").length,
    offline: endpointsWithComputedStatus.filter((e) => e.computed_status === "offline").length,
    disconnected: endpointsWithComputedStatus.filter((e) => e.computed_status === "disconnected").length,
  }

  // Get threat stats
  const { data: threats } = await supabase.from("threats").select("severity, status")

  const threatStats = {
    total: threats?.length || 0,
    critical: threats?.filter((t) => t.severity === "critical").length || 0,
    high: threats?.filter((t) => t.severity === "high").length || 0,
    medium: threats?.filter((t) => t.severity === "medium").length || 0,
    low: threats?.filter((t) => t.severity === "low").length || 0,
    info: threats?.filter((t) => t.severity === "info").length || 0,
    unresolved: threats?.filter((t) => t.status === "detected").length || 0,
  }

  // Get recent threats with endpoint info
  const { data: recentThreats } = await supabase
    .from("threats")
    .select(`
      *,
      endpoint:endpoints(hostname)
    `)
    .order("detected_at", { ascending: false })
    .limit(5)

  const availableLicenses =
    profile.account.total_licenses - profile.account.used_licenses - profile.account.allocated_licenses

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
            description={`of ${profile.account.total_licenses} total`}
            icon={Key}
            variant="default"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ThreatSeverityChart data={threatStats} />
          <EndpointStatusChart data={endpointStats} />
          <LicenseOverview account={profile.account} />
        </div>

        {/* Recent Threats */}
        <RecentThreatsTable threats={recentThreats || []} />
      </main>
    </>
  )
}
