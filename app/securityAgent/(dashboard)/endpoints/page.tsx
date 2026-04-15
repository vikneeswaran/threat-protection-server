import { SecurityHeader } from "@/components/security-agent/header"
import { EndpointsList } from "@/components/security-agent/endpoints-list"
import { EndpointFilters } from "@/components/security-agent/endpoint-filters"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"
import { withComputedStatuses } from "@/lib/endpoint-status"

type EndpointRow = {
  id: string
  account_id: string
  hostname: string
  os: "windows" | "macos" | "linux"
  os_version: string | null
  agent_version: string | null
  agent_id: string | null
  ip_address: string | null
  mac_address: string | null
  status: "online" | "offline" | "disconnected"
  last_seen_at: string | null
  registered_at: string
  created_at: string
  updated_at: string
}

export default async function EndpointsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; os?: string; search?: string }>
}) {
  const params = await searchParams
  const { profile } = await requireConsoleContext()

  const whereClauses = ["account_id = $1"]
  const values: unknown[] = [profile.account.id]

  if (params.os && params.os !== "all") {
    values.push(params.os)
    whereClauses.push(`os::text = $${values.length}`)
  }

  if (params.search) {
    values.push(`%${params.search}%`)
    whereClauses.push(`(hostname ILIKE $${values.length} OR ip_address ILIKE $${values.length})`)
  }

  const endpointsResult = await query<EndpointRow>(
    `
      SELECT
        id::text,
        account_id::text,
        hostname,
        os::text as os,
        os_version,
        agent_version,
        agent_id,
        ip_address,
        mac_address,
        status::text as status,
        last_seen_at,
        registered_at,
        created_at,
        updated_at
      FROM endpoints
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
    `,
    values,
  )

  // Compute actual status based on last_seen_at
  const endpointsWithComputedStatus = withComputedStatuses(endpointsResult.rows)

  const filteredEndpoints =
    params.status && params.status !== "all"
      ? endpointsWithComputedStatus.filter((endpoint) => endpoint.computed_status === params.status)
      : endpointsWithComputedStatus

  const threatCountsResult = await query<{ endpoint_id: string; threat_count: string }>(
    `
      SELECT endpoint_id::text, COUNT(*)::text as threat_count
      FROM threats
      WHERE account_id = $1 AND status = 'detected'
      GROUP BY endpoint_id
    `,
    [profile.account.id],
  )

  const threatCounts = threatCountsResult.rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.endpoint_id] = Number(row.threat_count)
    return acc
  }, {})

  const endpointsWithThreats = filteredEndpoints.map((endpoint) => ({
    ...endpoint,
    activeThreats: threatCounts[endpoint.id] || 0,
  }))

  const stats = {
    total: endpointsWithComputedStatus.length,
    online: endpointsWithComputedStatus.filter((e) => e.computed_status === "online").length,
    offline: endpointsWithComputedStatus.filter((e) => e.computed_status === "offline").length,
    disconnected: endpointsWithComputedStatus.filter((e) => e.computed_status === "disconnected").length,
    windows: endpointsWithComputedStatus.filter((e) => e.os === "windows").length,
    macos: endpointsWithComputedStatus.filter((e) => e.os === "macos").length,
    linux: endpointsWithComputedStatus.filter((e) => e.os === "linux").length,
  }

  return (
    <>
      <SecurityHeader title="Endpoints" subtitle={`${stats.total} endpoints registered`} />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <EndpointFilters stats={stats} currentFilters={params} />
        <EndpointsList endpoints={endpointsWithThreats} userRole={profile.role} />
      </main>
    </>
  )
}
