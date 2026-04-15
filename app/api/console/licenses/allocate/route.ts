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
  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const toAccountId = String(body?.toAccountId || "").trim()
  const quantity = Number.parseInt(String(body?.quantity || "0"), 10)
  const availableLicenses = profile.account.total_licenses - profile.account.used_licenses - profile.account.allocated_licenses

  if (!toAccountId || Number.isNaN(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Invalid allocation payload" }, { status: 400 })
  }

  if (quantity > availableLicenses) {
    return NextResponse.json({ error: `You can only allocate up to ${availableLicenses} licenses` }, { status: 400 })
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const targetResult = await client.query<{ name: string }>(
      `SELECT name FROM accounts WHERE id = $1 AND parent_account_id = $2 LIMIT 1`,
      [toAccountId, profile.account.id],
    )

    if (targetResult.rows.length === 0) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "Sub-account not found" }, { status: 404 })
    }

    await client.query(`UPDATE accounts SET total_licenses = total_licenses + $1 WHERE id = $2`, [quantity, toAccountId])
    await client.query(`UPDATE accounts SET allocated_licenses = allocated_licenses + $1 WHERE id = $2`, [quantity, profile.account.id])

    await client.query(
      `INSERT INTO license_allocations (from_account_id, to_account_id, quantity, allocated_by) VALUES ($1, $2, $3, $4)`,
      [profile.account.id, toAccountId, quantity, user.id],
    )

    await client.query(
      `
        INSERT INTO audit_logs (account_id, user_id, action, entity_type, details)
        VALUES ($1, $2, 'license_allocate', 'license', $3::jsonb)
      `,
      [profile.account.id, user.id, JSON.stringify({ to_account: targetResult.rows[0].name, quantity })],
    )

    await client.query("COMMIT")
    return NextResponse.json({ ok: true })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Allocate licenses error:", error)
    return NextResponse.json({ error: "Failed to allocate licenses" }, { status: 500 })
  } finally {
    client.release()
  }
}
