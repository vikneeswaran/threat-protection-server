import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ os: string }> }) {
  const { os } = await params
  const searchParams = request.nextUrl.searchParams
  const endpointId = searchParams.get("endpoint_id")
  const agentId = searchParams.get("agent_id")

  // Verify authentication
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com/securityAgent/api/agent"

  let script: string
  let filename: string
  let contentType: string

  switch (os.toLowerCase()) {
    case "macos":
      filename = "uninstall-kuamini-agent.sh"
      contentType = "application/x-sh"
      script = generateMacOSUninstaller(baseUrl, endpointId, agentId)
      break
    case "linux":
      filename = "uninstall-kuamini-agent.sh"
      contentType = "application/x-sh"
      script = generateLinuxUninstaller(baseUrl, endpointId, agentId)
      break
    case "windows":
      filename = "uninstall-kuamini-agent.ps1"
      contentType = "application/octet-stream"
      script = generateWindowsUninstaller(baseUrl, endpointId, agentId)
      break
    default:
      return NextResponse.json({ error: "Unsupported OS" }, { status: 400 })
  }

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

function generateMacOSUninstaller(baseUrl: string, endpointId: string | null, agentId: string | null): string {
  const deregisterUrl = baseUrl.replace("/securityAgent/api/agent", "/api/agent")
  return `#!/bin/bash
set -euo pipefail

# Kuamini Agent Cleaner for macOS
# Removes all agent files and deregisters from console

echo "🧹 Kuamini Agent Cleaner for macOS"
echo "===================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run with sudo"
    exit 1
fi

# Get the actual user (handle both sudo and direct root)
if [ -n "\${SUDO_USER:-}" ]; then
    ACTUAL_USER="$SUDO_USER"
    ACTUAL_UID=$(id -u "$SUDO_USER")
else
    ACTUAL_USER=$(whoami)
    ACTUAL_UID=$(id -u)
fi

ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)
CONFIG_FILE="$ACTUAL_HOME/.kuamini/config.json"
API_BASE="${deregisterUrl}"
${agentId ? `AGENT_ID="${agentId}"` : 'AGENT_ID=""'}

echo "👤 Running as root, actual user: $ACTUAL_USER"
echo ""

# Extract agent_id from config if not provided
if [ -z "$AGENT_ID" ] && [ -f "$CONFIG_FILE" ]; then
    echo "📖 Reading config from $CONFIG_FILE"
    
    if command -v jq &> /dev/null; then
        AGENT_ID=$(jq -r '.agent_id // empty' "$CONFIG_FILE" 2>/dev/null || echo "")
    else
        AGENT_ID=$(grep -o '"agent_id":"[^"]*"' "$CONFIG_FILE" 2>/dev/null | head -1 | cut -d'"' -f4 || echo "")
    fi
    
    if [ -n "$AGENT_ID" ]; then
        echo "✅ Found agent_id: $AGENT_ID"
    else
        echo "⚠️  Warning: Could not find agent_id in config"
    fi
else
    echo "ℹ️  Using provided agent_id: $AGENT_ID"
fi

echo ""

# Deregister endpoint from console
if [ -n "$AGENT_ID" ]; then
    echo "📡 Deregistering endpoint from console..."
    DEREGISTER_URL="$API_BASE/deregister"
    
    # Export CA certs for curl
    /usr/bin/security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain > /tmp/cacert.pem 2>/dev/null || true
    
    if [ -f /tmp/cacert.pem ]; then
        /usr/bin/curl -sf --cacert /tmp/cacert.pem -X POST \
            "$DEREGISTER_URL" \
            -H "Content-Type: application/json" \
            -d "{\\"agent_id\\":\\"$AGENT_ID\\"}" 2>/dev/null && echo "✅ Endpoint deregistered successfully" || echo "⚠️  Warning: Could not deregister endpoint"
        rm -f /tmp/cacert.pem
    else
        /usr/bin/curl -k -sf -X POST \
            "$DEREGISTER_URL" \
            -H "Content-Type: application/json" \
            -d "{\\"agent_id\\":\\"$AGENT_ID\\"}" 2>/dev/null && echo "✅ Endpoint deregistered successfully" || echo "⚠️  Warning: Could not deregister endpoint"
    fi
    echo ""
fi

# Kill the agent process
echo "🛑 Stopping agent process..."
if pgrep -f "KuaminiAgentTray" > /dev/null; then
    killall -9 KuaminiAgentTray 2>/dev/null || true
    sleep 1
    echo "✅ Agent process terminated"
fi

# Stop and unload LaunchAgent
echo "🛑 Unloading LaunchAgent..."
LAUNCH_PLIST="$ACTUAL_HOME/Library/LaunchAgents/com.kuamini.agenttray.plist"
if launchctl list | grep -q com.kuamini.agenttray; then
    sudo -u "$ACTUAL_USER" launchctl bootout "gui/$ACTUAL_UID" com.kuamini.agenttray 2>/dev/null || \
    launchctl bootout "gui/$ACTUAL_UID" com.kuamini.agenttray 2>/dev/null || \
    sudo -u "$ACTUAL_USER" launchctl bootout "gui/$ACTUAL_UID" "$LAUNCH_PLIST" 2>/dev/null || \
    launchctl remove com.kuamini.agenttray 2>/dev/null || true
    echo "✅ LaunchAgent unloaded"
fi

# Remove LaunchAgent plist
if [ -f "$LAUNCH_PLIST" ]; then
    rm -f "$LAUNCH_PLIST"
    echo "✅ Removed LaunchAgent plist"
fi

echo ""

# Remove application
echo "🗑️  Removing application..."
if [ -d "/Applications/KuaminiAgentTray.app" ]; then
    rm -rf "/Applications/KuaminiAgentTray.app"
    echo "✅ Removed /Applications/KuaminiAgentTray.app"
fi

# Remove config directory
echo "🗑️  Removing configuration..."
if [ -d "$ACTUAL_HOME/.kuamini" ]; then
    rm -rf "$ACTUAL_HOME/.kuamini"
    echo "✅ Removed $ACTUAL_HOME/.kuamini"
fi

# Remove LaunchDaemon if present (legacy)
if [ -f "/Library/LaunchDaemons/com.kuamini.agenttray.plist" ]; then
    rm -f "/Library/LaunchDaemons/com.kuamini.agenttray.plist"
    echo "✅ Removed LaunchDaemon plist"
fi

# Remove from login items
LOGIN_ITEMS_DIR="$ACTUAL_HOME/Library/Application Support/com.apple.sharedfilelist"
if [ -d "$LOGIN_ITEMS_DIR" ]; then
    find "$LOGIN_ITEMS_DIR" -type f -exec sed -i '' '/KuaminiAgentTray/d' {} \\; 2>/dev/null || true
    echo "✅ Removed from login items"
fi

# Refresh Dock
killall Dock 2>/dev/null || true

echo ""
echo "✅ Kuamini Agent successfully removed!"
echo "🎉 License released and endpoint deregistered"
echo ""
`
}

function generateLinuxUninstaller(baseUrl: string, endpointId: string | null, agentId: string | null): string {
  const idParam = endpointId ? `endpoint_id=${endpointId}` : agentId ? `agent_id=${agentId}` : ""
  return `#!/bin/bash
# KuaminiThreatProtectAgent Uninstaller for Linux
# This script will stop and remove the Kuamini agent from your system

set -e

echo "=========================================="
echo "KuaminiThreatProtectAgent Uninstaller"
echo "=========================================="

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "[1/5] Stopping agent service..."
systemctl stop kuamini-agent 2>/dev/null || true

echo "[2/5] Disabling agent service..."
systemctl disable kuamini-agent 2>/dev/null || true

echo "[3/5] Removing agent files..."
rm -rf /opt/kuamini
rm -rf /etc/kuamini
rm -rf /var/log/kuamini
rm -f /etc/systemd/system/kuamini-agent.service

echo "[4/5] Reloading systemd..."
systemctl daemon-reload

echo "[5/5] Deregistering from console..."
${idParam ? `curl -s -X POST "${baseUrl}/uninstall?${idParam}" || true` : "echo 'Skipping API deregistration (no endpoint/agent ID provided)'"}

echo ""
echo "=========================================="
echo "Uninstall Complete!"
echo "The Kuamini agent has been removed."
echo "=========================================="
`
}

function generateWindowsUninstaller(baseUrl: string, endpointId: string | null, agentId: string | null): string {
  const deregisterUrl = baseUrl.replace("/securityAgent/api/agent", "/api/agent")
  return `# Kuamini Agent Cleaner for Windows
# Removes all agent files and deregisters from console
# Run as Administrator in PowerShell

#Requires -RunAsAdministrator

Write-Host "🧹 Kuamini Agent Cleaner for Windows" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

$configDir = "$env:APPDATA\\Kuamini"
$configFile = "$configDir\\config.json"
$installDir = "$env:ProgramFiles\\Kuamini\\AgentTray"
$apiBase = "${deregisterUrl}"
${agentId ? `$agentId = "${agentId}"` : '$agentId = $null'}

# Extract agent_id from config if not provided
if (-not $agentId -and (Test-Path $configFile)) {
    Write-Host "📖 Reading config from $configFile"
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        $agentId = $config.agent_id
        
        if ($agentId) {
            Write-Host "✅ Found agent_id: $agentId"
        } else {
            Write-Host "⚠️  Warning: Could not find agent_id in config" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  Warning: Could not parse config file" -ForegroundColor Yellow
    }
} elseif ($agentId) {
    Write-Host "ℹ️  Using provided agent_id: $agentId"
}

Write-Host ""

# Deregister endpoint from console
if ($agentId) {
    Write-Host "📡 Deregistering endpoint from console..."
    try {
        $deregUrl = "$apiBase/deregister"
        $body = @{ agent_id = $agentId } | ConvertTo-Json
        
        $response = Invoke-WebRequest -Uri $deregUrl -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        Write-Host "✅ Endpoint deregistered successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Warning: Could not deregister endpoint (may already be removed)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Stop scheduled task
Write-Host "🛑 Stopping agent..."
try {
    Stop-Process -Name "KuaminiAgentTray" -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Agent process stopped"
} catch {
    Write-Host "⚠️  Agent not running"
}

# Remove scheduled task
Write-Host "🗑️  Removing scheduled task..."
try {
    Unregister-ScheduledTask -TaskName "KuaminiAgentTray" -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "✅ Scheduled task removed"
} catch {
    Write-Host "⚠️  Scheduled task not found"
}

# Remove installation directory
Write-Host "🗑️  Removing application files..."
if (Test-Path $installDir) {
    try {
        Remove-Item -Path $installDir -Recurse -Force
        Write-Host "✅ Removed $installDir"
    } catch {
        Write-Host "⚠️  Could not remove $installDir (may be in use)" -ForegroundColor Yellow
    }
}

# Remove config directory
Write-Host "🗑️  Removing configuration..."
if (Test-Path $configDir) {
    try {
        Remove-Item -Path $configDir -Recurse -Force
        Write-Host "✅ Removed $configDir"
    } catch {
        Write-Host "⚠️  Could not remove $configDir" -ForegroundColor Yellow
    }
}

# Remove from Program Files if alternate location was used
$altInstallDir = "$env:ProgramFiles\\Kuamini"
if (Test-Path $altInstallDir) {
    try {
        Remove-Item -Path $altInstallDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Removed alternate installation directory"
    } catch {
        Write-Host "⚠️  Could not remove alternate directory" -ForegroundColor Yellow
    }
}

# Remove desktop shortcut if present
$desktopShortcut = "$env:Public\\Desktop\\Kuamini Agent Tray.lnk"
if (Test-Path $desktopShortcut) {
    Remove-Item $desktopShortcut -Force
    Write-Host "✅ Removed desktop shortcut"
}

# Remove Start Menu shortcuts
$startMenuPath = "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Kuamini"
if (Test-Path $startMenuPath) {
    Remove-Item $startMenuPath -Recurse -Force
    Write-Host "✅ Removed Start Menu shortcuts"
}

Write-Host ""
Write-Host "✅ Kuamini Agent successfully removed!" -ForegroundColor Green
Write-Host "🎉 License released and endpoint deregistered" -ForegroundColor Green
Write-Host ""
`
}
