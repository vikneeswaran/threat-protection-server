import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import fs from "fs/promises"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import os from "os"

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const platform = searchParams.get("platform") // macos, windows, linux
    const accountId = searchParams.get("accountId")
    const subAccountId = searchParams.get("subAccountId")

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
    const registrationToken = Buffer.from(
      JSON.stringify({
        accountId: accountId,
        subAccountId: subAccountId || null,
        accountName: account.name,
        timestamp: Date.now(),
        generatedBy: user.id,
      }),
    ).toString("base64")

    // Get the path to agent-tray dist folder
    const projectRoot = process.cwd()
    const agentTrayDistPath = path.join(projectRoot, "agent-tray", "dist")

    // Generate custom installer based on platform
    switch (platform) {
      case "macos":
        return await generateMacOSInstaller(agentTrayDistPath, registrationToken, accountId)
      case "windows":
        return await generateWindowsInstaller(agentTrayDistPath, registrationToken, accountId)
      case "linux":
        return await generateLinuxInstaller(agentTrayDistPath, registrationToken, accountId)
      default:
        return NextResponse.json({ error: "Unsupported platform" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error generating installer:", error)
    return NextResponse.json({ error: "Failed to generate installer" }, { status: 500 })
  }
}

async function generateMacOSInstaller(distPath: string, token: string, accountId: string) {
  try {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuamini-installer-"))
    const outputPkg = path.join(tempDir, `KuaminiAgentTray-${accountId.slice(0, 8)}.pkg`)
    
    // Use the shell script to generate custom PKG
    const scriptPath = path.join(process.cwd(), "agent-tray", "build", "generate-custom-pkg.sh")
    
    const env = {
      ...process.env,
      API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com",
      CONSOLE_URL: `${process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"}/securityAgent`,
    }
    
    await execAsync(`"${scriptPath}" "${token}" "${outputPkg}"`, { env })

    // Read the generated PKG
    const pkgData = await fs.readFile(outputPkg)

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })

    // Return the PKG file
    return new NextResponse(pkgData, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="KuaminiAgentTray-${accountId.slice(0, 8)}.pkg"`,
      },
    })
  } catch (error) {
    console.error("Error generating macOS installer:", error)
    throw error
  }
}

async function generateWindowsInstaller(distPath: string, token: string, accountId: string) {
  try {
    // For Windows, we'll create a self-extracting archive with embedded config
    // This is a simplified approach - in production you'd want to use WiX or Inno Setup
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuamini-installer-"))

    // Create config.json
    const config = {
      api_base_url: process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com",
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

Write-Host "Installing Kuamini Threat Protection Agent..." -ForegroundColor Green

# Create installation directory
$installDir = "$env:ProgramFiles\\Kuamini\\AgentTray"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Create config directory
$configDir = "$env:APPDATA\\Kuamini"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

# Write config file
$config = @{
    api_base_url = "${process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"}"
    registration_token = "${token}"
    auto_register = $true
}
$config | ConvertTo-Json | Out-File -FilePath "$configDir\\config.json" -Encoding UTF8

# Download agent binary
Write-Host "Downloading agent binary..." -ForegroundColor Yellow
$agentUrl = "${process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"}/tray/windows.zip"
$zipPath = "$env:TEMP\\kuamini-agent.zip"
Invoke-WebRequest -Uri $agentUrl -OutFile $zipPath

# Extract agent
Write-Host "Extracting agent..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
Remove-Item $zipPath

# Create scheduled task for auto-start
Write-Host "Configuring auto-start..." -ForegroundColor Yellow
$action = New-ScheduledTaskAction -Execute "$installDir\\KuaminiAgentTray.exe"
$trigger = New-ScheduledTaskTrigger -AtLogon
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "KuaminiAgentTray" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force

# Start the agent
Write-Host "Starting agent..." -ForegroundColor Yellow
Start-Process "$installDir\\KuaminiAgentTray.exe"

Write-Host "Installation complete! The Kuamini agent is now running and will start automatically at login." -ForegroundColor Green
Write-Host "Check the system tray for the Kuamini icon." -ForegroundColor Cyan
`

    await fs.writeFile(path.join(tempDir, "install.ps1"), installerScript)

    // Read the installer script
    const scriptData = await fs.readFile(path.join(tempDir, "install.ps1"))

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })

    return new NextResponse(scriptData, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="Install-KuaminiAgent-${accountId.slice(0, 8)}.ps1"`,
      },
    })
  } catch (error) {
    console.error("Error generating Windows installer:", error)
    throw error
  }
}

async function generateLinuxInstaller(distPath: string, token: string, accountId: string) {
  try {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuamini-installer-"))

    // Create bash installer script with embedded config
    const installerScript = `#!/bin/bash
# Kuamini Agent Installer for Linux
# Auto-configured for account: ${accountId}

set -e

echo "Installing Kuamini Threat Protection Agent..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Create installation directory
INSTALL_DIR="/opt/kuamini/agenttray"
mkdir -p "$INSTALL_DIR"

# Create config directory
CONFIG_DIR="/etc/kuamini"
mkdir -p "$CONFIG_DIR"

# Write config file
cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "api_base_url": "${process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"}",
  "registration_token": "${token}",
  "auto_register": true
}
EOF

# Download agent binary
echo "Downloading agent binary..."
AGENT_URL="${process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"}/tray/linux.tar.gz"
curl -sSL "$AGENT_URL" | tar -xz -C "$INSTALL_DIR"

# Create systemd service
cat > /etc/systemd/system/kuamini-agent.service << 'EOF'
[Unit]
Description=Kuamini Threat Protection Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/kuamini/agenttray/KuaminiAgentTray
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable kuamini-agent.service
systemctl start kuamini-agent.service

echo "Installation complete! The Kuamini agent is now running."
echo "Check status with: systemctl status kuamini-agent"
`

    await fs.writeFile(path.join(tempDir, "install.sh"), installerScript)

    // Read the installer script
    const scriptData = await fs.readFile(path.join(tempDir, "install.sh"))

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })

    return new NextResponse(scriptData, {
      headers: {
        "Content-Type": "application/x-sh",
        "Content-Disposition": `attachment; filename="install-kuamini-agent-${accountId.slice(0, 8)}.sh"`,
      },
    })
  } catch (error) {
    console.error("Error generating Linux installer:", error)
    throw error
  }
}
