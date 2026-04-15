import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { getConsoleProfile } from "@/lib/auth/console"
import { getSessionUser } from "@/lib/auth/session"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getConsoleProfile(user.id)
  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const name = String(body?.name || "").trim()
  const licensesToAllocate = Number.parseInt(String(body?.licenses || "0"), 10)
  const availableLicenses = profile.account.total_licenses - profile.account.used_licenses - profile.account.allocated_licenses

  if (!name || Number.isNaN(licensesToAllocate) || licensesToAllocate < 1) {
    return NextResponse.json({ error: "Invalid sub-account payload" }, { status: 400 })
  }

  if (licensesToAllocate > availableLicenses) {
    return NextResponse.json({ error: `You can only allocate up to ${availableLicenses} licenses` }, { status: 400 })
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const accountResult = await client.query<{ id: string }>(
      `
        INSERT INTO accounts (name, parent_account_id, level, license_tier_id, total_licenses, license_expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id::text
      `,
      [name, profile.account.id, profile.account.level + 1, profile.account.license_tier_id, licensesToAllocate, profile.account.license_expires_at],
    )

    await client.query(
      `UPDATE accounts SET allocated_licenses = allocated_licenses + $1 WHERE id = $2`,
      [licensesToAllocate, profile.account.id],
    )

    await client.query(
      `
        INSERT INTO license_allocations (from_account_id, to_account_id, quantity, allocated_by)
        VALUES ($1, $2, $3, $4)
      `,
      [profile.account.id, accountResult.rows[0].id, licensesToAllocate, user.id],
    )

    await client.query(
      `
        INSERT INTO audit_logs (account_id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'account_create', 'account', $3, $4::jsonb)
      `,
      [profile.account.id, user.id, accountResult.rows[0].id, JSON.stringify({ name, licenses: licensesToAllocate })],
    )

    await client.query("COMMIT")
    return NextResponse.json({ ok: true, id: accountResult.rows[0].id })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Create sub-account error:", error)
    return NextResponse.json({ error: "Failed to create sub-account" }, { status: 500 })
  } finally {
    client.release()
  }
}
