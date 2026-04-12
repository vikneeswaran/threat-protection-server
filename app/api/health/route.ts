import { NextResponse } from "next/server"

export async function GET() {
  const required = ["DATABASE_URL", "NEXT_PUBLIC_API_BASE_URL"]

  const env: Record<string, boolean> = {}
  const missing: string[] = []

  for (const key of required) {
    const present = typeof process.env[key] !== "undefined" && process.env[key] !== ""
    env[key] = !!present
    if (!present) {missing.push(key)}
  }

  return NextResponse.json({ ok: missing.length === 0, env, missing })
}
