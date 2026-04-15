import { notFound } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { EndpointDetails } from "@/components/security-agent/endpoint-details"
import { EndpointThreats } from "@/components/security-agent/endpoint-threats"
import { EndpointPolicies } from "@/components/security-agent/endpoint-policies"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"
import { withComputedStatus } from "@/lib/endpoint-status"

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
}

type AssignedPolicyRow = {
  assigned_at: string
  policy_id: string
  policy_account_id: string
  policy_name: string
  policy_description: string | null
  policy_type: "real_time_protection" | "scheduled_scan" | "exclusions" | "threat_actions" | "network_protection" | "device_control"
  policy_config: Record<string, unknown>
  policy_is_default: boolean
  policy_is_active: boolean
  policy_created_by: string | null
  policy_created_at: string
  policy_updated_at: string
}

export default async function EndpointDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile } = await requireConsoleContext()

  const endpointResult = await query<EndpointRow>(
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
      WHERE id = $1 AND account_id = $2
      LIMIT 1
    `,
    [id, profile.account.id],
  )
  const endpoint = endpointResult.rows[0]

  if (!endpoint) {
    notFound()
  }

  // Add computed status
  const endpointWithComputedStatus = withComputedStatus(endpoint)

  const threatsResult = await query<ThreatRow>(
    `
      SELECT
        id::text,
        account_id::text,
        endpoint_id::text,
        name,
        description,
        severity::text as severity,
        status::text as status,
        file_path,
        file_hash,
        process_name,
        detection_engine,
        detected_at,
        resolved_at,
        resolved_by::text,
        created_at,
        updated_at
      FROM threats
      WHERE endpoint_id = $1
      ORDER BY detected_at DESC
      LIMIT 20
    `,
    [id],
  )

  const assignedPoliciesResult = await query<AssignedPolicyRow>(
    `
      SELECT
        ep.assigned_at,
        p.id::text as policy_id,
        p.account_id::text as policy_account_id,
        p.name as policy_name,
        p.description as policy_description,
        p.type::text as policy_type,
        p.config as policy_config,
        p.is_default as policy_is_default,
        p.is_active as policy_is_active,
        p.created_by::text as policy_created_by,
        p.created_at as policy_created_at,
        p.updated_at as policy_updated_at
      FROM endpoint_policies ep
      INNER JOIN policies p ON p.id = ep.policy_id
      WHERE ep.endpoint_id = $1
      ORDER BY ep.assigned_at DESC
    `,
    [id],
  )

  const assignedPolicies = assignedPoliciesResult.rows.map((row) => ({
    assigned_at: row.assigned_at,
    policy: {
      id: row.policy_id,
      account_id: row.policy_account_id,
      name: row.policy_name,
      description: row.policy_description,
      type: row.policy_type,
      config: row.policy_config,
      is_default: row.policy_is_default,
      is_active: row.policy_is_active,
      created_by: row.policy_created_by,
      created_at: row.policy_created_at,
      updated_at: row.policy_updated_at,
    },
  }))

  return (
    <>
      <SecurityHeader title={endpoint.hostname} subtitle={`${endpoint.os} endpoint`} />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="threats">Threats ({threatsResult.rows.length || 0})</TabsTrigger>
            <TabsTrigger value="policies">Policies ({assignedPolicies.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <EndpointDetails endpoint={endpointWithComputedStatus} />
          </TabsContent>

          <TabsContent value="threats" className="mt-6">
            <EndpointThreats threats={threatsResult.rows as never[]} endpointId={id} userRole={profile.role} />
          </TabsContent>

          <TabsContent value="policies" className="mt-6">
            <EndpointPolicies
              assignedPolicies={assignedPolicies as never[]}
              endpointId={id}
              userRole={profile.role}
            />
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
