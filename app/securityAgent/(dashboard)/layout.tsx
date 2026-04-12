import type React from "react"
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { SecuritySidebar } from "@/components/security-agent/sidebar"
import { getSessionUser } from "@/lib/auth/session"
import { query } from "@/lib/db"
import type { Account, Profile } from "@/lib/types/database"

type ProfileWithAccountRow = {
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
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/securityAgent/auth/login")
  }

  let profile: (Profile & { account: Account }) | null = null
  try {
    const result = await query<ProfileWithAccountRow>(
      `
        SELECT
          p.id,
          p.account_id AS profile_account_id,
          p.email,
          p.full_name,
          p.role::text as role,
          p.is_active,
          p.created_at,
          p.updated_at,
          a.id as account_id,
          a.name AS account_name,
          a.parent_account_id,
          a.level,
          a.license_tier_id,
          a.total_licenses,
          a.allocated_licenses,
          a.used_licenses,
          a.license_expires_at,
          a.is_active as account_is_active,
          a.created_at as account_created_at,
          a.updated_at as account_updated_at
        FROM profiles p
        INNER JOIN accounts a ON a.id = p.account_id
        WHERE p.id = $1
        LIMIT 1
      `,
      [user.id]
    )

    const row = result.rows[0]
    if (row) {
      profile = {
        id: row.id,
        account_id: row.profile_account_id,
        email: row.email,
        full_name: row.full_name,
        role: row.role,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        account: {
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
        },
      }
    }
  } catch (err) {
    console.info("[app] Dashboard layout profile exception:", err)
  }

  if (!profile) {
    // Profile doesn't exist - redirect to setup page
    redirect("/securityAgent/auth/setup")
  }

  return (
    <SidebarProvider>
      <SecuritySidebar profile={profile} account={profile.account} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
