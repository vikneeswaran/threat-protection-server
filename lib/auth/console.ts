import { redirect } from "next/navigation"
import { getSessionUser, type AuthUser } from "@/lib/auth/session"
import { query } from "@/lib/db"
import type { Account, LicenseTier, Profile } from "@/lib/types/database"

export type ConsoleProfile = Profile & {
  account: Account & {
    license_tier?: LicenseTier
  }
}

type ConsoleProfileRow = {
  id: string
  profile_account_id: string
  email: string
  full_name: string | null
  role: "super_admin" | "admin" | "operator" | "viewer"
  is_active: boolean
  created_at: string
  updated_at: string
  account_id: string
  account_name: string
  parent_account_id: string | null
  level: number
  license_tier_id: string | null
  total_licenses: number
  allocated_licenses: number
  used_licenses: number
  license_expires_at: string | null
  account_is_active: boolean
  account_created_at: string
  account_updated_at: string
  tier_name: string | null
  min_endpoints: number | null
  max_endpoints: number | null
  price_per_endpoint: number | null
  support_type: "none" | "email" | "email_phone" | null
  response_time: string | null
  trial_days: number | null
  tier_created_at: string | null
  tier_updated_at: string | null
}

function mapConsoleProfile(row: ConsoleProfileRow): ConsoleProfile {
  const account: ConsoleProfile["account"] = {
    id: row.account_id,
    name: row.account_name,
    parent_account_id: row.parent_account_id,
    level: row.level,
    license_tier_id: row.license_tier_id,
    total_licenses: row.total_licenses,
    allocated_licenses: row.allocated_licenses,
    used_licenses: row.used_licenses,
    license_expires_at: row.license_expires_at,
    is_active: row.account_is_active,
    created_at: row.account_created_at,
    updated_at: row.account_updated_at,
  }

  if (row.license_tier_id && row.tier_name) {
    account.license_tier = {
      id: row.license_tier_id,
      name: row.tier_name,
      min_endpoints: row.min_endpoints ?? 0,
      max_endpoints: row.max_endpoints ?? 0,
      price_per_endpoint: row.price_per_endpoint ?? 0,
      support_type: row.support_type ?? "none",
      response_time: row.response_time,
      trial_days: row.trial_days ?? 0,
      created_at: row.tier_created_at ?? row.account_created_at,
      updated_at: row.tier_updated_at ?? row.account_updated_at,
    }
  }

  return {
    id: row.id,
    account_id: row.profile_account_id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    account,
  }
}

export async function getConsoleProfile(userId: string): Promise<ConsoleProfile | null> {
  const result = await query<ConsoleProfileRow>(
    `
      SELECT
        p.id::text,
        p.account_id::text AS profile_account_id,
        p.email,
        p.full_name,
        p.role::text as role,
        p.is_active,
        p.created_at,
        p.updated_at,
        a.id::text as account_id,
        a.name AS account_name,
        a.parent_account_id::text,
        a.level,
        a.license_tier_id::text,
        a.total_licenses,
        a.allocated_licenses,
        a.used_licenses,
        a.license_expires_at,
        a.is_active as account_is_active,
        a.created_at as account_created_at,
        a.updated_at as account_updated_at,
        lt.name as tier_name,
        lt.min_endpoints,
        lt.max_endpoints,
        lt.price_per_endpoint,
        lt.support_type,
        lt.response_time,
        lt.trial_days,
        lt.created_at as tier_created_at,
        lt.updated_at as tier_updated_at
      FROM profiles p
      INNER JOIN accounts a ON a.id = p.account_id
      LEFT JOIN license_tiers lt ON lt.id = a.license_tier_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = result.rows[0]
  return row ? mapConsoleProfile(row) : null
}

export async function requireConsoleContext(options?: {
  roles?: Array<AuthUser["role"]>
  redirectTo?: string
}) {
  const user = await getSessionUser()
  if (!user) {
    redirect("/securityAgent/auth/login")
  }

  const profile = await getConsoleProfile(user.id)
  if (!profile) {
    redirect(options?.redirectTo ?? "/securityAgent/auth/setup")
  }

  if (options?.roles && !options.roles.includes(profile.role)) {
    redirect(options.redirectTo ?? "/securityAgent/dashboard")
  }

  return { user, profile }
}
