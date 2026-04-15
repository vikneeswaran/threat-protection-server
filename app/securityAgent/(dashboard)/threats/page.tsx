import { SecurityHeader } from "@/components/security-agent/header"
import { ThreatsList } from "@/components/security-agent/threats-list"
import { ThreatFilters } from "@/components/security-agent/threat-filters"
import { ThreatStats } from "@/components/security-agent/threat-stats"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"

type ThreatRow = {
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
  endpoint_os: "windows" | "macos" | "linux" | null
}

export default async function ThreatsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string; search?: string }>
}) {
  const params = await searchParams
  const { user, profile } = await requireConsoleContext()

  const whereClauses = ["t.account_id = $1"]
  const values: unknown[] = [profile.account.id]

  if (params.severity && params.severity !== "all") {
    values.push(params.severity)
    whereClauses.push(`t.severity::text = $${values.length}`)
  }

  if (params.status && params.status !== "all") {
    values.push(params.status)
    whereClauses.push(`t.status::text = $${values.length}`)
  }

  if (params.search) {
    values.push(`%${params.search}%`)
    whereClauses.push(`(t.name ILIKE $${values.length} OR t.file_path ILIKE $${values.length})`)
  }

  const threatsResult = await query<ThreatRow>(
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
        e.hostname as endpoint_hostname,
        e.os::text as endpoint_os
      FROM threats t
      LEFT JOIN endpoints e ON e.id = t.endpoint_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY t.detected_at DESC
      LIMIT 100
    `,
    values,
  )

  const allThreatsResult = await query<Pick<ThreatRow, "severity" | "status">>(
    `SELECT severity::text as severity, status::text as status FROM threats WHERE account_id = $1`,
    [profile.account.id],
  )
  const allThreats = allThreatsResult.rows

  const stats = {
    total: allThreats.length,
    critical: allThreats.filter((t) => t.severity === "critical").length,
    high: allThreats.filter((t) => t.severity === "high").length,
    medium: allThreats.filter((t) => t.severity === "medium").length,
    low: allThreats.filter((t) => t.severity === "low").length,
    info: allThreats.filter((t) => t.severity === "info").length,
    detected: allThreats.filter((t) => t.status === "detected").length,
    quarantined: allThreats.filter((t) => t.status === "quarantined").length,
    resolved: allThreats.filter((t) => t.status === "resolved").length,
  }

  const threats = threatsResult.rows.map((threat) => ({
    ...threat,
    endpoint: threat.endpoint_hostname
      ? { hostname: threat.endpoint_hostname, os: threat.endpoint_os ?? "linux" }
      : null,
  }))

  return (
    <>
      <SecurityHeader title="Threats" subtitle="Monitor and respond to security threats" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <ThreatStats stats={stats} />
        <ThreatFilters stats={stats} currentFilters={params} />
        <ThreatsList threats={threats as never[]} userRole={profile.role} userId={user.id} accountId={profile.account.id} />
      </main>
    </>
  )
}
