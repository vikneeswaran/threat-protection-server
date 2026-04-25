import { type NextRequest, NextResponse } from "next/server"

const INSTALLER_AGENT_VERSION = process.env.AGENT_VERSION ?? "1.0.6"

// Get the base URL for the API
function getBaseUrl(request: NextRequest): string {
  // Default to production domain and HTTPS when host header is missing.
  const host = request.headers.get("host") || "kuaminisystems.com"
  const protocol = "https"
  return `${protocol}://${host}`
}

// Generate macOS installer script
function generateMacOSScript(token: string, baseUrl: string): string {
  return `#!/bin/bash
# KuaminiThreatProtectAgent Installer for macOS
# Copyright (c) Kuamini Systems

set -e

AGENT_NAME="KuaminiThreatProtectAgent"
INSTALL_DIR="/usr/local/kuamini"
CONFIG_DIR="/etc/kuamini"
LOG_DIR="/var/log/kuamini"
REGISTRATION_TOKEN="${token}"
API_BASE_URL="${baseUrl}/securityAgent/api/agent"

echo "=========================================="
echo "  KuaminiThreatProtectAgent Installer"
echo "  for macOS"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

echo "[1/6] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"

echo "[2/6] Generating agent configuration..."
AGENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
HOSTNAME=$(hostname)
OS_VERSION=$(sw_vers -productVersion)

cat > "$CONFIG_DIR/agent.conf" << EOF
# KuaminiThreatProtectAgent Configuration
AGENT_ID=$AGENT_ID
HOSTNAME=$HOSTNAME
OS_TYPE=macos
OS_VERSION=$OS_VERSION
REGISTRATION_TOKEN=$REGISTRATION_TOKEN
API_BASE_URL=$API_BASE_URL
HEARTBEAT_INTERVAL=60
SCAN_ENABLED=true
REALTIME_PROTECTION=true
EOF

echo "[3/6] Creating agent service script..."
cat > "$INSTALL_DIR/agent.sh" << 'AGENTSCRIPT'
#!/bin/bash
source /etc/kuamini/agent.conf

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> /var/log/kuamini/agent.log
}

register_agent() {
  log "Registering agent with server..."
  RESPONSE=$(curl -s -X POST "$API_BASE_URL/register" \\
    -H "Content-Type: application/json" \\
      \\"token\\": \\"$REGISTRATION_TOKEN\\",
      \\"hostname\\": \\"$HOSTNAME\\",
      \\"os_type\\": \\"$OS_TYPE\\",
      \\"os_version\\": \\"$OS_VERSION\\",
        \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\",
      \\"ip_address\\": \\"$(ipconfig getifaddr en0 2>/dev/null || echo 'unknown')\\"
    }")
  
  if echo "$RESPONSE" | grep -q "endpoint"; then
    log "Registration successful"
    echo "$RESPONSE" > /etc/kuamini/registration.json
    return 0
  else
    log "Registration failed: $RESPONSE"
    return 1
  fi
}

send_heartbeat() {
  curl -s -X POST "$API_BASE_URL/heartbeat" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"endpoint_id\\": \\"$AGENT_ID\\",
      \\"status\\": \\"online\\",
      \\"cpu_usage\\": $(top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%'),
      \\"memory_usage\\": $(memory_pressure | grep "System-wide memory free percentage" | awk '{print 100-$5}' | tr -d '%'),
         \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\"
    }" > /dev/null 2>&1
}

# Main loop
log "Agent starting..."
register_agent

while true; do
  send_heartbeat
  log "Heartbeat sent"
  sleep $HEARTBEAT_INTERVAL
done
AGENTSCRIPT

chmod +x "$INSTALL_DIR/agent.sh"

echo "[4/6] Creating LaunchDaemon..."
cat > /Library/LaunchDaemons/com.kuamini.threatprotect.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.kuamini.threatprotect</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/usr/local/kuamini/agent.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/kuamini/agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/kuamini/agent.error.log</string>
</dict>
</plist>
EOF

echo "[5/6] Loading agent service..."
launchctl load /Library/LaunchDaemons/com.kuamini.threatprotect.plist

echo "[6/6] Verifying installation..."
sleep 2
if launchctl list | grep -q "com.kuamini.threatprotect"; then
  echo ""
  echo "=========================================="
  echo "  Installation Complete!"
  echo "=========================================="
  echo ""
  echo "Agent ID: $AGENT_ID"
  echo "Config: $CONFIG_DIR/agent.conf"
  echo "Logs: $LOG_DIR/agent.log"
  echo ""
  echo "Commands:"
  echo "  Status: sudo launchctl list | grep kuamini"
  echo "  Stop:   sudo launchctl unload /Library/LaunchDaemons/com.kuamini.threatprotect.plist"
  echo "  Start:  sudo launchctl load /Library/LaunchDaemons/com.kuamini.threatprotect.plist"
  echo "  Logs:   tail -f /var/log/kuamini/agent.log"
  echo ""
else
  echo "Error: Agent service failed to start"
  exit 1
fi
`
}

