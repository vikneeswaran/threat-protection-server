import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { query } from "@/lib/db"
import { generateVerificationToken, getVerificationEmailTemplate, getVerificationEmailPlainText } from "@/lib/email/verification"
import { sendVerificationEmail } from "@/lib/email/send"
import { ensureLocalAuthSchema } from "@/lib/auth/bootstrap"

type LicenseTierRow = { id: string }

export async function POST(request: Request) {
  try {
    await ensureLocalAuthSchema()

    const body = await request.json()

    const organizationName = String(body?.organizationName || "").trim()
    const fullName = String(body?.fullName || "").trim()
    const email = String(body?.email || "").trim().toLowerCase()
    const password = String(body?.password || "")
    const licenseTier = String(body?.licenseTier || "free").trim().toLowerCase()

    if (!organizationName || !fullName || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existing = await query<{ id: string }>(`SELECT id FROM app_users WHERE email = $1 LIMIT 1`, [email])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 })
    }

    const tierResult = await query<LicenseTierRow>(`SELECT id FROM license_tiers WHERE name = $1 LIMIT 1`, [licenseTier || "free"])
    const tierId = tierResult.rows[0]?.id

    if (!tierId) {
      return NextResponse.json({ error: "Invalid license tier" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // Create user with email_verified = FALSE
    const created = await query<{ user_id: string }>(
      `
      WITH created_user AS (
        INSERT INTO app_users (email, password_hash, full_name, email_verified, is_active)
        VALUES ($1, $2, $3, FALSE, TRUE)
        RETURNING id
      ),
      created_account AS (
        INSERT INTO accounts (name, level, license_tier_id, total_licenses, allocated_licenses, used_licenses, is_active)
        VALUES ($4, 1, $5, 5, 0, 0, TRUE)
        RETURNING id
      )
      INSERT INTO profiles (id, account_id, email, full_name, role, is_active)
      SELECT cu.id, ca.id, $1, $3, 'super_admin', TRUE
      FROM created_user cu, created_account ca
      RETURNING id as user_id
      `,
      [email, passwordHash, fullName, organizationName, tierId]
    )

    const userId = created.rows[0]?.user_id
    if (!userId) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
    }

    // Generate verification token
    const { token, tokenHash } = generateVerificationToken()

    // Store token hash in database with 24-hour expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await query(
      `
      INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [userId, tokenHash, expiresAt]
    )

    // Build verification link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const verificationLink = `${baseUrl}/securityAgent/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`

    // Send verification email
    const htmlTemplate = getVerificationEmailTemplate(verificationLink, fullName, organizationName)
    const textTemplate = getVerificationEmailPlainText(verificationLink, fullName, organizationName)

    await sendVerificationEmail(email, fullName, organizationName, verificationLink, htmlTemplate, textTemplate)

    // Return success without creating session
    return NextResponse.json({
      ok: true,
      message: "Account created. Please check your email to verify your address.",
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Local register error:", msg)
    // Return detail in non-prod OR for DB structural errors so we can diagnose
    return NextResponse.json(
      { error: "Registration failed", detail: msg },
      { status: 500 }
    )
  }
}
