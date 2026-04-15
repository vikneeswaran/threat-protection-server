import { redirect } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { AuditLogsList } from "@/components/security-agent/audit-logs-list"
import { AuditLogsFilters } from "@/components/security-agent/audit-logs-filters"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"

type AuditLogRow = {
  id: string
  account_id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
  user_full_name: string | null
  user_email: string | null
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; user?: string; date?: string }>
}) {
  const params = await searchParams
  const { profile } = await requireConsoleContext()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    redirect("/securityAgent/dashboard")
  }

  const whereClauses = ["al.account_id = $1"]
  const values: unknown[] = [profile.account.id]

  if (params.action && params.action !== "all") {
    values.push(params.action)
    whereClauses.push(`al.action::text = $${values.length}`)
  }

  if (params.user && params.user !== "all") {
    values.push(params.user)
    whereClauses.push(`al.user_id = $${values.length}`)
  }

  const logsResult = await query<AuditLogRow>(
    `
      SELECT
        al.id::text,
        al.account_id::text,
        al.user_id::text,
        al.action::text,
        al.entity_type,
        al.entity_id::text,
        al.details,
        al.ip_address,
        al.user_agent,
        al.created_at,
        p.full_name as user_full_name,
        p.email as user_email
      FROM audit_logs al
      LEFT JOIN profiles p ON p.id = al.user_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY al.created_at DESC
      LIMIT 100
    `,
    values,
  )

  const usersResult = await query<{ id: string; full_name: string | null; email: string }>(
    `SELECT id::text, full_name, email FROM profiles WHERE account_id = $1 ORDER BY full_name NULLS LAST, email`,
    [profile.account.id],
  )

  const logs = logsResult.rows.map((log) => ({
    ...log,
    user: log.user_email ? { full_name: log.user_full_name, email: log.user_email } : null,
  }))

  return (
    <>
      <SecurityHeader title="Audit Logs" subtitle="Track all activity in your organization" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <AuditLogsFilters currentFilters={params} users={usersResult.rows} />
        <AuditLogsList logs={logs as never[]} />
      </main>
    </>
  )
}