// Generate Linux installer script
function generateLinuxScript(token: string, baseUrl: string): string {
  return `#!/bin/bash
# KuaminiThreatProtectAgent Installer for Linux
# Copyright (c) Kuamini Systems

set -e

AGENT_NAME="KuaminiThreatProtectAgent"
INSTALL_DIR="/opt/kuamini"
CONFIG_DIR="/etc/kuamini"
LOG_DIR="/var/log/kuamini"
REGISTRATION_TOKEN="${token}"
API_BASE_URL="${baseUrl}/securityAgent/api/agent"

echo "=========================================="
echo "  KuaminiThreatProtectAgent Installer"
echo "  for Linux"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

echo "[1/6] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"

echo "[2/6] Generating agent configuration..."
AGENT_ID=$(cat /proc/sys/kernel/random/uuid)
HOSTNAME=$(hostname)
OS_VERSION=$(cat /etc/os-release | grep VERSION_ID | cut -d'"' -f2)
DISTRO=$(cat /etc/os-release | grep "^ID=" | cut -d'=' -f2 | tr -d '"')

cat > "$CONFIG_DIR/agent.conf" << EOF
# KuaminiThreatProtectAgent Configuration
AGENT_ID=$AGENT_ID
HOSTNAME=$HOSTNAME
OS_TYPE=linux
OS_VERSION=$DISTRO-$OS_VERSION
REGISTRATION_TOKEN=$REGISTRATION_TOKEN
API_BASE_URL=$API_BASE_URL
HEARTBEAT_INTERVAL=60
SCAN_ENABLED=true
REALTIME_PROTECTION=true
EOF

echo "[3/6] Creating agent service script..."
cat > "$INSTALL_DIR/agent.sh" << 'AGENTSCRIPT'
#!/bin/bash
source /etc/kuamini/agent.conf

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> /var/log/kuamini/agent.log
}

register_agent() {
  log "Registering agent with server..."
  IP_ADDR=$(hostname -I | awk '{print $1}')
  RESPONSE=$(curl -s -X POST "$API_BASE_URL/register" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"token\\": \\"$REGISTRATION_TOKEN\\",
      \\"hostname\\": \\"$HOSTNAME\\",
      \\"os_type\\": \\"$OS_TYPE\\",
      \\"os_version\\": \\"$OS_VERSION\\",
        \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\",
      \\"ip_address\\": \\"$IP_ADDR\\"
    }")
  
  if echo "$RESPONSE" | grep -q "endpoint"; then
    log "Registration successful"
    echo "$RESPONSE" > /etc/kuamini/registration.json
    return 0
  else
    log "Registration failed: $RESPONSE"
    return 1
  fi
}

send_heartbeat() {
  CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
  MEM=$(free | grep Mem | awk '{print $3/$2 * 100.0}')
  
  curl -s -X POST "$API_BASE_URL/heartbeat" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"endpoint_id\\": \\"$AGENT_ID\\",
      \\"status\\": \\"online\\",
      \\"cpu_usage\\": $CPU,
      \\"memory_usage\\": $MEM,
        \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\"
    }" > /dev/null 2>&1
}

# Main loop
log "Agent starting..."
register_agent

while true; do
  send_heartbeat
  log "Heartbeat sent"
  sleep $HEARTBEAT_INTERVAL
done
AGENTSCRIPT

chmod +x "$INSTALL_DIR/agent.sh"

echo "[4/6] Creating systemd service..."
cat > /etc/systemd/system/kuamini-agent.service << EOF
[Unit]
Description=KuaminiThreatProtectAgent
After=network.target

[Service]
Type=simple
ExecStart=/bin/bash /opt/kuamini/agent.sh
Restart=always
RestartSec=10
StandardOutput=append:/var/log/kuamini/agent.log
StandardError=append:/var/log/kuamini/agent.error.log

[Install]
WantedBy=multi-user.target
EOF

echo "[5/6] Starting agent service..."
systemctl daemon-reload
systemctl enable kuamini-agent
systemctl start kuamini-agent

echo "[6/6] Verifying installation..."
sleep 2
if systemctl is-active --quiet kuamini-agent; then
  echo ""
  echo "=========================================="
  echo "  Installation Complete!"
  echo "=========================================="
  echo ""
  echo "Agent ID: $AGENT_ID"
  echo "Config: $CONFIG_DIR/agent.conf"
  echo "Logs: $LOG_DIR/agent.log"
  echo ""
  echo "Commands:"
  echo "  Status:  sudo systemctl status kuamini-agent"
  echo "  Stop:    sudo systemctl stop kuamini-agent"
  echo "  Start:   sudo systemctl start kuamini-agent"
  echo "  Logs:    sudo journalctl -u kuamini-agent -f"
  echo ""
else
  echo "Error: Agent service failed to start"
  systemctl status kuamini-agent
  exit 1
fi
`
}

