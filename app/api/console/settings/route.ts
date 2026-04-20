import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getConsoleProfile } from "@/lib/auth/console"
import { getSessionUser } from "@/lib/auth/session"
import { getCommonInstallerVersions } from "@/lib/agent-versions"

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getConsoleProfile(user.id)
  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const settings = body?.settings

  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 })
  }

  const targetAgentVersion =
    typeof settings.target_agent_version === "string" ? settings.target_agent_version.trim() : undefined

  if (targetAgentVersion && targetAgentVersion !== "latest") {
    const selectableVersions = await getCommonInstallerVersions(3)
    if (!selectableVersions.includes(targetAgentVersion)) {
      return NextResponse.json(
        {
          error: "Invalid target agent version. You can only select from the latest 3 available versions.",
          allowedVersions: selectableVersions,
        },
        { status: 400 },
      )
    }
  }

  await query(
    `
      INSERT INTO account_settings (account_id, settings)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (account_id)
      DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()
    `,
    [profile.account.id, JSON.stringify(settings)],
  )

  await query(
    `
      INSERT INTO audit_logs (account_id, user_id, action, entity_type, details)
      VALUES ($1, $2, 'settings_change', 'settings', $3::jsonb)
    `,
    [profile.account.id, user.id, JSON.stringify({ changed: settings })],
  )

  return NextResponse.json({ ok: true })
}
