import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { ThreatsList } from "@/components/security-agent/threats-list"
import { ThreatFilters } from "@/components/security-agent/threat-filters"
import { ThreatStats } from "@/components/security-agent/threat-stats"

export default async function ThreatsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string; search?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/securityAgent/auth/login")
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, account:accounts(*)")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    redirect("/securityAgent/auth/setup")
  }

  // Build query with filters
  let query = supabase
    .from("threats")
    .select(`
      *,
      endpoint:endpoints(hostname, os)
    `)
    .eq("account_id", profile.account.id)
    .order("detected_at", { ascending: false })

  if (params.severity && params.severity !== "all") {
    query = query.eq("severity", params.severity)
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status)
  }

  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,file_path.ilike.%${params.search}%`)
  }

  const { data: threats } = await query.limit(100)

  // Get stats for all threats
  const { data: allThreats } = await supabase
    .from("threats")
    .select("severity, status")
    .eq("account_id", profile.account.id)

  const stats = {
    total: allThreats?.length || 0,
    critical: allThreats?.filter((t) => t.severity === "critical").length || 0,
    high: allThreats?.filter((t) => t.severity === "high").length || 0,
    medium: allThreats?.filter((t) => t.severity === "medium").length || 0,
    low: allThreats?.filter((t) => t.severity === "low").length || 0,
    info: allThreats?.filter((t) => t.severity === "info").length || 0,
    detected: allThreats?.filter((t) => t.status === "detected").length || 0,
    quarantined: allThreats?.filter((t) => t.status === "quarantined").length || 0,
    resolved: allThreats?.filter((t) => t.status === "resolved").length || 0,
  }

  return (
    <>
      <SecurityHeader title="Threats" subtitle="Monitor and respond to security threats" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <ThreatStats stats={stats} />
        <ThreatFilters stats={stats} currentFilters={params} />
        <ThreatsList threats={threats || []} userRole={profile.role} userId={user.id} accountId={profile.account.id} />
      </main>
    </>
  )
}
