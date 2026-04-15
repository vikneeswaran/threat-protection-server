import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/session"
import { query } from "@/lib/db"

function getUninstallCommands(os: string) {
  switch (os.toLowerCase()) {
    case "macos":
      return {
        os: "macos",
        commands: [
          "sudo launchctl unload /Library/LaunchDaemons/com.kuamini.agent.plist || true",
          "sudo rm -rf /usr/local/kuamini /etc/kuamini /var/log/kuamini /Library/LaunchDaemons/com.kuamini.agent.plist",
        ],
      }
    case "linux":
      return {
        os: "linux",
        commands: [
          "sudo systemctl stop kuamini-agent || true",
          "sudo systemctl disable kuamini-agent || true",
          "sudo rm -rf /opt/kuamini /etc/kuamini /var/log/kuamini /etc/systemd/system/kuamini-agent.service",
          "sudo systemctl daemon-reload",
        ],
      }
    case "windows":
      return {
        os: "windows",
        commands: [
          "powershell -Command \"Unregister-ScheduledTask -TaskName 'KuaminiThreatProtectAgent' -Confirm:$false -ErrorAction SilentlyContinue; Remove-Item -Recurse -Force 'C:\\Program Files\\Kuamini','C:\\ProgramData\\Kuamini' -ErrorAction SilentlyContinue\"",
        ],
      }
    default:
      return { os, commands: [] }
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { endpoint_id, agent_id, os } = await request.json()

    if (!endpoint_id && !agent_id) {
      return NextResponse.json({ error: "endpoint_id or agent_id is required" }, { status: 400 })
    }
    // Get profile/role
    const profileResult = await query<{ id: string; account_id: string; role: string }>(
      `SELECT id::text, account_id::text, role FROM profiles WHERE id = $1 LIMIT 1`,
      [user.id],
    )
    const profile = profileResult.rows[0]

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (!["super_admin", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Locate endpoint within the admin's account
    const endpointResult = endpoint_id
      ? await query<{
          id: string
          account_id: string
          hostname: string | null
          os: string | null
          agent_id: string | null
          mac_address: string | null
          ip_address: string | null
        }>(
          `
            SELECT id::text, account_id::text, hostname, os, agent_id, mac_address, ip_address
            FROM endpoints
            WHERE account_id = $1 AND id = $2
            LIMIT 1
          `,
          [profile.account_id, endpoint_id],
        )
      : await query<{
          id: string
          account_id: string
          hostname: string | null
          os: string | null
          agent_id: string | null
          mac_address: string | null
          ip_address: string | null
        }>(
          `
            SELECT id::text, account_id::text, hostname, os, agent_id, mac_address, ip_address
            FROM endpoints
            WHERE account_id = $1 AND agent_id = $2
            LIMIT 1
          `,
          [profile.account_id, agent_id],
        )
    const endpoint = endpointResult.rows[0]

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Delete endpoint (triggers will decrement used_licenses)
    try {
      await query(`DELETE FROM endpoints WHERE id = $1`, [endpoint.id])
    } catch (deleteError) {
      console.error("Failed to delete endpoint:", deleteError)
      return NextResponse.json({ error: "Failed to delete endpoint" }, { status: 500 })
    }

    // Audit log
    await query(
      `
        INSERT INTO audit_logs (account_id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'delete', 'endpoint', $3, $4::jsonb)
      `,
      [
        endpoint.account_id,
        user.id,
        endpoint.id,
        JSON.stringify({
          hostname: endpoint.hostname,
          agent_id: endpoint.agent_id,
          mac_address: endpoint.mac_address,
          ip_address: endpoint.ip_address,
        }),
      ],
    )

    const uninstall = getUninstallCommands(os || endpoint.os || "")

    return NextResponse.json({
      success: true,
      endpoint_id: endpoint.id,
      account_id: endpoint.account_id,
      uninstall,
    })
  } catch (error) {
    console.error("Uninstall agent error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