// Generate Windows installer script (PowerShell)
function generateWindowsScript(token: string, baseUrl: string): string {
  return `# KuaminiThreatProtectAgent Installer for Windows
# Copyright (c) Kuamini Systems
# Run this script as Administrator in PowerShell

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$AGENT_NAME = "KuaminiThreatProtectAgent"
$INSTALL_DIR = "C:\\Program Files\\Kuamini\\ThreatProtect"
$CONFIG_DIR = "C:\\ProgramData\\Kuamini"
$LOG_DIR = "C:\\ProgramData\\Kuamini\\Logs"
$REGISTRATION_TOKEN = "${token}"
$API_BASE_URL = "${baseUrl}/securityAgent/api/agent"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  KuaminiThreatProtectAgent Installer" -ForegroundColor Cyan
Write-Host "  for Windows" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/6] Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $CONFIG_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null

Write-Host "[2/6] Generating agent configuration..." -ForegroundColor Yellow
$AGENT_ID = [guid]::NewGuid().ToString()
$HOSTNAME = $env:COMPUTERNAME
$OS_VERSION = (Get-CimInstance Win32_OperatingSystem).Version

$config = @"
# KuaminiThreatProtectAgent Configuration
AGENT_ID=$AGENT_ID
HOSTNAME=$HOSTNAME
OS_TYPE=windows
OS_VERSION=$OS_VERSION
REGISTRATION_TOKEN=$REGISTRATION_TOKEN
API_BASE_URL=$API_BASE_URL
HEARTBEAT_INTERVAL=60
SCAN_ENABLED=true
REALTIME_PROTECTION=true
"@

$config | Out-File -FilePath "$CONFIG_DIR\\agent.conf" -Encoding UTF8

Write-Host "[3/6] Creating agent service script..." -ForegroundColor Yellow
$agentScript = @'
# KuaminiThreatProtectAgent Service Script
$configPath = "C:\\ProgramData\\Kuamini\\agent.conf"
$logPath = "C:\\ProgramData\\Kuamini\\Logs\\agent.log"

# Load configuration
$config = @{}
Get-Content $configPath | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.*)$") {
        $config[$matches[1].Trim()] = $matches[2].Trim()
    }
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $logPath -Append
}

function Register-Agent {
    Write-Log "Registering agent with server..."
  $localIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -and
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*"
    } |
    Sort-Object -Property SkipAsSource |
    Select-Object -First 1 -ExpandProperty IPAddress)

  $macAddress = (Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue |
    Where-Object {
      $_.MACAddress -and
      $_.NetEnabled -eq $true -and
      $_.MACAddress -ne "00:00:00:00:00:00"
    } |
    Select-Object -First 1 -ExpandProperty MACAddress)

  if ($macAddress) {
    $macAddress = $macAddress.ToLower().Replace("-", ":")
  }

  $publicIp = $null
  foreach ($url in @("https://api.ipify.org?format=json", "https://ifconfig.me/ip", "https://checkip.amazonaws.com")) {
    try {
      if ($url -like "*format=json*") {
        $resp = Invoke-RestMethod -Uri $url -TimeoutSec 5
        if ($resp.ip) {
          $publicIp = [string]$resp.ip
          break
        }
      } else {
        $txt = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5).Content
        if ($txt) {
          $publicIp = $txt.Trim()
          break
        }
      }
    } catch {
      # try next provider
    }
  }
    
    $body = @{
        token = $config["REGISTRATION_TOKEN"]
        hostname = $config["HOSTNAME"]
        os_type = $config["OS_TYPE"]
        os_version = $config["OS_VERSION"]
        agent_version = "${INSTALLER_AGENT_VERSION}"
    ip_address = $localIp
    public_ip = $publicIp
    mac_address = $macAddress
    system_info = @{
      local_ip = $localIp
      public_ip = $publicIp
      mac = $macAddress
      mac_address = $macAddress
    }
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$($config["API_BASE_URL"])/register" -Method POST -Body $body -ContentType "application/json"
        Write-Log "Registration successful"
        $response | ConvertTo-Json | Out-File -FilePath "C:\\ProgramData\\Kuamini\\registration.json"
        return $true
    } catch {
        Write-Log "Registration failed: $_"
        return $false
    }
}

function Send-Heartbeat {
    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $mem = (Get-CimInstance Win32_OperatingSystem | ForEach-Object { (($_.TotalVisibleMemorySize - $_.FreePhysicalMemory) / $_.TotalVisibleMemorySize) * 100 })
  $localIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -and
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*"
    } |
    Sort-Object -Property SkipAsSource |
    Select-Object -First 1 -ExpandProperty IPAddress)

  $macAddress = (Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue |
    Where-Object {
      $_.MACAddress -and
      $_.NetEnabled -eq $true -and
      $_.MACAddress -ne "00:00:00:00:00:00"
    } |
    Select-Object -First 1 -ExpandProperty MACAddress)

  if ($macAddress) {
    $macAddress = $macAddress.ToLower().Replace("-", ":")
  }

  $publicIp = $null
  foreach ($url in @("https://api.ipify.org?format=json", "https://ifconfig.me/ip", "https://checkip.amazonaws.com")) {
    try {
      if ($url -like "*format=json*") {
        $resp = Invoke-RestMethod -Uri $url -TimeoutSec 5
        if ($resp.ip) {
          $publicIp = [string]$resp.ip
          break
        }
      } else {
        $txt = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5).Content
        if ($txt) {
          $publicIp = $txt.Trim()
          break
        }
      }
    } catch {
      # try next provider
    }
  }
    
    $body = @{
        endpoint_id = $config["AGENT_ID"]
        status = "online"
        cpu_usage = $cpu
        memory_usage = [math]::Round($mem, 2)
        agent_version = "${INSTALLER_AGENT_VERSION}"
    ip_address = $localIp
    public_ip = $publicIp
    mac_address = $macAddress
    system_info = @{
      os = "windows"
      hostname = $env:COMPUTERNAME
      local_ip = $localIp
      ip = $localIp
      public_ip = $publicIp
      mac = $macAddress
      mac_address = $macAddress
      agent_version = "${INSTALLER_AGENT_VERSION}"
    }
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$($config["API_BASE_URL"])/heartbeat" -Method POST -Body $body -ContentType "application/json" | Out-Null
    } catch {
        Write-Log "Heartbeat failed: $_"
    }
}

# Main
Write-Log "Agent starting..."
Register-Agent

while ($true) {
    Send-Heartbeat
    Write-Log "Heartbeat sent"
    Start-Sleep -Seconds $config["HEARTBEAT_INTERVAL"]
}
'@

$agentScript | Out-File -FilePath "$INSTALL_DIR\\agent.ps1" -Encoding UTF8

Write-Host "[4/6] Creating Windows Service..." -ForegroundColor Yellow
# Create a wrapper script for NSSM or use Task Scheduler
$taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$INSTALL_DIR\\agent.ps1\`""
$taskTrigger = New-ScheduledTaskTrigger -AtStartup
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "KuaminiThreatProtectAgent" -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Principal $taskPrincipal -Force | Out-Null

Write-Host "[5/6] Starting agent..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName "KuaminiThreatProtectAgent"

Write-Host "[6/6] Verifying installation..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$task = Get-ScheduledTask -TaskName "KuaminiThreatProtectAgent"
if ($task.State -eq "Running") {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  Installation Complete!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Agent ID: $AGENT_ID" -ForegroundColor White
    Write-Host "Config: $CONFIG_DIR\\agent.conf" -ForegroundColor White
    Write-Host "Logs: $LOG_DIR\\agent.log" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  Status: Get-ScheduledTask -TaskName KuaminiThreatProtectAgent" -ForegroundColor Gray
    Write-Host "  Stop:   Stop-ScheduledTask -TaskName KuaminiThreatProtectAgent" -ForegroundColor Gray
    Write-Host "  Start:  Start-ScheduledTask -TaskName KuaminiThreatProtectAgent" -ForegroundColor Gray
    Write-Host "  Logs:   Get-Content $LOG_DIR\\agent.log -Tail 50" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "Error: Agent failed to start" -ForegroundColor Red
    exit 1
}
`
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ os: string }> }) {
  const { os } = await params
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Registration token is required" }, { status: 400 })
  }

  // Validate token
  try {
    const tokenData = JSON.parse(Buffer.from(token, "base64").toString("utf-8"))
    if (!tokenData.accountId) {
      throw new Error("Invalid token")
    }
  } catch {
    return NextResponse.json({ error: "Invalid registration token" }, { status: 400 })
  }

  const baseUrl = getBaseUrl(request)

  let script: string
  let filename: string
  let contentType: string

  switch (os) {
    case "windows":
      script = generateWindowsScript(token, baseUrl)
      filename = "Install-KuaminiThreatProtectAgent.ps1"
      contentType = "text/plain; charset=utf-8"
      break
    case "macos":
      script = generateMacOSScript(token, baseUrl)
      filename = "install-kuamini-agent.sh"
      contentType = "text/plain; charset=utf-8"
      break
    case "linux-deb":
    case "linux-rpm":
      script = generateLinuxScript(token, baseUrl)
      filename = "install-kuamini-agent.sh"
      contentType = "text/plain; charset=utf-8"
      break
    default:
      return NextResponse.json({ error: "Invalid OS type" }, { status: 400 })
  }

  // Return the script as a downloadable file
  return new NextResponse(script, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
