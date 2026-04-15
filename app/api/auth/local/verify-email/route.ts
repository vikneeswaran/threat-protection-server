import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { query } from "@/lib/db"
import { createSession } from "@/lib/auth/session"

interface VerifyRequest {
  token: string
  email: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as VerifyRequest
    const { token, email } = body

    if (!token || !email) {
      return NextResponse.json({ error: "Token and email are required" }, { status: 400 })
    }

    // Hash the token to match what's stored in DB
    const tokenHash = createHash("sha256").update(token).digest("hex")

    // Find the user and verify token
    const tokenResult = await query<{ user_id: string }>(
      `
      SELECT user_id
      FROM email_verification_tokens
      WHERE token_hash = $1
        AND expires_at > NOW()
        AND verified_at IS NULL
      LIMIT 1
      `,
      [tokenHash]
    )

    const tokenRecord = tokenResult.rows[0]
    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      )
    }

    const userId = tokenRecord.user_id

    // Verify the email matches the user
    const userResult = await query<{ email: string }>(
      `SELECT email FROM app_users WHERE id = $1 LIMIT 1`,
      [userId]
    )

    const user = userResult.rows[0]
    if (!user || user.email !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 400 })
    }

    // Mark email as verified and mark token as used
    await query(
      `
      UPDATE app_users
      SET email_verified = TRUE, updated_at = NOW()
      WHERE id = $1
      `,
      [userId]
    )

    await query(
      `
      UPDATE email_verification_tokens
      SET verified_at = NOW()
      WHERE token_hash = $1
      `,
      [tokenHash]
    )

    // Create session for the user
    await createSession(userId)

    return NextResponse.json({
      ok: true,
      message: "Email verified successfully. You are now logged in.",
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Email verification error:", msg)
    return NextResponse.json(
      { error: "Verification failed", detail: msg },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get("token")
    const email = url.searchParams.get("email")

    if (!token || !email) {
      return NextResponse.json({ error: "Token and email are required" }, { status: 400 })
    }

    // Hash the token to match what's stored in DB
    const tokenHash = createHash("sha256").update(token).digest("hex")

    // Find the user and verify token
    const tokenResult = await query<{ user_id: string }>(
      `
      SELECT user_id
      FROM email_verification_tokens
      WHERE token_hash = $1
        AND expires_at > NOW()
        AND verified_at IS NULL
      LIMIT 1
      `,
      [tokenHash]
    )

    const tokenRecord = tokenResult.rows[0]
    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      )
    }

    const userId = tokenRecord.user_id

    // Verify the email matches the user
    const userResult = await query<{ email: string }>(
      `SELECT email FROM app_users WHERE id = $1 LIMIT 1`,
      [userId]
    )

    const user = userResult.rows[0]
    if (!user || user.email !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 400 })
    }

    // Mark email as verified and mark token as used
    await query(
      `
      UPDATE app_users
      SET email_verified = TRUE, updated_at = NOW()
      WHERE id = $1
      `,
      [userId]
    )

    await query(
      `
      UPDATE email_verification_tokens
      SET verified_at = NOW()
      WHERE token_hash = $1
      `,
      [tokenHash]
    )

    // Create session for the user
    await createSession(userId)

    return NextResponse.json({
      ok: true,
      message: "Email verified successfully. You are now logged in.",
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Email verification error:", msg)
    return NextResponse.json(
      { error: "Verification failed", detail: msg },
      { status: 500 }
    )
  }
}
