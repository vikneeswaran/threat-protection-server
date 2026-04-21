import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import AdmZip from "adm-zip"
import os from "os"
import { getSessionUser } from "@/lib/auth/session"
import { query } from "@/lib/db"

// Token and rate-limit settings (tunable via env)
const TOKEN_SECRET = process.env.INSTALLER_TOKEN_SECRET
const TOKEN_TTL_SECONDS = Number(process.env.INSTALLER_TOKEN_TTL_SECONDS ?? 7 * 24 * 60 * 60) // default 7d
const RATE_LIMIT_WINDOW_MS = Number(process.env.INSTALLER_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000) // default 10m
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.INSTALLER_RATE_LIMIT_MAX ?? 30)

const INSTALLER_BUILD_GH_TOKEN = process.env.INSTALLER_BUILD_GH_TOKEN
const INSTALLER_BUILD_GH_REPO = process.env.INSTALLER_BUILD_GH_REPO ?? "vikneeswaran/threat-protection-agent"
const INSTALLER_WINDOWS_MSI_FILENAME = process.env.INSTALLER_WINDOWS_MSI_FILENAME ?? "KuaminiSecurityClient-1.0.5.msi"

// In-memory rate-limit buckets (per IP); best-effort for serverless
const rateLimitBuckets = new Map<string, number[]>()

// Simple checksum cache keyed by absolute path
const checksumCache = new Map<string, { mtimeMs: number; hash: string }>()

function withNoStoreHeaders(headers: Record<string, string>) {
  return {
    ...headers,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  }
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function signPayload(payload: Record<string, unknown>) {
  if (!TOKEN_SECRET) {
    throw new Error("Missing INSTALLER_TOKEN_SECRET")
  }

  const payloadJson = JSON.stringify(payload)
  const payloadB64 = base64Url(payloadJson)
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payloadB64).digest()
  const signatureB64 = base64Url(signature)
  return `${payloadB64}.${signatureB64}`
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown"
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) {return realIp.trim()}
  return "unknown"
}

function isRateLimited(key: string) {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const bucket = rateLimitBuckets.get(key) ?? []
  const recent = bucket.filter((ts) => ts >= windowStart)

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(key, recent)
    return true
  }

  recent.push(now)
  rateLimitBuckets.set(key, recent)
  return false
}

async function getFileSha256(filePath: string) {
  const stat = await fs.stat(filePath)
  const cached = checksumCache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.hash
  }

  const fileBuffer = await fs.readFile(filePath)
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex")
  checksumCache.set(filePath, { mtimeMs: stat.mtimeMs, hash })
  return hash
}

function compareVersions(left: number[], right: number[]) {
  const maxLen = Math.max(left.length, right.length)
  for (let i = 0; i < maxLen; i += 1) {
    const leftPart = left[i] ?? 0
    const rightPart = right[i] ?? 0
    if (leftPart !== rightPart) {
      return leftPart - rightPart
    }
  }
  return 0
}

function normalizeRequestedVersion(value: string | null): string | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return /^\d+\.\d+\.\d+(?:\.\d+)?$/u.test(trimmed) ? trimmed : null
}

async function findSpecificVersionedFile(basePath: string, pattern: RegExp, requestedVersion: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(basePath)
    for (const entry of entries) {
      const match = pattern.exec(entry)
      if (match?.[1] === requestedVersion) {
        return entry
      }
    }
  } catch {
    return null
  }
  return null
}

