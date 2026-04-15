import { SecurityHeader } from "@/components/security-agent/header"
import { PoliciesList } from "@/components/security-agent/policies-list"
import { CreatePolicyDialog } from "@/components/security-agent/create-policy-dialog"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"

type PolicyRow = {
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

export default async function PoliciesPage() {
  const { user, profile } = await requireConsoleContext({ redirectTo: "/securityAgent/auth/login" })

  const policiesResult = await query<PolicyRow>(
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
      WHERE p.account_id = $1
      ORDER BY p.created_at DESC
    `,
    [profile.account.id],
  )

  const policyCountsResult = await query<{ policy_id: string }>(
    `
      SELECT ep.policy_id::text
      FROM endpoint_policies ep
      INNER JOIN endpoints e ON e.id = ep.endpoint_id
      WHERE e.account_id = $1
    `,
    [profile.account.id],
  )

  const policyUsage = policyCountsResult.rows.reduce(
    (acc, curr) => {
      acc[curr.policy_id] = (acc[curr.policy_id] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const policies = policiesResult.rows.map((policy) => ({
    ...policy,
    created_by_user: policy.created_by_email
      ? { full_name: policy.created_by_full_name, email: policy.created_by_email }
      : null,
  }))

  return (
    <>
      <SecurityHeader title="Policies" subtitle="Manage security policies for your endpoints" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex justify-end">
          {["super_admin", "admin"].includes(profile.role) && (
            <CreatePolicyDialog accountId={profile.account.id} userId={user.id} />
          )}
        </div>

        <PoliciesList policies={policies as never[]} policyUsage={policyUsage} userRole={profile.role} />
      </main>
    </>
  )
}
