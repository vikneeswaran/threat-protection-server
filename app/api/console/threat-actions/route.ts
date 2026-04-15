import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getConsoleProfile } from "@/lib/auth/console"
import { getSessionUser } from "@/lib/auth/session"
import type { ThreatActionType } from "@/lib/types/database"

const allowedRoles = new Set(["super_admin", "admin", "operator"])

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getConsoleProfile(user.id)
  if (!profile || !allowedRoles.has(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const threatId = String(body?.threatId || "").trim()
  const action = String(body?.action || "").trim() as ThreatActionType
  const notes = String(body?.notes || "").trim() || null
  const validActions: ThreatActionType[] = ["quarantine", "kill", "allow", "restore", "delete"]

  if (!threatId || !validActions.includes(action)) {
    return NextResponse.json({ error: "Invalid threat action payload" }, { status: 400 })
  }

  const newStatus =
    action === "quarantine"
      ? "quarantined"
      : action === "kill"
        ? "killed"
        : action === "allow"
          ? "allowed"
          : action === "restore"
            ? "detected"
            : "resolved"

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const threatResult = await client.query<{ name: string; status: string; account_id: string }>(
      `SELECT name, status::text as status, account_id::text FROM threats WHERE id = $1 LIMIT 1`,
      [threatId],
    )

    const threat = threatResult.rows[0]
    if (!threat || threat.account_id !== profile.account.id) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "Threat not found" }, { status: 404 })
    }

    await client.query(
      `
        UPDATE threats
        SET status = $2,
            resolved_at = CASE WHEN $2 IN ('resolved', 'allowed') THEN NOW() ELSE NULL END,
            resolved_by = CASE WHEN $2 IN ('resolved', 'allowed') THEN $3 ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1
      `,
      [threatId, newStatus, user.id],
    )

    await client.query(
      `INSERT INTO threat_actions (threat_id, action, performed_by, notes) VALUES ($1, $2, $3, $4)`,
      [threatId, action, user.id, notes],
    )

    await client.query(
      `
        INSERT INTO audit_logs (account_id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'threat_action', 'threat', $3, $4::jsonb)
      `,
      [profile.account.id, user.id, threatId, JSON.stringify({ threat_name: threat.name, action, previous_status: threat.status, new_status: newStatus })],
    )

    await client.query("COMMIT")
    return NextResponse.json({ ok: true })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Threat action error:", error)
    return NextResponse.json({ error: "Failed to perform threat action" }, { status: 500 })
  } finally {
    client.release()
  }
}
