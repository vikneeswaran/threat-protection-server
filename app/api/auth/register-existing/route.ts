import { NextResponse } from "next/server"
import { getPool, query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, full_name, organization_name, license_tier } = body

    if (!email || !organization_name) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    const normalizedEmail = String(email).toLowerCase()
    const userResult = await query<{ id: string; email: string }>(
      `SELECT id::text, email FROM app_users WHERE email = $1 LIMIT 1`,
      [normalizedEmail],
    )
    const userData = userResult.rows[0] ?? null

    if (!userData) {
      return NextResponse.json({ message: "Local user not found for email" }, { status: 404 })
    }

    // Get the license tier details
    const tierResult = await query<{ id: string; max_endpoints: number; trial_days: number | null }>(
      `SELECT id::text, max_endpoints, trial_days FROM license_tiers WHERE name = $1 LIMIT 1`,
      [license_tier || "free"],
    )
    const tier = tierResult.rows[0]

    // Calculate expiry if trial days
    const expiresAt = tier && tier.trial_days > 0 ? new Date(Date.now() + tier.trial_days * 24 * 60 * 60 * 1000).toISOString() : null

    const existingProfile = await query<{ id: string }>(`SELECT id::text FROM profiles WHERE id = $1 LIMIT 1`, [userData.id])
    if (existingProfile.rows[0]) {
      return NextResponse.json({ message: "Profile already exists", invited: false })
    }

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
        [organization_name, tier?.id || null, tier?.max_endpoints || 0, expiresAt],
      )

      await client.query(
        `
          INSERT INTO profiles (id, account_id, email, full_name, role, is_active)
          VALUES ($1, $2, $3, $4, 'super_admin', TRUE)
        `,
        [userData.id, accountResult.rows[0].id, normalizedEmail, full_name || null],
      )

      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({ message: "ok", invited: false })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ message: "Unexpected error" }, { status: 500 })
  }
}
