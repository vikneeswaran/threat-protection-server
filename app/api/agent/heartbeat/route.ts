import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import {
  compareVersions,
  findInstallerForOsVersion,
  findLatestInstallerForOs,
  parseVersionParts,
} from "@/lib/agent-versions"

type InstallerTargetOs = "windows" | "macos" | "linux"

function normalizeOs(value: unknown): InstallerTargetOs {
  const raw = String(value || "").toLowerCase()
  if (raw.includes("win")) {
    return "windows"
  }
  if (raw.includes("mac") || raw.includes("darwin")) {
    return "macos"
  }
  return "linux"
}

async function buildInstallerUpdateForOs(targetOs: InstallerTargetOs, selectedVersion?: string | null) {
  const appBase = (process.env.NEXT_PUBLIC_APP_URL || "https://kuaminisystems.com").replace(/\/$/, "")

  const pinnedVersion = typeof selectedVersion === "string" ? selectedVersion.trim() : ""
  const desired = pinnedVersion ? await findInstallerForOsVersion(targetOs, pinnedVersion) : null
  const latest = await findLatestInstallerForOs(targetOs)
  const resolved = desired ?? latest

  if (!resolved) {
    return null
  }

  return {
    installer_filename: resolved.file,
    latest_version: resolved.versionText,
    selected_version: pinnedVersion || null,
    download_url: `${appBase}/tray/${resolved.file}`,
    target_os: targetOs,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawAgentId = body?.agent_id
    const rawEndpointId = body?.endpoint_id
    const rawAccountId = body?.account_id
    const rawAgentVersion = body?.agent_version || body?.system_info?.agent_version
    const status = body?.status
    const system_info = body?.system_info

    const agent_id = typeof rawAgentId === "string" ? rawAgentId.trim() : rawAgentId
    const endpoint_id = typeof rawEndpointId === "string" ? rawEndpointId.trim() : rawEndpointId
    const account_id = typeof rawAccountId === "string" ? rawAccountId.trim() : rawAccountId
    const agent_version = typeof rawAgentVersion === "string" ? rawAgentVersion.trim() : rawAgentVersion

    if (!agent_id && !endpoint_id) {
      return NextResponse.json({ error: "Missing required field: agent_id or endpoint_id" }, { status: 400 })
    }

    let foundEndpoint: { id: string; account_id: string } | undefined

    if (endpoint_id) {
      const foundByEndpointResult = await query<{ id: string; account_id: string }>(
        `SELECT id::text, account_id::text FROM endpoints WHERE id = $1 LIMIT 1`,
        [endpoint_id],
      )
      foundEndpoint = foundByEndpointResult.rows[0]
    }

    if (!foundEndpoint && agent_id) {
      const foundByAgentResult = account_id
        ? await query<{ id: string; account_id: string }>(
            `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 AND account_id = $2 LIMIT 1`,
            [agent_id, account_id],
          )
        : await query<{ id: string; account_id: string }>(
            `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
            [agent_id],
          )
      foundEndpoint = foundByAgentResult.rows[0]
    }

    // Fallback for stale/mismatched account_id on agent side
    if (!foundEndpoint && agent_id && account_id) {
      const fallbackByAgent = await query<{ id: string; account_id: string }>(
        `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
        [agent_id],
      )
      foundEndpoint = fallbackByAgent.rows[0]
    }

    if (!foundEndpoint) {
      // Self-healing fallback for migrated environments:
      // if endpoint row is missing but heartbeat has enough identity, recreate/upsert it.
      if (agent_id && account_id) {
        const rawOs = String(body?.system_info?.os || body?.os || "linux").toLowerCase()
        const normalizedOs = rawOs.includes("win")
          ? "windows"
          : rawOs.includes("mac") || rawOs.includes("darwin")
            ? "macos"
            : "linux"

        const hostname = String(body?.system_info?.hostname || body?.hostname || `endpoint-${String(agent_id).slice(0, 8)}`)
        const osVersion = body?.system_info?.kernel || body?.os_version || null
        const ipAddress = body?.system_info?.local_ip || body?.system_info?.ip || body?.ip_address || null
        const publicIp = body?.system_info?.public_ip || body?.public_ip || null
        const macAddress = body?.system_info?.mac || body?.mac_address || null

        // First try to find an existing row one more time (race-safe), then insert if still missing
        const existingCheck = await query<{ id: string; account_id: string }>(
          `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
          [agent_id],
        )

        let upsertResult: { rows: { id: string; account_id: string }[] }
        if (existingCheck.rows.length > 0) {
          upsertResult = existingCheck
        } else {
          upsertResult = await query<{ id: string; account_id: string }>(
            `
              INSERT INTO endpoints (
                account_id, agent_id, hostname, os, os_version, ip_address, public_ip, mac_address,
                status, last_seen_at, registered_at, updated_at
              )
              VALUES ($1, $2, $3, $4::endpoint_os, $5, $6, $7, $8, 'online', NOW(), NOW(), NOW())
              RETURNING id::text, account_id::text
            `,
            [account_id, agent_id, hostname, normalizedOs, osVersion, ipAddress, publicIp, macAddress],
          )
        }

        foundEndpoint = upsertResult.rows[0]
      }

      if (!foundEndpoint) {
        return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
      }
    }

    const safeStatus = ["online", "offline", "disconnected"].includes(String(status)) ? status : "online"

    const localIp = system_info?.local_ip || system_info?.ip || body?.ip_address || null
    const publicIp = system_info?.public_ip || body?.public_ip || null
    const macAddress = system_info?.mac || body?.mac_address || null
    const detectedOs = normalizeOs(system_info?.os || body?.os)

    const accountSettingsResult = await query<{ settings: Record<string, unknown> | null }>(
      `SELECT settings FROM account_settings WHERE account_id = $1 LIMIT 1`,
      [foundEndpoint.account_id],
    )
    const selectedVersionValue = accountSettingsResult.rows[0]?.settings?.target_agent_version
    const selectedVersion =
      typeof selectedVersionValue === "string" && selectedVersionValue !== "latest" ? selectedVersionValue.trim() : null

    const updateResult = await buildInstallerUpdateForOs(detectedOs, selectedVersion)
    const currentVersionParts = parseVersionParts(typeof agent_version === "string" ? agent_version : null)
    const latestVersionParts = parseVersionParts(updateResult?.latest_version || null)
    const versionComparison =
      latestVersionParts.length > 0 ? compareVersions(currentVersionParts, latestVersionParts) : 0
    const isUpdateAvailable = latestVersionParts.length > 0 && versionComparison < 0
    const downgradeBlocked = latestVersionParts.length > 0 && versionComparison > 0

    await query(
      `
        UPDATE endpoints
        SET status = $1,
            last_seen_at = NOW(),
            updated_at = NOW(),
            ip_address = COALESCE($2, ip_address),
            public_ip = COALESCE($3, public_ip),
            mac_address = COALESCE($4, mac_address),
            agent_version = COALESCE($5, agent_version)
        WHERE id = $6
      `,
      [
        safeStatus,
        localIp,
        publicIp,
        macAddress,
        typeof agent_version === "string" && agent_version ? agent_version : null,
        foundEndpoint.id,
      ],
    )

    const policyResult = await query<{ policy: Record<string, unknown> }>(
      `
        SELECT row_to_json(p.*) AS policy
        FROM endpoint_policies ep
        JOIN policies p ON p.id = ep.policy_id
        WHERE ep.endpoint_id = $1
      `,
      [foundEndpoint.id],
    )

    const policies = policyResult.rows.map((row) => row.policy)

    return NextResponse.json({
      success: true,
      policies,
      agent_update: {
        available: isUpdateAvailable,
        downgrade_blocked: downgradeBlocked,
        current_version: typeof agent_version === "string" ? agent_version : null,
        latest_version: updateResult?.latest_version || null,
        selected_version: updateResult?.selected_version || null,
        installer_filename: updateResult?.installer_filename || null,
        download_url: isUpdateAvailable ? updateResult?.download_url || null : null,
        target_os: updateResult?.target_os || detectedOs,
        message: downgradeBlocked
          ? "Downgrade is blocked. Uninstall the current version and reinstall the selected older version."
          : null,
      },
    })
  } catch (error) {
    console.error("Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
