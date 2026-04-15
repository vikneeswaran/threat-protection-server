import { EndpointTrayUI } from "@/components/endpoint-tray-ui"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"

export default async function EndpointTrayPage() {
  const { profile } = await requireConsoleContext()

  const endpointResult = await query<{ id: string; hostname: string }>(
    `
      SELECT id::text, hostname
      FROM endpoints
      WHERE account_id = $1
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [profile.account.id],
  )
  const endpoint = endpointResult.rows[0]

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <EndpointTrayUI endpointId={endpoint?.id} hostname={endpoint?.hostname} />
    </div>
  )
}
