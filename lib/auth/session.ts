import { cookies, headers } from "next/headers"
import { randomBytes, createHash } from "crypto"
import { query } from "@/lib/db"

const SESSION_COOKIE_NAME = "kta_session"
const SESSION_DAYS = 7

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export type AuthUser = {
  id: string
  email: string
  full_name: string | null
  role: "super_admin" | "admin" | "operator" | "viewer"
  account_id: string
}

export async function createSession(userId: string) {
  const token = randomBytes(48).toString("base64url")
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  const hdrs = await headers()
  const forwardedFor = hdrs.get("x-forwarded-for")
  const ip = forwardedFor?.split(",")[0]?.trim() || null
  const userAgent = hdrs.get("user-agent") || null

  await query(
    `
      INSERT INTO app_sessions (user_id, session_token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, tokenHash, expiresAt.toISOString(), ip, userAgent]
  )

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await query(
      `
        UPDATE app_sessions
        SET revoked_at = NOW()
        WHERE session_token_hash = $1 AND revoked_at IS NULL
      `,
      [hashToken(token)]
    )
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  const result = await query<AuthUser>(
    `
      SELECT
        u.id,
        u.email,
        p.full_name,
        p.role::text as role,
        p.account_id::text
      FROM app_sessions s
      INNER JOIN app_users u ON u.id = s.user_id
      INNER JOIN profiles p ON p.id = u.id
      WHERE s.session_token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.is_active = TRUE
        AND p.is_active = TRUE
      LIMIT 1
    `,
    [hashToken(token)]
  )

  return result.rows[0] || null
}

export async function requireSessionUser() {
  return getSessionUser()
}
