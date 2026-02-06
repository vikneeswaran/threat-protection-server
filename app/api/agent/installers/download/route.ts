import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import AdmZip from "adm-zip"
import os from "os"

const execAsync = promisify(exec)

// Token and rate-limit settings (tunable via env)
const TOKEN_SECRET = process.env.INSTALLER_TOKEN_SECRET
const TOKEN_TTL_SECONDS = Number(process.env.INSTALLER_TOKEN_TTL_SECONDS ?? 7 * 24 * 60 * 60) // default 7d
const RATE_LIMIT_WINDOW_MS = Number(process.env.INSTALLER_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000) // default 10m
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.INSTALLER_RATE_LIMIT_MAX ?? 30)

const INSTALLER_BUILD_GH_TOKEN = process.env.INSTALLER_BUILD_GH_TOKEN
const INSTALLER_BUILD_GH_REPO = process.env.INSTALLER_BUILD_GH_REPO ?? "vikneeswaran/threat-protection-agent"
const INSTALLER_BUILD_WORKFLOW = process.env.INSTALLER_BUILD_WORKFLOW ?? "build-windows-msi-on-demand.yml"

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

async function buildWindowsInstallerBundle(
  accountId: string,
  token: string,
  clientIp?: string,
  userAgent?: string | null,
): Promise<NextResponse> {
  const basePath = path.join(process.cwd(), "public", "tray")
  const msiPath = await resolveLatestWindowsMsiPath(basePath)
  const msiData = await fs.readFile(msiPath)
  const sha256 = await getFileSha256(msiPath)
  const msiName = path.basename(msiPath)

  // Create zip using adm-zip
  const zip = new AdmZip()
  zip.addFile(msiName, msiData)
  zip.addFile("registration.token", Buffer.from(token, "utf-8"))
  const zipData = zip.toBuffer()

  const bundleName = `KuaminiSecurityClient-${accountId.slice(0, 8)}.zip`

  void safeAuditLog({
    action: "installer_download",
    entityType: "installer",
    entityId: accountId,
    accountId,
    ip: clientIp,
    userAgent,
    details: { platform: "windows", sha256, bundle: "msi+token", msi: msiName },
  })

  return new NextResponse(new Uint8Array(zipData), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${bundleName}"`,
      "X-Checksum-SHA256": sha256,
      "X-Bundle-Type": "msi+token",
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

async function resolveLatestWindowsMsiPath(basePath: string) {
  const entries = await fs.readdir(basePath)
  const versioned: { name: string; version: number[] }[] = []

  for (const name of entries) {
    const match = /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.msi$/u.exec(name)
    if (!match) {
      continue
    }

    const parts = match[1].split(".").map((part) => Number(part) || 0)
    versioned.push({ name, version: parts })
  }

  if (versioned.length > 0) {
    versioned.sort((a, b) => {
      const maxLen = Math.max(a.version.length, b.version.length)
      for (let i = 0; i < maxLen; i += 1) {
        const left = a.version[i] ?? 0
        const right = b.version[i] ?? 0
        if (left !== right) {
          return left - right
        }
      }
      return 0
    })

    return path.join(basePath, versioned[versioned.length - 1].name)
  }

  const fallbackCandidates = [
    "KuaminiSecurityClient-1.0.5.msi",
    "KuaminiSecurityClient-1.0.0.msi",
    "windows.msi",
  ]

  return resolveBundlePath(fallbackCandidates.map((f) => path.join(basePath, f)))
}

async function triggerWindowsBuild(params: {
  token: string
  accountId: string
  accountName: string
}) {
  if (!INSTALLER_BUILD_GH_TOKEN) {
    return { ok: false, error: "Missing INSTALLER_BUILD_GH_TOKEN" }
  }

  const url = `https://api.github.com/repos/${INSTALLER_BUILD_GH_REPO}/actions/workflows/${INSTALLER_BUILD_WORKFLOW}/dispatches`
  const body = {
    ref: "main",
    inputs: {
      token: params.token,
      accountId: params.accountId,
      accountName: params.accountName,
    },
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${INSTALLER_BUILD_GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    return { ok: false, error: `Dispatch failed: ${response.status} ${text}` }
  }

  return { ok: true }
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
        return await serveWindowsInstaller(accountId, account.name, registrationToken, clientIp, request.headers.get("user-agent"))
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
        ? ["KuaminiSecurityClient-1.0.0.msi", "KuaminiSecurityClient-windows.zip", "windows.msi", "windows.zip"]
        : ["KuaminiSecurityClient-linux.tar.gz", "linux.tar.gz", "linux.zip"]

    const filePath = await resolveBundlePath(candidates.map((f) => path.join(basePath, f)))
    const data = await fs.readFile(filePath)
    const sha256 = await getFileSha256(filePath)

    void safeAuditLog({
      action: "installer_download",
      entityType: "installer",
      entityId: accountId,
      accountId,
      ip: clientIp,
      userAgent,
      details: { platform, sha256, static: true },
    })

    const filename = platform === "windows" ? `KuaminiSecurityClient-${accountId.slice(0, 8)}.msi` : `KuaminiSecurityClient-${accountId.slice(0, 8)}.tar.gz`
    const contentType = platform === "windows" ? "application/octet-stream" : "application/gzip"

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
  accountName: string,
  token: string,
  clientIp?: string,
  userAgent?: string | null,
) {
  try {
    // Build a dynamic MSI + token bundle from the base installer
    try {
      console.info("[Windows Installer] Building MSI + token bundle")
      return await buildWindowsInstallerBundle(accountId, token, clientIp, userAgent)
    } catch (bundleError) {
      console.warn("[Windows Installer] Failed to build MSI bundle:", bundleError)
    }


    // Bundle build failed; trigger on-demand build if not already done
    const dispatch = await triggerWindowsBuild({ token, accountId, accountName })
    if (!dispatch.ok) {
      console.error("Windows installer build dispatch failed:", dispatch.error)
      return NextResponse.json({ error: "Windows installer is being prepared. Please retry shortly." }, { status: 202, headers: { "Retry-After": "15" } })
    }

    return NextResponse.json(
      {
        status: "building",
        message: "Windows installer is being prepared. Please retry in ~30 seconds.",
        retryAfter: 15,
      },
      { status: 202, headers: { "Retry-After": "15" } },
    )
  } catch (error) {
    console.error("Error preparing Windows installer:", error)
    return NextResponse.json({ error: "Windows installer not available" }, { status: 404 })
  }
}

async function serveMacOSInstaller(token: string, accountId: string, clientIp?: string, userAgent?: string | null) {
  try {
    // Serve the pre-built base PKG from public/tray/
    // The postinstall script will download account-specific config using the token
    const publicPath = await resolveBundlePath([
      path.join(process.cwd(), "public", "tray", "KuaminiSecurityClient-1.0.0.pkg"),
      path.join(process.cwd(), "public", "tray", "macos.pkg"),
    ])

    const pkgData = await fs.readFile(publicPath)
    const sha256 = await getFileSha256(publicPath)

    // Build the install URL for postinstall to use (e.g., in Vercel fallback)
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"
    const installUrl = `${apiBase}/installers/config?token=${token}`

    // Fire-and-forget audit log (no blocking on response)
    void safeAuditLog({
      action: "installer_download",
      entityType: "installer",
      entityId: accountId,
      accountId,
      ip: clientIp,
      userAgent,
      details: { platform: "macos", sha256, installUrl, fallback: true },
    })

    return new NextResponse(pkgData, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="KuaminiSecurityClient-${accountId.slice(0, 8)}.pkg"`,
        "X-Checksum-SHA256": sha256,
        "X-Install-URL": installUrl,
      },
    })
  } catch (error) {
    console.error("Error serving macOS installer:", error)
    throw error
  }
}

async function generateMacOSInstaller(_distPath: string, token: string, accountId: string, clientIp?: string, userAgent?: string | null) {
  try {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuamini-installer-"))
    const outputPkg = path.join(tempDir, `KuaminiSecurityClient-${accountId.slice(0, 8)}.pkg`)
    
    // Use the shell script to generate custom PKG
    const scriptPath = path.join(process.cwd(), "agent-tray", "build", "generate-custom-pkg.sh")
    
    const env = {
      ...process.env,
      API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com",
      CONSOLE_URL: `${process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"}/securityAgent`,
    }
    
    try {
      const { stdout, stderr } = await execAsync(`"${scriptPath}" "${token}" "${outputPkg}"`, { env })
      if (stdout) {
        console.info("generate-custom-pkg stdout:\n", stdout)
      }
      if (stderr) {console.warn("generate-custom-pkg stderr:\n", stderr)}
    } catch (e: any) {
      console.error("generate-custom-pkg failed:", e?.stderr || e?.message || e)
      console.warn("Falling back to static base PKG; postinstall will download account-specific config")
      // Clean up temp directory and fall back to static PKG
      await fs.rm(tempDir, { recursive: true, force: true })
      return await serveMacOSInstaller(token, accountId, clientIp, userAgent)
    }

    // Read the generated PKG
    const pkgData = await fs.readFile(outputPkg)
    const sha256 = await getFileSha256(outputPkg)

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })

    // Fire-and-forget audit log
    void safeAuditLog({
      action: "installer_download",
      entityType: "installer",
      entityId: accountId,
      accountId,
      ip: clientIp,
      userAgent,
      details: { platform: "macos", sha256 },
    })

    // Return the PKG file
    return new NextResponse(pkgData, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="KuaminiSecurityClient-${accountId.slice(0, 8)}.pkg"`,
        "X-Checksum-SHA256": sha256,
      },
    })
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
