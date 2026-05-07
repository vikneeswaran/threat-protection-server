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
  const requestedAction = String(body?.action || "").trim().toLowerCase()
  const action = (requestedAction === "block" ? "kill" : requestedAction) as ThreatActionType
  const notes = String(body?.notes || "").trim() || null
  const applyToAllInstances = !!body?.applyToAllInstances
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

    // Get the threat and file_hash
    const threatResult = await client.query<{
      name: string
      status: string
      account_id: string
      endpoint_id: string
      file_path: string | null
      file_hash: string | null
      process_id: number | null
    }>(
      `SELECT name, status::text as status, account_id::text, endpoint_id::text, file_path, file_hash, process_id FROM threats WHERE id = $1 LIMIT 1`,
      [threatId],
    )
    const threat = threatResult.rows[0]
    if (!threat || threat.account_id !== profile.account.id) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "Threat not found" }, { status: 404 })
    }

    let affectedThreatIds: string[] = [threatId]
    // If applyToAllInstances and file_hash is present, find all threats with same hash for account and child accounts
    if (applyToAllInstances && threat.file_hash) {
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
      // Find all threats with same file_hash in these accounts
      const threatsResult = await client.query<{ id: string }>(
        `SELECT id FROM threats WHERE file_hash = $1 AND account_id = ANY($2)`,
        [threat.file_hash, accountIds],
      )
      affectedThreatIds = threatsResult.rows.map((row) => row.id)
      if (!affectedThreatIds.includes(threatId)) {
        affectedThreatIds.push(threatId)
      }
    }

    // Update all affected threats
    await client.query(
      `
        UPDATE threats
        SET status = $2::threat_status,
            resolved_at = CASE
              WHEN $2::threat_status IN ('resolved'::threat_status, 'allowed'::threat_status) THEN NOW()
              ELSE NULL
            END,
            resolved_by = CASE
              WHEN $2::threat_status IN ('resolved'::threat_status, 'allowed'::threat_status) THEN $3::uuid
              ELSE NULL
            END,
            updated_at = NOW()
        WHERE id = ANY($1)
      `,
      [affectedThreatIds, newStatus, user.id],
    )

    // Insert threat_actions and commands for each, collect command_ids
    const commandIds: string[] = []
    for (const tid of affectedThreatIds) {
      await client.query(
        `INSERT INTO threat_actions (threat_id, action, performed_by, notes) VALUES ($1, $2, $3, $4)`,
        [tid, action, user.id, notes],
      )
      const commandResult = await client.query<{ id: string }>(
        `
          INSERT INTO threat_action_commands (
            account_id,
            endpoint_id,
            threat_id,
            action,
            status,
            created_by,
            notes,
            payload
          )
          VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7::jsonb)
          RETURNING id::text
        `,
        [
          profile.account.id,
          threat.endpoint_id,
          tid,
          action,
          user.id,
          notes,
          JSON.stringify({
            threat_name: threat.name,
            file_path: threat.file_path,
            file_hash: threat.file_hash,
            process_id: threat.process_id,
          }),
        ],
      )
      if (commandResult.rows[0]?.id) commandIds.push(commandResult.rows[0].id)
      await client.query(
        `
          INSERT INTO audit_logs (account_id, user_id, action, entity_type, entity_id, details)
          VALUES ($1, $2, 'threat_action', 'threat', $3, $4::jsonb)
        `,
        [
          profile.account.id,
          user.id,
          tid,
          JSON.stringify({
            threat_name: threat.name,
            action,
            previous_status: threat.status,
            new_status: newStatus,
          }),
        ],
      )
    }

    await client.query("COMMIT")
    // If only one threat, preserve old response shape for compatibility
    if (affectedThreatIds.length === 1 && commandIds.length === 1) {
      return NextResponse.json({ ok: true, command_id: commandIds[0] })
    }
    // Otherwise, return all affected threats
    return NextResponse.json({ ok: true, affectedThreatIds })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Threat action error:", error)
    return NextResponse.json({ error: "Failed to perform threat action" }, { status: 500 })
  } finally {
    client.release()
  }
}
