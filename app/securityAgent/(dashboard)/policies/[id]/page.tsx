import { notFound } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { PolicyDetails } from "@/components/security-agent/policy-details"
import { PolicyEndpoints } from "@/components/security-agent/policy-endpoints"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"

type PolicyDetailRow = {
  id: string
  account_id: string
  name: string
  description: string | null
  type: "real_time_protection" | "scheduled_scan" | "exclusions" | "threat_actions" | "network_protection" | "device_control"
  config: Record<string, unknown>
  is_default: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  created_by_full_name: string | null
  created_by_email: string | null
}

type PolicyEndpointRow = {
  assigned_at: string
  endpoint_id: string
  endpoint_account_id: string
  endpoint_hostname: string
  endpoint_os: "windows" | "macos" | "linux"
  endpoint_os_version: string | null
  endpoint_agent_version: string | null
  endpoint_agent_id: string | null
  endpoint_ip_address: string | null
  endpoint_mac_address: string | null
  endpoint_status: "online" | "offline" | "disconnected"
  endpoint_last_seen_at: string | null
  endpoint_registered_at: string
  endpoint_created_at: string
  endpoint_updated_at: string
}

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile } = await requireConsoleContext()

  const policyResult = await query<PolicyDetailRow>(
    `
      SELECT
        p.id::text,
        p.account_id::text,
        p.name,
        p.description,
        p.type::text as type,
        p.config,
        p.is_default,
        p.is_active,
        p.created_by::text,
        p.created_at,
        p.updated_at,
        creator.full_name as created_by_full_name,
        creator.email as created_by_email
      FROM policies p
      LEFT JOIN profiles creator ON creator.id = p.created_by
      WHERE p.id = $1 AND p.account_id = $2
      LIMIT 1
    `,
    [id, profile.account.id],
  )
  const policyRow = policyResult.rows[0]

  if (!policyRow) {
    notFound()
  }

  const assignedEndpointsResult = await query<PolicyEndpointRow>(
    `
      SELECT
        ep.assigned_at,
        e.id::text as endpoint_id,
        e.account_id::text as endpoint_account_id,
        e.hostname as endpoint_hostname,
        e.os::text as endpoint_os,
        e.os_version as endpoint_os_version,
        e.agent_version as endpoint_agent_version,
        e.agent_id as endpoint_agent_id,
        e.ip_address as endpoint_ip_address,
        e.mac_address as endpoint_mac_address,
        e.status::text as endpoint_status,
        e.last_seen_at as endpoint_last_seen_at,
        e.registered_at as endpoint_registered_at,
        e.created_at as endpoint_created_at,
        e.updated_at as endpoint_updated_at
      FROM endpoint_policies ep
      INNER JOIN endpoints e ON e.id = ep.endpoint_id
      WHERE ep.policy_id = $1
      ORDER BY ep.assigned_at DESC
    `,
    [id],
  )

  const policy = {
    ...policyRow,
    created_by_user: policyRow.created_by_email
      ? { full_name: policyRow.created_by_full_name, email: policyRow.created_by_email }
      : null,
  }

  const assignedEndpoints = assignedEndpointsResult.rows.map((row) => ({
    assigned_at: row.assigned_at,
    endpoint: {
      id: row.endpoint_id,
      account_id: row.endpoint_account_id,
      hostname: row.endpoint_hostname,
      os: row.endpoint_os,
      os_version: row.endpoint_os_version,
      agent_version: row.endpoint_agent_version,
      agent_id: row.endpoint_agent_id,
      ip_address: row.endpoint_ip_address,
      mac_address: row.endpoint_mac_address,
      status: row.endpoint_status,
      last_seen_at: row.endpoint_last_seen_at,
      registered_at: row.endpoint_registered_at,
      created_at: row.endpoint_created_at,
      updated_at: row.endpoint_updated_at,
    },
  }))

  return (
    <>
      <SecurityHeader title={policy.name} subtitle="Policy details and configuration" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Configuration</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints ({assignedEndpoints?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <PolicyDetails policy={policy as never} userRole={profile.role} />
          </TabsContent>

          <TabsContent value="endpoints" className="mt-6">
            <PolicyEndpoints
              assignedEndpoints={assignedEndpoints as never[]}
              policyId={id}
              userRole={profile.role}
            />
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
