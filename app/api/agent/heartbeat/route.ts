import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { query } from "@/lib/db"

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

function parseVersionParts(value: string | null | undefined): number[] {
  if (!value) {
    return []
  }
  const match = String(value).match(/(\d+(?:\.\d+)+)/)
  if (!match) {
    return []
  }
  return match[1].split(".").map((part) => Number(part) || 0)
}

function compareVersions(left: number[], right: number[]): number {
  const max = Math.max(left.length, right.length)
  for (let i = 0; i < max; i += 1) {
    const l = left[i] ?? 0
    const r = right[i] ?? 0
    if (l !== r) {
      return l - r
    }
  }
  return 0
}

async function findLatestInstallerForOs(targetOs: InstallerTargetOs) {
  const trayDir = path.join(process.cwd(), "public", "tray")
  const appBase = (process.env.NEXT_PUBLIC_APP_URL || "https://kuaminisystems.com").replace(/\/$/, "")

  try {
    const entries = await fs.readdir(trayDir)
    const matches: Array<{ file: string; version: number[]; versionText: string }> = []

    const patternByOs: Record<InstallerTargetOs, RegExp> = {
      windows: /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.msi$/u,
      macos: /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.pkg$/u,
      linux: /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.tar\.gz$/u,
    }

    const pattern = patternByOs[targetOs]
    for (const file of entries) {
      const matched = pattern.exec(file)
      if (!matched) {
        continue
      }
      matches.push({
        file,
        versionText: matched[1],
        version: matched[1].split(".").map((v) => Number(v) || 0),
      })
    }

    if (matches.length === 0) {
      return null
    }

    matches.sort((a, b) => compareVersions(a.version, b.version))
    const latest = matches[matches.length - 1]
    return {
      installer_filename: latest.file,
      latest_version: latest.versionText,
      download_url: `${appBase}/tray/${latest.file}`,
      target_os: targetOs,
    }
  } catch {
    return null
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
        const ipAddress = body?.system_info?.ip || body?.ip_address || null
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
                account_id, agent_id, hostname, os, os_version, ip_address, mac_address,
                status, last_seen_at, registered_at, updated_at
              )
              VALUES ($1, $2, $3, $4::endpoint_os, $5, $6, $7, 'online', NOW(), NOW(), NOW())
              RETURNING id::text, account_id::text
            `,
            [account_id, agent_id, hostname, normalizedOs, osVersion, ipAddress, macAddress],
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
    const macAddress = system_info?.mac || body?.mac_address || null
    const detectedOs = normalizeOs(system_info?.os || body?.os)

    const updateResult = await findLatestInstallerForOs(detectedOs)
    const currentVersionParts = parseVersionParts(typeof agent_version === "string" ? agent_version : null)
    const latestVersionParts = parseVersionParts(updateResult?.latest_version || null)
    const isUpdateAvailable = latestVersionParts.length > 0 && compareVersions(currentVersionParts, latestVersionParts) < 0

    await query(
      `
        UPDATE endpoints
        SET status = $1,
            last_seen_at = NOW(),
            updated_at = NOW(),
            ip_address = COALESCE($2, ip_address),
            mac_address = COALESCE($3, mac_address),
            agent_version = COALESCE($4, agent_version)
        WHERE id = $5
      `,
      [safeStatus, localIp, macAddress, typeof agent_version === "string" && agent_version ? agent_version : null, foundEndpoint.id],
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
        current_version: typeof agent_version === "string" ? agent_version : null,
        latest_version: updateResult?.latest_version || null,
        installer_filename: updateResult?.installer_filename || null,
        download_url: updateResult?.download_url || null,
        target_os: updateResult?.target_os || detectedOs,
      },
    })
  } catch (error) {
    console.error("Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
