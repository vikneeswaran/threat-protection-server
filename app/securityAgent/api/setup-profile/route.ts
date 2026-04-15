import { NextResponse } from "next/server"
import { getPool, query } from "@/lib/db"
import { getSessionUser } from "@/lib/auth/session"
import { getConsoleProfile } from "@/lib/auth/console"

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { fullName, organizationName, licenseTier } = await request.json()

    const existingProfile = await getConsoleProfile(user.id)

    if (existingProfile) {
      return NextResponse.json({ message: "Profile already exists" })
    }

    const tierResult = await query<{ id: string; max_endpoints: number; trial_days: number | null }>(
      `SELECT id::text, max_endpoints, trial_days FROM license_tiers WHERE name = $1 LIMIT 1`,
      [licenseTier || "free"],
    )
    const tierData = tierResult.rows[0]

    if (!tierData) {
      return NextResponse.json({ error: "License tier not found. Please run the seed script." }, { status: 400 })
    }

    // Calculate license expiry for free tier
    const expiresAt =
      tierData.trial_days > 0 ? new Date(Date.now() + tierData.trial_days * 24 * 60 * 60 * 1000).toISOString() : null

    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const accountResult = await client.query<{ id: string }>(
        `
          INSERT INTO accounts (name, level, license_tier_id, total_licenses, license_expires_at)
          VALUES ($1, 1, $2, $3, $4)
          RETURNING id::text
        `,
        [organizationName || "My Organization", tierData.id, tierData.max_endpoints, expiresAt],
      )

      await client.query(
        `
          INSERT INTO profiles (id, account_id, email, full_name, role, is_active)
          VALUES ($1, $2, $3, $4, 'super_admin', TRUE)
        `,
        [user.id, accountResult.rows[0].id, user.email, fullName || null],
      )

      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Setup error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
