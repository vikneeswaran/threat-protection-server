export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { SubAccountsList } from "@/components/security-agent/sub-accounts-list"
import { CreateSubAccountDialog } from "@/components/security-agent/create-sub-account-dialog"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"
import type { Account, LicenseTier } from "@/lib/types/database"

type AccountRow = Account & {
  tier_name?: string | null
  min_endpoints?: number | null
  max_endpoints?: number | null
  price_per_endpoint?: number | null
  support_type?: LicenseTier["support_type"] | null
  response_time?: string | null
  trial_days?: number | null
}

export default async function AccountsPage() {
  const { user, profile } = await requireConsoleContext()

  if (!profile || profile.role !== "super_admin") {
    redirect("/securityAgent/dashboard")
  }

  const subAccountsResult = await query<AccountRow>(
    `
      SELECT
        a.id::text,
        a.name,
        a.parent_account_id::text,
        a.level,
        a.license_tier_id::text,
        a.total_licenses,
        a.allocated_licenses,
        a.used_licenses,
        a.license_expires_at,
        a.is_active,
        a.created_at,
        a.updated_at,
        lt.name as tier_name,
        lt.min_endpoints,
        lt.max_endpoints,
        lt.price_per_endpoint,
        lt.support_type,
        lt.response_time,
        lt.trial_days
      FROM accounts a
      LEFT JOIN license_tiers lt ON lt.id = a.license_tier_id
      WHERE a.parent_account_id = $1
      ORDER BY a.created_at DESC
    `,
    [profile.account.id],
  )

  const subAccounts = subAccountsResult.rows.map((account) => ({
    ...account,
    license_tier: account.license_tier_id && account.tier_name
      ? {
          id: account.license_tier_id,
          name: account.tier_name,
          min_endpoints: account.min_endpoints ?? 0,
          max_endpoints: account.max_endpoints ?? 0,
          price_per_endpoint: account.price_per_endpoint ?? 0,
          support_type: account.support_type ?? "none",
          response_time: account.response_time ?? null,
          trial_days: account.trial_days ?? 0,
          created_at: account.created_at,
          updated_at: account.updated_at,
        }
      : undefined,
  }))

  return (
    <>
      <SecurityHeader title="Sub-Accounts" subtitle="Manage your organization's sub-accounts (up to 5 levels)" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Current Level: {profile.account.level} of 5 | Available Licenses to Allocate:{" "}
              {profile.account.total_licenses - profile.account.used_licenses - profile.account.allocated_licenses}
            </p>
          </div>
          {profile.account.level < 5 && <CreateSubAccountDialog parentAccount={profile.account} userId={user.id} />}
        </div>

        <SubAccountsList accounts={subAccounts as never[]} parentAccount={profile.account} />
      </main>
    </>
  )
}
