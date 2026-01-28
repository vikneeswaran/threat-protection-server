import { NextResponse } from "next/server"

export async function GET() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_REDIRECT_URL",
    "NEXT_PUBLIC_API_BASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]

  const env: Record<string, boolean> = {}
  const missing: string[] = []

  for (const key of required) {
    const present = typeof process.env[key] !== "undefined" && process.env[key] !== ""
    env[key] = !!present
    if (!present) {missing.push(key)}
  }

  return NextResponse.json({ ok: missing.length === 0, env, missing })
}