async function findLatestWindowsMsi(basePath: string, requestedVersion?: string | null): Promise<string> {
  const normalizedRequestedVersion = normalizeRequestedVersion(requestedVersion ?? null)

  if (normalizedRequestedVersion) {
    const specific = await findSpecificVersionedFile(
      basePath,
      /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.msi$/u,
      normalizedRequestedVersion,
    )
    if (specific) {
      console.info(`[Windows Installer] Using requested MSI version: ${specific}`)
      return specific
    }
  }

  // Try to find latest version from filesystem (local development)
  try {
    const entries = await fs.readdir(basePath)
    const msiFiles = entries
      .filter((name) => /^KuaminiSecurityClient-\d+\.\d+\.\d+(?:\.\d+)?\.msi$/u.test(name))
      .sort()
      .reverse()

    if (msiFiles.length > 0) {
      console.info(`[Windows Installer] Found MSI versions: ${msiFiles.slice(0, 3).join(", ")}...`)
      return msiFiles[0]
    }
  } catch {
    console.info("[Windows Installer] Cannot list filesystem, will try CDN")
  }

  // Fall back to GitHub API listing (AWS EC2 deployment)
  if (!INSTALLER_BUILD_GH_TOKEN) {
    console.info(`[Windows Installer] No GitHub token, using fallback MSI: ${INSTALLER_WINDOWS_MSI_FILENAME}`)
    return INSTALLER_WINDOWS_MSI_FILENAME
  }

  const apiUrl = `https://api.github.com/repos/${INSTALLER_BUILD_GH_REPO}/contents/public/tray?ref=main`
  const response = await fetch(apiUrl, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${INSTALLER_BUILD_GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to list MSI files from GitHub: ${response.status} ${text}`)
  }

  const items = (await response.json()) as Array<{ name?: string }>
  const matches: { name: string; version: number[] }[] = []
  for (const item of items) {
    const name = item.name
    if (!name) {
      continue
    }
    const match = /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.msi$/u.exec(name)
    if (!match) {
      continue
    }
    const versionParts = match[1].split(".").map((part) => Number(part) || 0)
    matches.push({ name, version: versionParts })
  }

  if (matches.length === 0) {
    throw new Error("No Windows MSI found in GitHub public/tray")
  }

  matches.sort((a, b) => compareVersions(a.version, b.version))
  const latest = matches[matches.length - 1].name
  console.info(`[Windows Installer] Found latest MSI in GitHub: ${latest}`)
  return latest
}

async function buildWindowsInstallerBundle(
  accountId: string,
  token: string,
  clientIp?: string,
  userAgent?: string | null,
  requestOrigin?: string,
  requestedVersion?: string | null,
): Promise<NextResponse> {
  // Determine MSI filename from available artifacts (avoids hardcoded version drift)
  const origin = (requestOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://kuaminisystems.com").replace(/\/$/, "")
  const trayBasePath = path.join(process.cwd(), "public", "tray")
  let msiName: string
  try {
    msiName = await findLatestWindowsMsi(trayBasePath, requestedVersion)
  } catch {
    msiName = INSTALLER_WINDOWS_MSI_FILENAME
  }
  const msiUrl = `${origin}/tray/${msiName}`

  // Include MSI in the ZIP bundle. Prefer local file access, then fall back to CDN fetch.
  const msiCandidates = [
    path.join(process.cwd(), "public", "tray", msiName),
    path.join(process.cwd(), "agent-tray", "dist", msiName),
  ]

  let msiData: Buffer
  let msiSource = "local"

  try {
    const msiPath = await resolveBundlePath(msiCandidates)
    msiData = await fs.readFile(msiPath)
    msiName = path.basename(msiPath)
    console.info(`[Windows Installer] Using local MSI from ${msiPath}`)
  } catch {
    // Fallback: extract MSI from a prebuilt Windows ZIP if present.
    try {
      const baseZipPath = await resolveBundlePath([
        path.join(process.cwd(), "public", "tray", "windows.zip"),
        path.join(process.cwd(), "public", "tray", "KuaminiSecurityClient-windows.zip"),
      ])
      const baseZip = new AdmZip(baseZipPath)
      const msiEntry = baseZip
        .getEntries()
        .find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".msi"))

      if (!msiEntry) {
        throw new Error(`No MSI entry found in ${path.basename(baseZipPath)}`)
      }

      msiData = msiEntry.getData()
      msiName = path.basename(msiEntry.entryName)
      msiSource = "local-zip"
      console.info(`[Windows Installer] Extracted MSI from ZIP ${baseZipPath}: ${msiName}`)
    } catch {
      const msiResponse = await fetch(msiUrl)
      if (!msiResponse.ok) {
        throw new Error(`Failed to fetch MSI from CDN: ${msiResponse.status}`)
      }
      msiData = Buffer.from(await msiResponse.arrayBuffer())
      msiSource = "cdn"
      console.info(`[Windows Installer] Using CDN MSI from ${msiUrl}`)
    }
  }

  // Use pre-signed helper scripts from public/tray so signatures remain valid.
  const installHelperPath = path.join(process.cwd(), "public", "tray", "install-helper.ps1")
  const installCmdPath = path.join(process.cwd(), "public", "tray", "install-windows.cmd")
  const uninstallScriptPath = path.join(process.cwd(), "public", "tray", "uninstall-kuamini-windows.ps1")
  const uninstallCmdPath = path.join(process.cwd(), "public", "tray", "uninstall-windows.cmd")

  let installHelperData: Buffer
  let installCmdData: Buffer
  let uninstallScriptData: Buffer | null = null
  let uninstallCmdData: Buffer | null = null

  try {
    installHelperData = await fs.readFile(installHelperPath)
  } catch {
    const response = await fetch(`${origin}/tray/install-helper.ps1`)
    if (!response.ok) {
      throw new Error(`Failed to load signed install-helper.ps1: ${response.status}`)
    }
    installHelperData = Buffer.from(await response.arrayBuffer())
  }

  try {
    installCmdData = await fs.readFile(installCmdPath)
  } catch {
    installCmdData = Buffer.from("@echo off\r\nsetlocal\r\nset SCRIPT_DIR=%~dp0\r\npowershell -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT_DIR%install-helper.ps1\" %*\r\nendlocal\r\n", "utf-8")
  }

  try {
    uninstallScriptData = await fs.readFile(uninstallScriptPath)
  } catch {
    uninstallScriptData = null
  }

  try {
    uninstallCmdData = await fs.readFile(uninstallCmdPath)
  } catch {
    uninstallCmdData = null
  }

  const readme = `Kuamini Security Client (Windows)
=========================================
1. Unzip this bundle.
2. Run install-windows.cmd as Administrator (recommended).
   Alternate: run install-helper.ps1 as Administrator.

This bundle contains:
- ${msiName}
- registration.token
- install-helper.ps1 (digitally signed)
- install-windows.cmd

Optional uninstall files (if present):
- uninstall-kuamini-windows.ps1 (digitally signed)
- uninstall-windows.cmd

Why use .cmd launchers:
- Downloaded PowerShell scripts can show a one-time security warning due to Mark-of-the-Web.
- The .cmd launchers run with ExecutionPolicy Bypass for this script invocation and avoid that prompt.
`

  // Build full ZIP: MSI + token + signed helper + cmd launcher + README
  const zip = new AdmZip()
  zip.addFile(msiName, msiData)
  zip.addFile("registration.token", Buffer.from(token, "utf-8"))
  zip.addFile("install-helper.ps1", installHelperData)
  zip.addFile("install-windows.cmd", installCmdData)
  if (uninstallScriptData) {
    zip.addFile("uninstall-kuamini-windows.ps1", uninstallScriptData)
  }
  if (uninstallCmdData) {
    zip.addFile("uninstall-windows.cmd", uninstallCmdData)
  }
  zip.addFile("README.txt", Buffer.from(readme, "utf-8"))
  const zipData = zip.toBuffer()

  const bundleName = `KuaminiSecurityClient-${accountId.slice(0, 8)}-windows.zip`

  void safeAuditLog({
    action: "installer_download",
    entityType: "installer",
    entityId: accountId,
    accountId,
    ip: clientIp,
    userAgent,
    details: { platform: "windows", bundle: "msi+token+helper+cmd", msi: msiName, msiSource },
  })

  console.info(`[Windows Installer] Serving MSI bundle for account ${accountId.slice(0, 8)} (${msiSource})`)

  return new NextResponse(new Uint8Array(zipData), {
    headers: withNoStoreHeaders({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${bundleName}"`,
      "X-Bundle-Type": "msi+token+helper+cmd",
    }),
  })
}

