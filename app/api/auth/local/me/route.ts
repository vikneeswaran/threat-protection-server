import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/session"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const accountResult = await query<{ name: string }>(`SELECT name FROM accounts WHERE id = $1 LIMIT 1`, [user.account_id])
    return NextResponse.json({ user: { ...user, account_name: accountResult.rows[0]?.name || null } })
  } catch (error) {
    console.error("Local me error:", error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
