import { redirect } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { UsersList } from "@/components/security-agent/users-list"
import { CreateUserDialog } from "@/components/security-agent/create-user-dialog"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"
import type { Profile } from "@/lib/types/database"

export default async function UsersPage() {
  const { user, profile } = await requireConsoleContext()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    redirect("/securityAgent/dashboard")
  }

  const usersResult = await query<Profile>(
    `
      SELECT
        id::text,
        account_id::text,
        email,
        full_name,
        role::text as role,
        is_active,
        created_at,
        updated_at
      FROM profiles
      WHERE account_id = $1
      ORDER BY created_at DESC
    `,
    [profile.account.id],
  )

  return (
    <>
      <SecurityHeader title="Users" subtitle="Manage users in your organization" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex justify-end">
          <CreateUserDialog accountId={profile.account.id} currentUserRole={profile.role} currentUserId={user.id} />
        </div>

        <UsersList users={usersResult.rows} currentUserId={user.id} currentUserRole={profile.role} />
      </main>
    </>
  )
}
