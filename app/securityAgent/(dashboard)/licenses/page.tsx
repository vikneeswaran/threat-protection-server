import { redirect } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { LicenseDetails } from "@/components/security-agent/license-details"
import { LicenseAllocationHistory } from "@/components/security-agent/license-allocation-history"
import { LicenseTierComparison } from "@/components/security-agent/license-tier-comparison"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"
import type { Account, LicenseTier } from "@/lib/types/database"

type AllocationRow = {
  id: string
  quantity: number
  allocated_at: string
  revoked_at: string | null
  to_account_name: string | null
  allocated_by_full_name: string | null
  allocated_by_email: string | null
}

export default async function LicensesPage() {
  const { user, profile } = await requireConsoleContext()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    redirect("/securityAgent/dashboard")
  }

  const licenseTiersResult = await query<LicenseTier>(
    `
      SELECT
        id::text,
        name,
        min_endpoints,
        max_endpoints,
        price_per_endpoint,
        support_type,
        response_time,
        trial_days,
        created_at,
        updated_at
      FROM license_tiers
      ORDER BY price_per_endpoint, max_endpoints
    `,
  )

  const allocationsResult = await query<AllocationRow>(
    `
      SELECT
        la.id::text,
        la.quantity,
        la.allocated_at,
        la.revoked_at,
        to_account.name as to_account_name,
        allocator.full_name as allocated_by_full_name,
        allocator.email as allocated_by_email
      FROM license_allocations la
      LEFT JOIN accounts to_account ON to_account.id = la.to_account_id
      LEFT JOIN profiles allocator ON allocator.id = la.allocated_by
      WHERE la.from_account_id = $1
      ORDER BY la.allocated_at DESC
    `,
    [profile.account.id],
  )

  const subAccountsResult = await query<{ id: string; name: string; total_licenses: number; used_licenses: number }>(
    `
      SELECT id::text, name, total_licenses, used_licenses
      FROM accounts
      WHERE parent_account_id = $1
    `,
    [profile.account.id],
  )

  const allocations = allocationsResult.rows.map((allocation) => ({
    id: allocation.id,
    quantity: allocation.quantity,
    allocated_at: allocation.allocated_at,
    revoked_at: allocation.revoked_at,
    to_account: allocation.to_account_name ? { name: allocation.to_account_name } : null,
    allocated_by_user: allocation.allocated_by_email
      ? { full_name: allocation.allocated_by_full_name, email: allocation.allocated_by_email }
      : null,
  }))

  return (
    <>
      <SecurityHeader title="Licenses" subtitle="Manage your license allocation and usage" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <LicenseDetails account={profile.account as Account & { license_tier: LicenseTier }} subAccounts={subAccountsResult.rows} userId={user.id} />

        <div className="grid gap-6 lg:grid-cols-2">
          <LicenseAllocationHistory allocations={allocations} />
          <LicenseTierComparison tiers={licenseTiersResult.rows} currentTierId={profile.account.license_tier_id} />
        </div>
      </main>
    </>
  )
}
