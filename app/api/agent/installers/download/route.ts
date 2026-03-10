import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import AdmZip from "adm-zip"
import os from "os"

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

async function findLatestWindowsMsi(basePath: string): Promise<string> {
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

  // Fall back to GitHub API listing (Vercel deployment)
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
): Promise<NextResponse> {
  const basePath = path.join(process.cwd(), "public", "tray")
  const msiName = await findLatestWindowsMsi(basePath)
  const msiPath = path.join(basePath, msiName)

  let msiData: Buffer
  let sha256: string

  // Try to read from filesystem first (local development)
  try {
    msiData = await fs.readFile(msiPath)
    sha256 = crypto.createHash("sha256").update(msiData).digest("hex")
    console.info(`[Windows Installer] Loaded MSI from filesystem: ${msiName}`)
  } catch {
    // Fall back to fetching MSI via HTTP — try self-hosted origin first (always reachable on Vercel)
    const candidateUrls = [
      requestOrigin ? `${requestOrigin}/tray/${msiName}` : null,
      `https://kuaminisystems.com/tray/${msiName}`,
      `https://www.kuaminisystems.com/tray/${msiName}`,
      `https://raw.githubusercontent.com/${INSTALLER_BUILD_GH_REPO}/main/public/tray/${msiName}`,
    ].filter(Boolean) as string[]

    let fetched: Response | null = null
    for (const url of candidateUrls) {
      console.info(`[Windows Installer] Trying to fetch MSI from: ${url}`)
      try {
        const resp = await fetch(url)
        if (resp.ok) { fetched = resp; break }
        console.warn(`[Windows Installer] ${url} returned ${resp.status}`)
      } catch (fetchErr) {
        console.warn(`[Windows Installer] fetch failed for ${url}:`, fetchErr)
      }
    }

    if (!fetched) {
      throw new Error(`Failed to fetch MSI from all candidate URLs`)
    }

    const arrayBuffer = await fetched.arrayBuffer()
    msiData = Buffer.from(arrayBuffer)
    sha256 = crypto.createHash("sha256").update(msiData).digest("hex")
    console.info(`[Windows Installer] Loaded MSI via HTTP fetch`)
  }

  // Create zip using adm-zip
  const zip = new AdmZip()
  zip.addFile(msiName, msiData)
  zip.addFile("registration.token", Buffer.from(token, "utf-8"))
  
  // Add install helper script — try filesystem paths then self-hosted URL
  let helperData: Buffer | null = null
  const helperFsPaths = [
    path.join(process.cwd(), "public", "tray", "install-helper.ps1"),
    path.join(process.cwd(), "agent-tray", "install-helper.ps1"),
  ]
  for (const hp of helperFsPaths) {
    try { helperData = await fs.readFile(hp); break } catch { /* try next */ }
  }
  if (!helperData && requestOrigin) {
    try {
      const helperResp = await fetch(`${requestOrigin}/tray/install-helper.ps1`)
      if (helperResp.ok) helperData = Buffer.from(await helperResp.arrayBuffer())
    } catch { /* ignore */ }
  }
  if (helperData) {
    zip.addFile("install-helper.ps1", helperData)
    console.info("[Windows Installer] Added install-helper.ps1 to bundle")
  } else {
    console.warn("[Windows Installer] Could not include install-helper.ps1 — bundle will have MSI + token only")
  }
  
  const zipData = zip.toBuffer()

  // Include version in bundle filename for console display
  const versionMatch = /-(\d+\.\d+\.\d+(?:\.\d+)?)\.msi$/u.exec(msiName)
  const version = versionMatch ? versionMatch[1] : "latest"
  const bundleName = `KuaminiSecurityClient-${accountId.slice(0, 8)}-v${version}.zip`

  void safeAuditLog({
    action: "installer_download",
    entityType: "installer",
    entityId: accountId,
    accountId,
    ip: clientIp,
    userAgent,
    details: { platform: "windows", sha256, bundle: "msi+token", msi: msiName, version },
  })

  return new NextResponse(new Uint8Array(zipData), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${bundleName}"`,
      "X-Checksum-SHA256": sha256,
      "X-Bundle-Type": "msi+token",
      "X-MSI-Version": version,
    },
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
    const admin = createAdminClient()
    await admin.from("audit_logs").insert({
      account_id: params.accountId,
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      details: params.details ?? null,
      ip_address: params.ip ?? null,
      user_agent: params.userAgent ?? null,
    })
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

    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const platform = searchParams.get("platform") // macos, windows, linux
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify account access
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("*, license_tier:license_tiers(*)")
      .eq("id", accountId)
      .single()

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // Check if user has access to this account
    const isOwner = account.owner_id === user.id
    const isSuperAdmin = profile.role === "super_admin"

    let membershipOk = false
    if (!isOwner && !isSuperAdmin) {
      const { data: membership } = await supabase
        .from("account_members")
        .select("id")
        .eq("account_id", accountId)
        .eq("user_id", user.id)
        .maybeSingle()

      membershipOk = Boolean(membership)
    }

    if (!(isOwner || isSuperAdmin || membershipOk)) {
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
        return await generateMacOSInstaller(agentTrayDistPath, registrationToken, accountId, clientIp, request.headers.get("user-agent"))
      case "windows":
        return await serveWindowsInstaller(accountId, account.name, registrationToken, clientIp, request.headers.get("user-agent"), request.nextUrl.origin)
      case "linux":
        return await serveStaticInstaller("linux", accountId, clientIp, request.headers.get("user-agent"))
      default:
        return NextResponse.json({ error: "Unsupported platform" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error generating installer:", error)
    return NextResponse.json({ error: "Failed to generate installer" }, { status: 500 })
  }
}

async function serveStaticInstaller(platform: string, accountId: string, clientIp?: string, userAgent?: string | null) {
  try {
    const basePath = path.join(process.cwd(), "public", "tray")
    const candidates =
      platform === "windows"
        ? [INSTALLER_WINDOWS_MSI_FILENAME, "KuaminiSecurityClient-1.0.0.msi", "KuaminiSecurityClient-windows.zip", "windows.msi", "windows.zip"]
        : ["KuaminiSecurityClient-linux.tar.gz", "linux.tar.gz", "linux.zip"]

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
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Checksum-SHA256": sha256,
      },
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
) {
  try {
    // Build a dynamic MSI + token bundle from the base installer
    try {
      console.info("[Windows Installer] Building MSI + token bundle")
      return await buildWindowsInstallerBundle(accountId, token, clientIp, userAgent, requestOrigin)
    } catch (bundleError) {
      console.warn("[Windows Installer] Failed to build MSI bundle:", bundleError)
    }

    // No on-demand build dispatch: immediately serve static artifact fallback.
    return await serveStaticInstaller("windows", accountId, clientIp, userAgent)
  } catch (error) {
    console.error("Error preparing Windows installer:", error)
    return NextResponse.json({ error: "Windows installer not available" }, { status: 404 })
  }
}

async function serveMacOSInstaller(token: string, accountId: string, clientIp?: string, userAgent?: string | null) {
  try {
    // Serve the pre-built base PKG from public/tray/
    // The postinstall script in the base PKG does not embed token.
    const publicPath = await resolveBundlePath([
      path.join(process.cwd(), "public", "tray", "KuaminiSecurityClient-1.0.0.pkg"),
      path.join(process.cwd(), "public", "tray", "macos.pkg"),
    ])

    const pkgName = path.basename(publicPath)
    const pkgData = await fs.readFile(publicPath)
    const sha256 = await getFileSha256(publicPath)

    const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"
    const normalizedBase = rawBase.replace(/\/$/, "")
    const apiBase = normalizedBase.endsWith("/api/agent") ? normalizedBase : `${normalizedBase}/api/agent`
    const consoleUrl = `${normalizedBase}/securityAgent`

    const installScript = `#!/bin/bash
set -euo pipefail

CONSOLE_USER=$(/usr/bin/stat -f %Su /dev/console)
CONFIG_DIR="/Users/\${CONSOLE_USER}/.kuamini"
CONFIG_FILE="\${CONFIG_DIR}/config.json"
TOKEN_FILE="$(cd "$(dirname "$0")" && pwd)/registration.token"
PKG_FILE="$(cd "$(dirname "$0")" && pwd)/${pkgName}"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "registration.token not found in installer bundle" >&2
  exit 1
fi

TOKEN=$( /bin/cat "$TOKEN_FILE" )

/bin/mkdir -p "$CONFIG_DIR"
/bin/cat >"$CONFIG_FILE" <<JSON
{
  "api_base": "${apiBase}",
  "console_url": "${consoleUrl}",
  "auto_register": true,
  "heartbeat_interval": 60,
  "registration_token": "${token}"
}
JSON

/usr/sbin/chown "$CONSOLE_USER" "$CONFIG_FILE" || true
/bin/chmod 644 "$CONFIG_FILE" || true

echo "Installing Kuamini Security Client..."
/usr/sbin/installer -pkg "$PKG_FILE" -target /

echo "Installation complete."
echo "If the tray icon is red, open the console and check endpoint status."
`

    const readme = `Kuamini Security Client (macOS)\n\nSteps:\n1) Unzip this bundle.\n2) Run: bash install.sh\n3) Approve any prompts.\n\nThis installer writes your account token into ~/.kuamini/config.json before installing the PKG.\n`

    const zip = new AdmZip()
    zip.addFile(pkgName, pkgData)
    zip.addFile("registration.token", Buffer.from(token, "utf-8"))
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
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${bundleName}"`,
        "X-Checksum-SHA256": sha256,
        "X-Bundle-Type": "pkg+token+script",
      },
    })
  } catch (error) {
    console.error("Error serving macOS installer:", error)
    throw error
  }
}

async function generateMacOSInstaller(_distPath: string, token: string, accountId: string, clientIp?: string, userAgent?: string | null) {
  try {
    return await serveMacOSInstaller(token, accountId, clientIp, userAgent)
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
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="Install-KuaminiSecurityClient-${accountId.slice(0, 8)}.ps1"`,
        "X-Checksum-SHA256": bundleHash,
      },
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
      headers: {
        "Content-Type": "application/x-sh",
        "Content-Disposition": `attachment; filename="install-kuamini-security-client-${accountId.slice(0, 8)}.sh"`,
        "X-Checksum-SHA256": bundleHash,
      },
    })
  } catch (error) {
    console.error("Error generating Linux installer:", error)
    throw error
  }
}
