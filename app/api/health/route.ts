import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  const required = ["DATABASE_URL", "NEXT_PUBLIC_API_BASE_URL"]

  const env: Record<string, boolean> = {}
  const missing: string[] = []

  for (const key of required) {
    const present = typeof process.env[key] !== "undefined" && process.env[key] !== ""
    env[key] = !!present
    if (!present) {missing.push(key)}
  }

  // DB diagnostics
  const db: Record<string, unknown> = {}
  try {
    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )
    db.tables = tables.rows.map((r) => r.tablename)

    const tiers = await query<{ name: string }>(`SELECT name FROM license_tiers ORDER BY name`)
    db.license_tiers = tiers.rows.map((r) => r.name)

    db.connected = true
  } catch (e) {
    db.connected = false
    db.error = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({ ok: missing.length === 0, env, missing, db })
}
