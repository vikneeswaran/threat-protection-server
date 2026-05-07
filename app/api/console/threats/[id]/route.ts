import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getConsoleProfile } from "@/lib/auth/console"
import { getSessionUser } from "@/lib/auth/session"

// GET /api/console/threats/[id]
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getConsoleProfile(user.id)
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const threatId = params.id
  if (!threatId) {
    return NextResponse.json({ error: "Missing threat id" }, { status: 400 })
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    // Get all account IDs: current + children
    const accountsResult = await client.query<{ id: string }>(
      `WITH RECURSIVE children AS (
        SELECT id FROM accounts WHERE id = $1
        UNION ALL
        SELECT a.id FROM accounts a INNER JOIN children c ON a.parent_account_id = c.id
      ) SELECT id FROM children`,
      [profile.account.id],
    )
    const accountIds = accountsResult.rows.map((row) => row.id)
    // Lookup threat in any of these accounts
    const result = await client.query(
      `SELECT id::text, account_id::text, endpoint_id::text, name, description, severity::text, status::text, file_path, file_hash, process_name, detection_engine, detected_at, resolved_at, resolved_by::text, created_at, updated_at FROM threats WHERE id = $1 AND account_id = ANY($2) LIMIT 1`,
      [threatId, accountIds],
    )
    const threat = result.rows[0]
    if (!threat) {
      return NextResponse.json({ error: "Threat not found" }, { status: 404 })
    }
    return NextResponse.json({ threat })
  } catch {
    return NextResponse.json({ error: "Failed to fetch threat details" }, { status: 500 })
  } finally {
    client.release()
  }
}
