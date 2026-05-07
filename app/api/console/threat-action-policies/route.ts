import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getSessionUser } from "@/lib/auth/session"

// GET /api/console/threat-action-policies?file_hash=... (optional)
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const fileHash = url.searchParams.get("file_hash")
  const pool = getPool()
  const client = await pool.connect()
  try {
    let query = `SELECT account_id, file_hash, action, updated_at FROM threat_action_policies WHERE account_id = (SELECT account_id FROM profiles WHERE user_id = $1 LIMIT 1)`
    const params: string[] = [user.id]
    if (fileHash) {
      query += ` AND file_hash = $2`
      params.push(fileHash)
    }
    const result = await client.query(query, params)
    return NextResponse.json({ policies: result.rows })
  } catch {
    return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 })
  } finally {
    client.release()
  }
}
