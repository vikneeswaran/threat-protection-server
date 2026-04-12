import { NextResponse } from "next/server"
import { clearSession } from "@/lib/auth/session"

export async function POST() {
  try {
    await clearSession()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Local logout error:", error)
    return NextResponse.json({ error: "Logout failed" }, { status: 500 })
  }
}
