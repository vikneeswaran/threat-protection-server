import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getConsoleProfile } from "@/lib/auth/console"
import { getSessionUser } from "@/lib/auth/session"
import type { PolicyType } from "@/lib/types/database"

const allowedRoles = new Set(["super_admin", "admin"])

function getDefaultConfig(policyType: PolicyType) {
  switch (policyType) {
    case "real_time_protection":
      return { enabled: true, scan_on_access: true, scan_on_write: true }
    case "scheduled_scan":
      return { schedule: "daily", time: "02:00", scan_type: "quick" }
    case "exclusions":
      return { paths: [], extensions: [], processes: [] }
    case "threat_actions":
      return { critical: "quarantine", high: "quarantine", medium: "alert", low: "log", info: "log" }
    case "network_protection":
      return { enabled: true, block_malicious: true, block_list: [] }
    case "device_control":
      return { usb_enabled: true, allow_read: true, allow_write: false }
    default:
      return {}
  }
}

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
  const name = String(body?.name || "").trim()
  const description = String(body?.description || "").trim() || null
  const type = String(body?.type || "") as PolicyType
  const isDefault = Boolean(body?.isDefault)
  const validTypes: PolicyType[] = ["real_time_protection", "scheduled_scan", "exclusions", "threat_actions", "network_protection", "device_control"]

  if (!name || !validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid policy payload" }, { status: 400 })
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const policyResult = await client.query<{ id: string }>(
      `
        INSERT INTO policies (account_id, name, description, type, config, is_default, created_by)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        RETURNING id::text
      `,
      [profile.account.id, name, description, type, JSON.stringify(getDefaultConfig(type)), isDefault, user.id],
    )

    await client.query(
      `
        INSERT INTO audit_logs (account_id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'policy_change', 'policy', $3, $4::jsonb)
      `,
      [profile.account.id, user.id, policyResult.rows[0].id, JSON.stringify({ name, type, action: "created" })],
    )

    await client.query("COMMIT")
    return NextResponse.json({ ok: true, id: policyResult.rows[0].id })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Create policy error:", error)
    return NextResponse.json({ error: "Failed to create policy" }, { status: 500 })
  } finally {
    client.release()
  }
}