async function safeAuditLog(params: {
  action: string
  entityType: string
  entityId: string
  accountId: string
  userId?: string
  ip?: string
  userAgent?: string | null
  details?: Record<string, unknown>
}) {
  try {
    await query(
      `
        INSERT INTO audit_logs (account_id, user_id, action, entity_type, entity_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      `,
      [
        params.accountId,
        params.userId ?? null,
        params.action,
        params.entityType,
        params.entityId,
        JSON.stringify(params.details ?? null),
        params.ip ?? null,
        params.userAgent ?? null,
      ],
    )
  } catch (error) {
    console.warn("Failed to write audit log", error)
  }
}

async function resolveBundlePath(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // keep trying
    }
  }
  throw new Error(`Bundle not found. Tried: ${candidates.join(", ")}`)
}

export async function GET(request: NextRequest) {
  try {
    if (!TOKEN_SECRET) {
      return NextResponse.json({ error: "Installer token secret not configured" }, { status: 500 })
    }

    const searchParams = request.nextUrl.searchParams
    const platform = searchParams.get("platform") // macos, windows, linux
    const requestedVersion = normalizeRequestedVersion(searchParams.get("version"))
    const accountId = searchParams.get("accountId")
    const subAccountId = searchParams.get("subAccountId")
    const clientIp = getClientIp(request)
    const rateKey = `${clientIp}:${platform ?? "unknown"}:download`

    if (isRateLimited(rateKey)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    // Validate parameters
    if (!platform || !accountId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Verify user has access to this account
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profileResult = await query<{ account_id: string; role: string }>(
      `SELECT account_id::text, role FROM profiles WHERE id = $1 LIMIT 1`,
      [user.id],
    )
    const profile = profileResult.rows[0]

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const accountResult = await query<{ id: string; name: string; parent_account_id: string | null }>(
      `SELECT id::text, name, parent_account_id::text FROM accounts WHERE id = $1 LIMIT 1`,
      [accountId],
    )
    const account = accountResult.rows[0]

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // Check if user has access to this account
    const isSameAccount = profile.account_id === account.id
    const isParentAdmin = ["super_admin", "admin"].includes(profile.role) && account.parent_account_id === profile.account_id

    if (!(isSameAccount || isParentAdmin)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Generate registration token
    const now = Date.now()
    const registrationToken = signPayload({
      accountId: accountId,
      subAccountId: subAccountId || null,
      accountName: account.name,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS * 1000,
      generatedBy: user.id,
    })

    // Get the path to agent-tray dist folder
    const projectRoot = process.cwd()
    const agentTrayDistPath = path.join(projectRoot, "agent-tray", "dist")

    // Serve prebuilt installers. macOS stays dynamic to preserve postinstall token download.
    switch (platform) {
      case "macos":
        return await generateMacOSInstaller(
          agentTrayDistPath,
          registrationToken,
          accountId,
          clientIp,
          request.headers.get("user-agent"),
          requestedVersion,
        )
      case "windows":
        return await serveWindowsInstaller(
          accountId,
          account.name,
          registrationToken,
          clientIp,
          request.headers.get("user-agent"),
          request.nextUrl.origin,
          requestedVersion,
        )
      case "linux":
        return await serveStaticInstaller("linux", accountId, clientIp, request.headers.get("user-agent"), requestedVersion)
      default:
        return NextResponse.json({ error: "Unsupported platform" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error generating installer:", error)
    return NextResponse.json({ error: "Failed to generate installer" }, { status: 500 })
  }
}

async function serveStaticInstaller(
  platform: string,
  accountId: string,
  clientIp?: string,
  userAgent?: string | null,
  requestedVersion?: string | null,
) {
  try {
    const basePath = path.join(process.cwd(), "public", "tray")
    const normalizedRequestedVersion = normalizeRequestedVersion(requestedVersion ?? null)
    const linuxRequestedName = normalizedRequestedVersion ? `KuaminiSecurityClient-${normalizedRequestedVersion}.tar.gz` : null
    const candidates =
      platform === "windows"
        ? [INSTALLER_WINDOWS_MSI_FILENAME, "KuaminiSecurityClient-1.0.0.msi", "KuaminiSecurityClient-windows.zip", "windows.msi", "windows.zip"]
        : [linuxRequestedName, "KuaminiSecurityClient-linux.tar.gz", "linux.tar.gz", "linux.zip"].filter(
            (value): value is string => Boolean(value),
          )

    const filePath = await resolveBundlePath(candidates.map((f) => path.join(basePath, f)))
    const data = await fs.readFile(filePath)
    const sha256 = await getFileSha256(filePath)
    const resolvedName = path.basename(filePath)

    void safeAuditLog({
      action: "installer_download",
      entityType: "installer",
      entityId: accountId,
      accountId,
      ip: clientIp,
      userAgent,
      details: { platform, sha256, static: true },
    })

    const filename =
      platform === "windows"
        ? resolvedName.endsWith(".zip")
          ? `KuaminiSecurityClient-${accountId.slice(0, 8)}.zip`
          : `KuaminiSecurityClient-${accountId.slice(0, 8)}.msi`
        : `KuaminiSecurityClient-${accountId.slice(0, 8)}.tar.gz`
    const contentType =
      platform === "windows"
        ? resolvedName.endsWith(".zip")
          ? "application/zip"
          : "application/octet-stream"
        : "application/gzip"

    return new NextResponse(data, {
      headers: withNoStoreHeaders({
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Checksum-SHA256": sha256,
      }),
    })
  } catch (error) {
    console.error(`Error serving static ${platform} installer:`, error)
    return NextResponse.json({ error: `Installer not available for ${platform}` }, { status: 404 })
  }
}

async function serveWindowsInstaller(
  accountId: string,
  _accountName: string,
  token: string,
  clientIp?: string,
  userAgent?: string | null,
  requestOrigin?: string,
  requestedVersion?: string | null,
) {
  try {
    console.info("[Windows Installer] Building MSI + token bundle")
    return await buildWindowsInstallerBundle(accountId, token, clientIp, userAgent, requestOrigin, requestedVersion)
  } catch (error) {
    console.error("Error preparing Windows installer:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Failed to generate Windows ZIP bundle",
        details: `Installer bundle must include MSI, registration token, and install helper. Root cause: ${message}`,
      },
      { status: 503 },
    )
  }
}

async function serveMacOSInstaller(
  token: string,
  accountId: string,
  clientIp?: string,
  userAgent?: string | null,
  requestedVersion?: string | null,
) {
  try {
    const normalizedRequestedVersion = normalizeRequestedVersion(requestedVersion ?? null)
    const requestedPkg = normalizedRequestedVersion ? `KuaminiSecurityClient-${normalizedRequestedVersion}.pkg` : null

    // Serve the pre-built base PKG from public/tray/
    // The postinstall script in the base PKG does not embed token.
    const publicPath = await resolveBundlePath([
      ...(requestedPkg ? [path.join(process.cwd(), "public", "tray", requestedPkg)] : []),
      path.join(process.cwd(), "public", "tray", "macos.pkg"),
      path.join(process.cwd(), "public", "tray", "KuaminiSecurityClient-1.0.0.pkg"),
    ])

    const pkgName = path.basename(publicPath)
    const pkgData = await fs.readFile(publicPath)
    const sha256 = await getFileSha256(publicPath)

    const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"
    const normalizedBase = rawBase.replace(/\/$/, "")
    const appBase = normalizedBase.endsWith("/api/agent")
      ? normalizedBase.slice(0, -"/api/agent".length)
      : normalizedBase
    const apiBase = `${appBase}/api/agent`
    const consoleUrl = `${appBase}/securityAgent`

    // Reuse the proven macOS helper installer script that sets up LaunchAgent/tray reliably.
    // It accepts: <TOKEN> <PKG_PATH>
    const macHelperScriptPath = path.join(process.cwd(), "public", "tray", "install-kuamini-macos.sh")
    let macHelperScript: Buffer
    try {
      macHelperScript = await fs.readFile(macHelperScriptPath)
    } catch {
      const response = await fetch(`${appBase}/tray/install-kuamini-macos.sh`)
      if (!response.ok) {
        throw new Error(`Failed to load install-kuamini-macos.sh: ${response.status}`)
      }
      macHelperScript = Buffer.from(await response.arrayBuffer())
    }

    const installScript = `#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="\${SCRIPT_DIR}/registration.token"
PKG_FILE="\${SCRIPT_DIR}/${pkgName}"
HELPER_SCRIPT="\${SCRIPT_DIR}/install-kuamini-macos.sh"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "registration.token not found in installer bundle" >&2
  exit 1
fi

if [ ! -f "$PKG_FILE" ]; then
  echo "${pkgName} not found in installer bundle" >&2
  exit 1
fi

if [ ! -f "$HELPER_SCRIPT" ]; then
  echo "install-kuamini-macos.sh not found in installer bundle" >&2
  exit 1
fi

TOKEN=$( /bin/cat "$TOKEN_FILE" )
chmod +x "$HELPER_SCRIPT"

# Pre-seed user config (helper also writes/normalizes config).
CONSOLE_USER=$(/usr/bin/stat -f %Su /dev/console)
CONFIG_DIR="/Users/\${CONSOLE_USER}/.kuamini"
CONFIG_FILE="\${CONFIG_DIR}/config.json"
/bin/mkdir -p "$CONFIG_DIR"
/bin/cat > "$CONFIG_FILE" <<JSON
{
  "api_base": "${apiBase}",
  "console_url": "${consoleUrl}",
  "auto_register": true,
  "heartbeat_interval": 60,
  "registration_token": "${token}",
  "account_id": "${accountId}"
}
JSON

/usr/sbin/chown "$CONSOLE_USER" "$CONFIG_FILE" || true
/bin/chmod 644 "$CONFIG_FILE" || true

echo "Installing and starting Kuamini Security Client..."
if [ "$(id -u)" -eq 0 ]; then
  bash "$HELPER_SCRIPT" "$TOKEN" "$PKG_FILE"
else
  sudo bash "$HELPER_SCRIPT" "$TOKEN" "$PKG_FILE"
fi

echo "Installation complete."
echo "If the tray icon is red, open the console and check endpoint status."
`

    const readme = `Kuamini Security Client (macOS)\n\nSteps:\n1) Unzip this bundle.\n2) Run: bash install.sh\n3) Approve any prompts.\n\nThis installer writes your account token into ~/.kuamini/config.json before installing the PKG.\n`

    const zip = new AdmZip()
    zip.addFile(pkgName, pkgData)
    zip.addFile("registration.token", Buffer.from(token, "utf-8"))
    zip.addFile("install-kuamini-macos.sh", macHelperScript)
    zip.addFile("install.sh", Buffer.from(installScript, "utf-8"))
    zip.addFile("README.txt", Buffer.from(readme, "utf-8"))
    const zipData = zip.toBuffer()

    void safeAuditLog({
      action: "installer_download",
      entityType: "installer",
      entityId: accountId,
      accountId,
      ip: clientIp,
      userAgent,
      details: { platform: "macos", sha256, bundle: "pkg+token+script" },
    })

    const bundleName = `KuaminiSecurityClient-${accountId.slice(0, 8)}-macos.zip`

    return new NextResponse(new Uint8Array(zipData), {
      headers: withNoStoreHeaders({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${bundleName}"`,
        "X-Checksum-SHA256": sha256,
        "X-Bundle-Type": "pkg+token+script",
      }),
    })
  } catch (error) {
    console.error("Error serving macOS installer:", error)
    throw error
  }
}

async function generateMacOSInstaller(
  _distPath: string,
  token: string,
  accountId: string,
  clientIp?: string,
  userAgent?: string | null,
  requestedVersion?: string | null,
) {
  try {
    return await serveMacOSInstaller(token, accountId, clientIp, userAgent, requestedVersion)
  } catch (error) {
    console.error("Error generating macOS installer:", error)
    throw error
  }
}

async function _generateWindowsInstaller(_distPath: string, token: string, accountId: string, clientIp?: string, userAgent?: string | null) {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"
    const bundlePath = await resolveBundlePath([
      path.join(process.cwd(), "public", "tray", "KuaminiSecurityClient-1.0.0.msi"),
      path.join(process.cwd(), "public", "tray", "windows.msi"),
      path.join(process.cwd(), "public", "tray", "KuaminiSecurityClient-windows.zip"),
    ])
    const bundleFileName = path.basename(bundlePath)
    const bundleHash = await getFileSha256(bundlePath)
    const _bundleIsZip = bundleFileName.toLowerCase().endsWith(".zip")

    // For Windows, we'll create a self-extracting archive with embedded config
    // This is a simplified approach - in production you'd want to use WiX or Inno Setup
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuamini-installer-"))

    // Create config.json
    const config = {
      api_base_url: apiBase,
      registration_token: token,
      auto_register: true,
    }

    const configPath = path.join(tempDir, "config.json")
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))

    // Create a PowerShell installer script with embedded config
    const installerScript = `
# Kuamini Agent Installer for Windows
# Auto-configured for account: ${accountId}

$ErrorActionPreference = "Stop"

  $expectedHash = "${bundleHash}"

Write-Host "Installing Kuamini Threat Protection Agent..." -ForegroundColor Green

# Create installation directory
$installDir = "$env:ProgramFiles\\Kuamini\\SecurityClient"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Create config directory
$configDir = "$env:APPDATA\\Kuamini"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

# Write config file
$config = @{
  api_base_url = "${apiBase}"
    registration_token = "${token}"
    auto_register = $true
}
$config | ConvertTo-Json | Out-File -FilePath "$configDir\\config.json" -Encoding UTF8

# Download agent binary
Write-Host "Downloading agent binary..." -ForegroundColor Yellow
$agentUrl = "${apiBase}/tray/${bundleFileName}"
$zipPath = "$env:TEMP\\kuamini-agent.zip"
Invoke-WebRequest -Uri $agentUrl -OutFile $zipPath

# Verify checksum
$hash = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash.ToLower()
if ($hash -ne $expectedHash.ToLower()) {
  throw "Checksum mismatch for downloaded agent bundle. Expected $expectedHash but got $hash."
}

# Extract agent
Write-Host "Extracting agent..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
Remove-Item $zipPath

# Create scheduled task for auto-start
Write-Host "Configuring auto-start..." -ForegroundColor Yellow
$action = New-ScheduledTaskAction -Execute "$installDir\\KuaminiSecurityClient.exe"
$trigger = New-ScheduledTaskTrigger -AtLogon
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "KuaminiSecurityClient" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force

# Start the agent
Write-Host "Starting agent..." -ForegroundColor Yellow
Start-Process "$installDir\\KuaminiSecurityClient.exe"

Write-Host "Installation complete! The Kuamini Security Client is now running and will start automatically at login." -ForegroundColor Green
Write-Host "Check the system tray for the Kuamini Security Client icon." -ForegroundColor Cyan
`

    await fs.writeFile(path.join(tempDir, "install.ps1"), installerScript)

    // Read the installer script
    const scriptData = await fs.readFile(path.join(tempDir, "install.ps1"))

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })

    void safeAuditLog({
      action: "installer_download",
      entityType: "installer",
      entityId: accountId,
      accountId,
      ip: clientIp,
      userAgent,
      details: { platform: "windows", sha256: bundleHash },
    })

    return new NextResponse(scriptData, {
      headers: withNoStoreHeaders({
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="Install-KuaminiSecurityClient-${accountId.slice(0, 8)}.ps1"`,
        "X-Checksum-SHA256": bundleHash,
      }),
    })
  } catch (error) {
    console.error("Error generating Windows installer:", error)
    throw error
  }
}

async function _generateLinuxInstaller(_distPath: string, token: string, accountId: string, clientIp?: string, userAgent?: string | null) {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"
    const bundlePath = await resolveBundlePath([
      path.join(process.cwd(), "public", "tray", "KuaminiSecurityClient-linux.tar.gz"),
      path.join(process.cwd(), "public", "tray", "linux.tar.gz"),
      path.join(process.cwd(), "public", "tray", "linux.zip"),
    ])
    const bundleFileName = path.basename(bundlePath)
    const bundleHash = await getFileSha256(bundlePath)
    const _bundleIsZip = bundleFileName.toLowerCase().endsWith(".zip")

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuamini-installer-"))

    // Create bash installer script with embedded config
    const installerScript = `#!/bin/bash
# Kuamini Agent Installer for Linux
# Auto-configured for account: ${accountId}

set -e

EXPECTED_HASH="${bundleHash}"
BUNDLE_IS_ZIP=${_bundleIsZip ? 1 : 0}
TMP_BUNDLE=$(mktemp)

echo "Installing Kuamini Threat Protection Agent..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Create installation directory
INSTALL_DIR="/opt/kuamini/securityclient"
mkdir -p "$INSTALL_DIR"

# Create config directory
CONFIG_DIR="/etc/kuamini"
mkdir -p "$CONFIG_DIR"

# Write config file
cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "api_base_url": "${apiBase}",
  "registration_token": "${token}",
  "auto_register": true
}
EOF

# Download agent binary
echo "Downloading agent binary..."
AGENT_URL="${apiBase}/tray/${bundleFileName}"
curl -sSL "$AGENT_URL" -o "$TMP_BUNDLE"

# Verify checksum
ACTUAL_HASH=$(sha256sum "$TMP_BUNDLE" | awk '{print $1}')
if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
    echo "Checksum mismatch for downloaded agent bundle. Expected $EXPECTED_HASH but got $ACTUAL_HASH" >&2
    rm -f "$TMP_BUNDLE"
    exit 1
fi

if [ "$BUNDLE_IS_ZIP" -eq 1 ]; then
  unzip -o "$TMP_BUNDLE" -d "$INSTALL_DIR"
else
  tar -xz -C "$INSTALL_DIR" -f "$TMP_BUNDLE"
fi
rm -f "$TMP_BUNDLE"

# Create systemd service
cat > /etc/systemd/system/kuamini-security-client.service << 'EOF'
[Unit]
Description=Kuamini Security Client
After=network.target

[Service]
Type=simple
ExecStart=/opt/kuamini/securityclient/KuaminiSecurityClient
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable kuamini-security-client.service
systemctl start kuamini-security-client.service

echo "Installation complete! The Kuamini Security Client is now running."
echo "Check status with: systemctl status kuamini-security-client"
`

    await fs.writeFile(path.join(tempDir, "install.sh"), installerScript)

    // Read the installer script
    const scriptData = await fs.readFile(path.join(tempDir, "install.sh"))

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })

    void safeAuditLog({
      action: "installer_download",
      entityType: "installer",
      entityId: accountId,
      accountId,
      ip: clientIp,
      userAgent,
      details: { platform: "linux", sha256: bundleHash },
    })

    return new NextResponse(scriptData, {
      headers: withNoStoreHeaders({
        "Content-Type": "application/x-sh",
        "Content-Disposition": `attachment; filename="install-kuamini-security-client-${accountId.slice(0, 8)}.sh"`,
        "X-Checksum-SHA256": bundleHash,
      }),
    })
  } catch (error) {
    console.error("Error generating Linux installer:", error)
    throw error
  }
}
