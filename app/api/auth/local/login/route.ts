import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { query } from "@/lib/db"
import { createSession } from "@/lib/auth/session"
import { ensureLocalAuthSchema } from "@/lib/auth/bootstrap"

type LoginUserRow = {
  id: string
  email: string
  password_hash: string | null
  is_active: boolean
  email_verified: boolean
}

export async function POST(request: Request) {
  try {
    await ensureLocalAuthSchema()

    const body = await request.json()
    const email = String(body?.email || "").trim().toLowerCase()
    const password = String(body?.password || "")

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const result = await query<LoginUserRow>(
      `
        SELECT id, email, password_hash, is_active, email_verified
        FROM app_users
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    )

    const user = result.rows[0]
    if (!user || !user.password_hash || !user.is_active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Check if email is verified
    if (!user.email_verified) {
      return NextResponse.json(
        { error: "Please verify your email address before logging in. Check your inbox for the verification link." },
        { status: 403 }
      )
    }

    const matches = await bcrypt.compare(password, user.password_hash)
    if (!matches) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    await query(`UPDATE app_users SET last_login_at = NOW() WHERE id = $1`, [user.id])
    await createSession(user.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Local login error:", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
