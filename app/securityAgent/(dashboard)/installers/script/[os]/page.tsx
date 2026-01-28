"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Check, Download, ArrowLeft, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"
import { config } from "@/lib/config"

export default function ScriptPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const os = params.os as string
  const tokenFromUrl = searchParams.get("token")
  const [copied, setCopied] = useState(false)
  const [script, setScript] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function generateScript() {
      setLoading(true)
      setError(null)

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || `${config.productionDomain}/api/agent`

      let tokenData = { accountId: "", accountName: "" }
      let token = tokenFromUrl || ""

      if (!token) {
        try {
          const supabase = createBrowserClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            setError("You must be logged in to generate installer scripts")
            setLoading(false)
            return
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("account_id, account:accounts(id, name)")
            .eq("id", user.id)
            .maybeSingle()

          if (!profile || !profile.account) {
            setError("Could not find your account information")
            setLoading(false)
            return
          }

          tokenData = {
            accountId: (profile.account as { id: string; name: string }).id,
            accountName: (profile.account as { id: string; name: string }).name,
          }
          token = btoa(
            JSON.stringify({
              ...tokenData,
              timestamp: Date.now(),
            }),
          )
        } catch (_e) {
          console.error("Failed to fetch account:", _e)
          setError("Failed to load account information")
          setLoading(false)
          return
        }
      } else {
        try {
          tokenData = JSON.parse(atob(token))
        } catch {
          setError("Invalid token format. Please go back and try again.")
          setLoading(false)
          return
        }
      }

      if (os === "macos") {
        setScript(`#!/bin/bash
# KuaminiThreatProtectAgent Installer for macOS
# Account: ${tokenData.accountName}
# Generated: $(date)

set -e

echo "=========================================="
echo "KuaminiThreatProtectAgent Installer"
echo "=========================================="
echo ""

# Configuration
INSTALL_DIR="/usr/local/kuamini"
CONFIG_DIR="/etc/kuamini"
LOG_DIR="/var/log/kuamini"
API_BASE_URL="${apiBaseUrl}"
REGISTRATION_TOKEN="${token}"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (use sudo)"
  exit 1
fi

echo "[1/6] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"

echo "[2/6] Generating agent ID..."
AGENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo "Agent ID: $AGENT_ID"

echo "[3/6] Creating configuration..."
cat > "$CONFIG_DIR/agent.conf" << EOF
{
  "agent_id": "$AGENT_ID",
  "api_base_url": "$API_BASE_URL",
  "registration_token": "$REGISTRATION_TOKEN",
  "heartbeat_interval": 60,
  "scan_interval": 3600,
  "log_level": "info"
}
EOF

echo "[4/6] Creating agent script..."
cat > "$INSTALL_DIR/kuamini-agent.sh" << 'AGENT_SCRIPT'
#!/bin/bash
CONFIG_FILE="/etc/kuamini/agent.conf"
LOG_FILE="/var/log/kuamini/agent.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

send_heartbeat() {
  AGENT_ID=$(cat "$CONFIG_FILE" | grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  API_URL=$(cat "$CONFIG_FILE" | grep -o '"api_base_url"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  
  RESPONSE=$(curl -s -X POST "$API_URL/heartbeat" \
    -H "Content-Type: application/json" \
    -d "{
      "agent_id": "$AGENT_ID",
      "status": "online",
      "system_info": {
        "hostname": "$(hostname)",
        "os": "$(uname -s)",
        "os_version": "$(sw_vers -productVersion 2>/dev/null || uname -r)",
        "cpu_usage": $(top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%' || echo "0"),
        "memory_usage": $(vm_stat | awk '/Pages active/ {print $3}' | tr -d '.' || echo "0")
      }
    }")
  
  log "Heartbeat sent: $RESPONSE"
}

# Main loop
log "KuaminiThreatProtectAgent started"
while true; do
  send_heartbeat
  sleep 60
done
AGENT_SCRIPT

chmod +x "$INSTALL_DIR/kuamini-agent.sh"

echo "[5/6] Registering agent..."
HOSTNAME=$(hostname)
OS_VERSION=$(sw_vers -productVersion 2>/dev/null || uname -r)

REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d "{
    "token": "$REGISTRATION_TOKEN",
    "agent_id": "$AGENT_ID",
    "hostname": "$HOSTNAME",
    "os": "macos",
    "os_version": "$OS_VERSION"
  }")

echo "Registration response: $REGISTER_RESPONSE"

echo "[6/6] Installing LaunchDaemon..."
cat > /Library/LaunchDaemons/com.kuamini.agent.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.kuamini.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/usr/local/kuamini/kuamini-agent.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/var/log/kuamini/agent.log</string>
  <key>StandardErrorPath</key>
  <string>/var/log/kuamini/agent-error.log</string>
</dict>
</plist>
EOF

launchctl load /Library/LaunchDaemons/com.kuamini.agent.plist

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo "Agent ID: $AGENT_ID"
echo "Config: $CONFIG_DIR/agent.conf"
echo "Logs: $LOG_DIR/agent.log"
echo ""
echo "Commands:"
echo "  Status: launchctl list | grep kuamini"
echo "  Stop:   sudo launchctl unload /Library/LaunchDaemons/com.kuamini.agent.plist"
echo "  Start:  sudo launchctl load /Library/LaunchDaemons/com.kuamini.agent.plist"
echo "  Logs:   tail -f /var/log/kuamini/agent.log"
echo "=========================================="
`)
      } else if (os === "linux") {
        setScript(`#!/bin/bash
# KuaminiThreatProtectAgent Installer for Linux
# Account: ${tokenData.accountName}
# Generated: $(date)

set -e

echo "=========================================="
echo "KuaminiThreatProtectAgent Installer"
echo "=========================================="
echo ""

# Configuration
INSTALL_DIR="/usr/local/kuamini"
CONFIG_DIR="/etc/kuamini"
LOG_DIR="/var/log/kuamini"
API_BASE_URL="${apiBaseUrl}"
REGISTRATION_TOKEN="${token}"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (use sudo)"
  exit 1
fi

echo "[1/6] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"

echo "[2/6] Generating agent ID..."
AGENT_ID=$(cat /proc/sys/kernel/random/uuid)
echo "Agent ID: $AGENT_ID"

echo "[3/6] Creating configuration..."
cat > "$CONFIG_DIR/agent.conf" << EOF
{
  "agent_id": "$AGENT_ID",
  "api_base_url": "$API_BASE_URL",
  "registration_token": "$REGISTRATION_TOKEN",
  "heartbeat_interval": 60,
  "scan_interval": 3600,
  "log_level": "info"
}
EOF

echo "[4/6] Creating agent script..."
cat > "$INSTALL_DIR/kuamini-agent.sh" << 'AGENT_SCRIPT'
#!/bin/bash
CONFIG_FILE="/etc/kuamini/agent.conf"
LOG_FILE="/var/log/kuamini/agent.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

send_heartbeat() {
  AGENT_ID=$(grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
  API_URL=$(grep -o '"api_base_url"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
  
  CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 || echo "0")
  MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100}' || echo "0")
  
  RESPONSE=$(curl -s -X POST "$API_URL/heartbeat" \
    -H "Content-Type: application/json" \
    -d "{
      "agent_id": "$AGENT_ID",
      "status": "online",
      "system_info": {
        "hostname": "$(hostname)",
        "os": "linux",
        "os_version": "$(uname -r)",
        "cpu_usage": $CPU_USAGE,
        "memory_usage": $MEM_USAGE
      }
    }")
  
  log "Heartbeat sent: $RESPONSE"
}

# Main loop
log "KuaminiThreatProtectAgent started"
while true; do
  send_heartbeat
  sleep 60
done
AGENT_SCRIPT

chmod +x "$INSTALL_DIR/kuamini-agent.sh"

echo "[5/6] Registering agent..."
HOSTNAME=$(hostname)
OS_VERSION=$(uname -r)

REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d "{
    "token": "$REGISTRATION_TOKEN",
    "agent_id": "$AGENT_ID",
    "hostname": "$HOSTNAME",
    "os": "linux",
    "os_version": "$OS_VERSION"
  }")

echo "Registration response: $REGISTER_RESPONSE"

echo "[6/6] Creating systemd service..."
cat > /etc/systemd/system/kuamini-agent.service << EOF
[Unit]
Description=KuaminiThreatProtectAgent
After=network.target

[Service]
Type=simple
ExecStart=/bin/bash /usr/local/kuamini/kuamini-agent.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable kuamini-agent
systemctl start kuamini-agent

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo "Agent ID: $AGENT_ID"
echo "Config: $CONFIG_DIR/agent.conf"
echo "Logs: $LOG_DIR/agent.log"
echo ""
echo "Commands:"
echo "  Status: systemctl status kuamini-agent"
echo "  Stop:   sudo systemctl stop kuamini-agent"
echo "  Start:  sudo systemctl start kuamini-agent"
echo "  Logs:   journalctl -u kuamini-agent -f"
echo "=========================================="
`)
      } else if (os === "windows") {
        setScript(`# KuaminiThreatProtectAgent Installer for Windows
# Account: ${tokenData.accountName}
# Run this script as Administrator in PowerShell

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "KuaminiThreatProtectAgent Installer" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$InstallDir = "C:\\Program Files\\Kuamini"
$ConfigDir = "C:\\ProgramData\\Kuamini"
$LogDir = "C:\\ProgramData\\Kuamini\\Logs"
$ApiBaseUrl = "${apiBaseUrl}"
$RegistrationToken = "${token}"

# Check for Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Error: Please run as Administrator" -ForegroundColor Red
    exit 1
}

Write-Host "[1/6] Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Write-Host "[2/6] Generating agent ID..." -ForegroundColor Yellow
$AgentId = [guid]::NewGuid().ToString()
Write-Host "Agent ID: $AgentId"

Write-Host "[3/6] Creating configuration..." -ForegroundColor Yellow
$Config = @{
    agent_id = $AgentId
    api_base_url = $ApiBaseUrl
    registration_token = $RegistrationToken
    heartbeat_interval = 60
    scan_interval = 3600
    log_level = "info"
} | ConvertTo-Json

$Config | Out-File -FilePath "$ConfigDir\\agent.conf" -Encoding UTF8

Write-Host "[4/6] Creating agent script..." -ForegroundColor Yellow
$AgentScript = @'
$ConfigFile = "C:\\ProgramData\\Kuamini\\agent.conf"
$LogFile = "C:\\ProgramData\\Kuamini\\Logs\\agent.log"

function Write-Log {
    param($Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$Timestamp - $Message" | Add-Content -Path $LogFile
}

function Send-Heartbeat {
    $Config = Get-Content $ConfigFile | ConvertFrom-Json
    $AgentId = $Config.agent_id
    $ApiUrl = $Config.api_base_url
    
    $CpuUsage = (Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $Memory = Get-WmiObject Win32_OperatingSystem
    $MemoryUsage = [math]::Round((($Memory.TotalVisibleMemorySize - $Memory.FreePhysicalMemory) / $Memory.TotalVisibleMemorySize) * 100, 2)
    
    $Body = @{
        agent_id = $AgentId
        status = "online"
        system_info = @{
            hostname = $env:COMPUTERNAME
            os = "windows"
            os_version = [System.Environment]::OSVersion.Version.ToString()
            cpu_usage = $CpuUsage
            memory_usage = $MemoryUsage
        }
    } | ConvertTo-Json -Depth 3
    
    try {
        $Response = Invoke-RestMethod -Uri "$ApiUrl/heartbeat" -Method Post -Body $Body -ContentType "application/json"
        Write-Log "Heartbeat sent: $($Response | ConvertTo-Json -Compress)"
    } catch {
        Write-Log "Heartbeat failed: $_"
    }
}

Write-Log "KuaminiThreatProtectAgent started"
while ($true) {
    Send-Heartbeat
    Start-Sleep -Seconds 60
}
'@

$AgentScript | Out-File -FilePath "$InstallDir\\kuamini-agent.ps1" -Encoding UTF8

Write-Host "[5/6] Registering agent..." -ForegroundColor Yellow
$RegisterBody = @{
    token = $RegistrationToken
    agent_id = $AgentId
    hostname = $env:COMPUTERNAME
    os = "windows"
    os_version = [System.Environment]::OSVersion.Version.ToString()
} | ConvertTo-Json

try {
    $RegisterResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/register" -Method Post -Body $RegisterBody -ContentType "application/json"
    Write-Host "Registration response: $($RegisterResponse | ConvertTo-Json -Compress)"
} catch {
    Write-Host "Registration failed: $_" -ForegroundColor Red
}

Write-Host "[6/6] Creating scheduled task..." -ForegroundColor Yellow
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File \`"$InstallDir\\kuamini-agent.ps1\`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "KuaminiThreatProtectAgent" -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

Start-ScheduledTask -TaskName "KuaminiThreatProtectAgent"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Agent ID: $AgentId"
Write-Host "Config: $ConfigDir\\agent.conf"
Write-Host "Logs: $LogDir\\agent.log"
Write-Host ""
Write-Host "Commands:"
Write-Host "  Status: Get-ScheduledTask -TaskName 'KuaminiThreatProtectAgent'"
Write-Host "  Stop:   Stop-ScheduledTask -TaskName 'KuaminiThreatProtectAgent'"
Write-Host "  Start:  Start-ScheduledTask -TaskName 'KuaminiThreatProtectAgent'"
Write-Host "  Logs:   Get-Content '$LogDir\\agent.log' -Tail 50"
Write-Host "==========================================" -ForegroundColor Green
`)
      } else {
        setError(`Unsupported OS: ${os}`)
      }

      setLoading(false)
    }

    generateScript()
  }, [os, tokenFromUrl])

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadScript = () => {
    const ext = os === "windows" ? "ps1" : "sh"
    const filename = `install-kuamini-agent.${ext}`
    const blob = new Blob([script], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const osNames: Record<string, string> = {
    macos: "macOS",
    linux: "Linux",
    windows: "Windows",
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2">Generating installer script...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Link
          href="/securityAgent/installers"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Installers
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium text-destructive">{error}</p>
            <Link href="/securityAgent/installers">
              <Button className="mt-4">Go Back to Installers</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Link
        href="/securityAgent/installers"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Installers
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>KuaminiThreatProtectAgent - {osNames[os]} Installer Script</CardTitle>
          <CardDescription>
            Copy or download this script, then run it on your {osNames[os]} endpoint to install the agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={copyToClipboard} variant="outline">
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied!" : "Copy Script"}
            </Button>
            <Button onClick={downloadScript}>
              <Download className="mr-2 h-4 w-4" />
              Download Script
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">Installation Instructions:</h4>
            {os === "macos" && (
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Click "Download Script" or "Copy Script"</li>
                <li>
                  If copied, save to a file:{" "}
                  <code className="bg-background px-1 rounded">install-kuamini-agent.sh</code>
                </li>
                <li>
                  Open Terminal and run:{" "}
                  <code className="bg-background px-1 rounded">chmod +x install-kuamini-agent.sh</code>
                </li>
                <li>
                  Execute: <code className="bg-background px-1 rounded">sudo ./install-kuamini-agent.sh</code>
                </li>
              </ol>
            )}
            {os === "linux" && (
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Click "Download Script" or "Copy Script"</li>
                <li>
                  If copied, save to a file:{" "}
                  <code className="bg-background px-1 rounded">install-kuamini-agent.sh</code>
                </li>
                <li>
                  Open Terminal and run:{" "}
                  <code className="bg-background px-1 rounded">chmod +x install-kuamini-agent.sh</code>
                </li>
                <li>
                  Execute: <code className="bg-background px-1 rounded">sudo ./install-kuamini-agent.sh</code>
                </li>
              </ol>
            )}
            {os === "windows" && (
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Click "Download Script" or "Copy Script"</li>
                <li>
                  If copied, save to a file:{" "}
                  <code className="bg-background px-1 rounded">install-kuamini-agent.ps1</code>
                </li>
                <li>Open PowerShell as Administrator</li>
                <li>Navigate to the script directory</li>
                <li>
                  Execute: <code className="bg-background px-1 rounded">.\install-kuamini-agent.ps1</code>
                </li>
              </ol>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="font-medium mb-2">Script Preview:</h4>
            <pre className="text-xs overflow-auto max-h-96 bg-muted p-4 rounded">{script}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
