import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getConsoleProfile } from "@/lib/auth/console"
import { getSessionUser } from "@/lib/auth/session"
import type { UserRole } from "@/lib/types/database"

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
  const email = String(body?.email || "").trim().toLowerCase()
  const fullName = String(body?.fullName || "").trim() || null
  const role = String(body?.role || "viewer") as UserRole
  const allowedRoles: UserRole[] = profile.role === "super_admin" ? ["admin", "operator", "viewer"] : ["operator", "viewer"]

  if (!email || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid user invitation payload" }, { status: 400 })
  }

  await query(
    `
      INSERT INTO audit_logs (account_id, user_id, action, entity_type, details)
      VALUES ($1, $2, 'user_create', 'user', $3::jsonb)
    `,
    [profile.account.id, user.id, JSON.stringify({ email, fullName, role, invited: true })],
  )

  return NextResponse.json({ ok: true, invited: true })
}
