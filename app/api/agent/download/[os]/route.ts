import { type NextRequest, NextResponse } from "next/server"

const INSTALLER_AGENT_VERSION = process.env.AGENT_VERSION ?? "1.0.6"

export async function GET(request: NextRequest, { params }: { params: Promise<{ os: string }> }) {
  const { os } = await params
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  // Decode token to get account info
  let accountId: string
  let accountName: string
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"))
    accountId = decoded.accountId
    accountName = decoded.accountName || "Unknown"
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  // Get the base URL for API calls
  const baseUrl = request.nextUrl.origin

  let script: string
  let filename: string
  let contentType: string

  switch (os.toLowerCase()) {
    case "macos":
      filename = "install-kuamini-agent.sh"
      contentType = "application/x-sh"
      script = generateMacOSScript(accountId, accountName, token, baseUrl)
      break
    case "linux":
      filename = "install-kuamini-agent.sh"
      contentType = "application/x-sh"
      script = generateLinuxScript(accountId, accountName, token, baseUrl)
      break
    case "windows":
      filename = "install-kuamini-agent.ps1"
      contentType = "application/octet-stream"
      script = generateWindowsScript(accountId, accountName, token, baseUrl)
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

function generateMacOSScript(accountId: string, accountName: string, token: string, baseUrl: string): string {
  const trayUrl = `${baseUrl}/tray/macos.zip`
  return `#!/bin/bash
# KuaminiThreatProtectAgent Installer for macOS
# Generated for account: ${accountName}
# Account ID: ${accountId}

set -e

INSTALL_DIR="/usr/local/kuamini"
CONFIG_DIR="/etc/kuamini"
LOG_DIR="/var/log/kuamini"
AGENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
API_BASE="${baseUrl}/api/agent"
REGISTRATION_TOKEN="${token}"
TRAY_URL="${trayUrl}"

echo "=========================================="
echo "KuaminiThreatProtectAgent Installer"
echo "Account: ${accountName}"
echo "=========================================="

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "[1/6] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"

echo "[2/6] Creating configuration..."
cat > "$CONFIG_DIR/agent.conf" << EOF
AGENT_ID=$AGENT_ID
ACCOUNT_ID=${accountId}
API_BASE=$API_BASE
REGISTRATION_TOKEN=$REGISTRATION_TOKEN
HEARTBEAT_INTERVAL=60
EOF

echo "[3/6] Creating agent script..."
cat > "$INSTALL_DIR/kuamini-agent.sh" << 'AGENT_SCRIPT'
#!/bin/bash
source /etc/kuamini/agent.conf

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> /var/log/kuamini/agent.log
}

send_heartbeat() {
    curl -s -X POST "$API_BASE/heartbeat" \\
        -H "Content-Type: application/json" \\
  -d "{\\"agent_id\\": \\"$AGENT_ID\\", \\"account_id\\": \\"$ACCOUNT_ID\\", \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\", \\"status\\": \\"online\\", \\"system_info\\": {\\"os\\": \\"$(uname -s)\\", \\"hostname\\": \\"$(hostname)\\", \\"kernel\\": \\"$(uname -r)\\", \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\"}}" \\
        >> /var/log/kuamini/agent.log 2>&1
}

register_agent() {
    HOSTNAME=$(hostname)
    OS_VERSION=$(sw_vers -productVersion 2>/dev/null || uname -r)
    
    curl -s -X POST "$API_BASE/register" \\
        -H "Content-Type: application/json" \\
        -d "{\\"token\\": \\"$REGISTRATION_TOKEN\\", \\"hostname\\": \\"$HOSTNAME\\", \\"os\\": \\"macos\\", \\"os_version\\": \\"$OS_VERSION\\", \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\", \\"agent_id\\": \\"$AGENT_ID\\"}" \\
        >> /var/log/kuamini/agent.log 2>&1
}

log "Agent starting..."
register_agent
log "Agent registered with ID: $AGENT_ID"

while true; do
    send_heartbeat
    log "Heartbeat sent"
    sleep $HEARTBEAT_INTERVAL
done
AGENT_SCRIPT

chmod +x "$INSTALL_DIR/kuamini-agent.sh"

echo "[4/6] Creating LaunchDaemon..."
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

echo "[5/6] Registering agent with console..."
HOSTNAME=$(hostname)
OS_VERSION=$(sw_vers -productVersion 2>/dev/null || uname -r)

curl -s -X POST "$API_BASE/register" \\
    -H "Content-Type: application/json" \\
    -d "{\\"token\\": \\"$REGISTRATION_TOKEN\\", \\"hostname\\": \\"$HOSTNAME\\", \\"os\\": \\"macos\\", \\"os_version\\": \\"$OS_VERSION\\", \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\", \\"agent_id\\": \\"$AGENT_ID\\"}"

echo ""
echo "[6/6] Starting agent service..."
launchctl load /Library/LaunchDaemons/com.kuamini.agent.plist

echo "[Optional] Installing tray (system menu icon)..."
mkdir -p "$INSTALL_DIR/tray"
if command -v unzip >/dev/null 2>&1; then
  if curl -fSL "$TRAY_URL" -o "$INSTALL_DIR/tray/tray.zip"; then
    unzip -o "$INSTALL_DIR/tray/tray.zip" -d "$INSTALL_DIR/tray" >/dev/null 2>&1 || true
    chmod +x "$INSTALL_DIR/tray"/*.app/Contents/MacOS/* 2>/dev/null || true
    cat > /Library/LaunchAgents/com.kuamini.agenttray.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.kuamini.agenttray</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/tray/KuaminiAgentTray.app/Contents/MacOS/KuaminiAgentTray</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
    launchctl load /Library/LaunchAgents/com.kuamini.agenttray.plist 2>/dev/null || true
    echo "Tray installed and loaded."
  else
    echo "Tray bundle not found at $TRAY_URL (skipping)."
  fi
else
  echo "unzip not available; skipping tray install."
fi

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "Agent ID: $AGENT_ID"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  View logs: tail -f /var/log/kuamini/agent.log"
echo "  Stop agent: sudo launchctl unload /Library/LaunchDaemons/com.kuamini.agent.plist"
echo "  Start agent: sudo launchctl load /Library/LaunchDaemons/com.kuamini.agent.plist"
echo "  Uninstall: sudo rm -rf /usr/local/kuamini /etc/kuamini /var/log/kuamini /Library/LaunchDaemons/com.kuamini.agent.plist"
`
}

function generateLinuxScript(accountId: string, accountName: string, token: string, baseUrl: string): string {
  const trayUrl = `${baseUrl}/tray/linux.zip`
  return `#!/bin/bash
# KuaminiThreatProtectAgent Installer for Linux
# Generated for account: ${accountName}
# Account ID: ${accountId}

set -e

INSTALL_DIR="/opt/kuamini"
CONFIG_DIR="/etc/kuamini"
LOG_DIR="/var/log/kuamini"
AGENT_ID=$(cat /proc/sys/kernel/random/uuid)
API_BASE="${baseUrl}/api/agent"
REGISTRATION_TOKEN="${token}"
TRAY_URL="${trayUrl}"

echo "=========================================="
echo "KuaminiThreatProtectAgent Installer"
echo "Account: ${accountName}"
echo "=========================================="

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "[1/6] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"

echo "[2/6] Creating configuration..."
cat > "$CONFIG_DIR/agent.conf" << EOF
AGENT_ID=$AGENT_ID
ACCOUNT_ID=${accountId}
API_BASE=$API_BASE
REGISTRATION_TOKEN=$REGISTRATION_TOKEN
HEARTBEAT_INTERVAL=60
EOF

echo "[3/6] Creating agent script..."
cat > "$INSTALL_DIR/kuamini-agent.sh" << 'AGENT_SCRIPT'
#!/bin/bash
source /etc/kuamini/agent.conf

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> /var/log/kuamini/agent.log
}

send_heartbeat() {
    curl -s -X POST "$API_BASE/heartbeat" \\
        -H "Content-Type: application/json" \\
  -d "{\\"agent_id\\": \\"$AGENT_ID\\", \\"account_id\\": \\"$ACCOUNT_ID\\", \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\", \\"status\\": \\"online\\", \\"system_info\\": {\\"os\\": \\"linux\\", \\"hostname\\": \\"$(hostname)\\", \\"kernel\\": \\"$(uname -r)\\", \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\"}}" \\
        >> /var/log/kuamini/agent.log 2>&1
}

register_agent() {
    HOSTNAME=$(hostname)
    OS_VERSION=$(cat /etc/os-release | grep VERSION_ID | cut -d'"' -f2)
    
    curl -s -X POST "$API_BASE/register" \\
        -H "Content-Type: application/json" \\
        -d "{\\"token\\": \\"$REGISTRATION_TOKEN\\", \\"hostname\\": \\"$HOSTNAME\\", \\"os\\": \\"linux\\", \\"os_version\\": \\"$OS_VERSION\\", \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\", \\"agent_id\\": \\"$AGENT_ID\\"}" \\
        >> /var/log/kuamini/agent.log 2>&1
}

log "Agent starting..."
register_agent
log "Agent registered with ID: $AGENT_ID"

while true; do
    send_heartbeat
    log "Heartbeat sent"
    sleep $HEARTBEAT_INTERVAL
done
AGENT_SCRIPT

chmod +x "$INSTALL_DIR/kuamini-agent.sh"

echo "[4/6] Creating systemd service..."
cat > /etc/systemd/system/kuamini-agent.service << EOF
[Unit]
Description=KuaminiThreatProtectAgent
After=network.target

[Service]
Type=simple
ExecStart=/bin/bash /opt/kuamini/kuamini-agent.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "[5/6] Registering agent with console..."
HOSTNAME=$(hostname)
OS_VERSION=$(cat /etc/os-release | grep VERSION_ID | cut -d'"' -f2 2>/dev/null || uname -r)

curl -s -X POST "$API_BASE/register" \\
    -H "Content-Type: application/json" \\
    -d "{\\"token\\": \\"$REGISTRATION_TOKEN\\", \\"hostname\\": \\"$HOSTNAME\\", \\"os\\": \\"linux\\", \\"os_version\\": \\"$OS_VERSION\\", \\"agent_version\\": \\"${INSTALLER_AGENT_VERSION}\\", \\"agent_id\\": \\"$AGENT_ID\\"}"

echo ""
echo "[6/6] Starting agent service..."
systemctl daemon-reload
systemctl enable kuamini-agent
systemctl start kuamini-agent

echo "[Optional] Installing tray (system tray icon)..."
mkdir -p "$INSTALL_DIR/tray"
if command -v unzip >/dev/null 2>&1; then
  if curl -fSL "$TRAY_URL" -o "$INSTALL_DIR/tray/tray.zip"; then
    unzip -o "$INSTALL_DIR/tray/tray.zip" -d "$INSTALL_DIR/tray" >/dev/null 2>&1 || true
    chmod +x "$INSTALL_DIR/tray"/* 2>/dev/null || true
    # Autostart entry
    cat > /etc/xdg/autostart/kuamini-agent-tray.desktop << EOF
[Desktop Entry]
Type=Application
Name=Kuamini Agent Tray
Exec=$INSTALL_DIR/tray/kuamini-agent-tray
X-GNOME-Autostart-enabled=true
EOF
    echo "Tray installed; will start on user login."
  else
    echo "Tray bundle not found at $TRAY_URL (skipping)."
  fi
else
  echo "unzip not available; skipping tray install."
fi

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "Agent ID: $AGENT_ID"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  View logs: tail -f /var/log/kuamini/agent.log"
echo "  Service status: systemctl status kuamini-agent"
echo "  Stop agent: systemctl stop kuamini-agent"
echo "  Start agent: systemctl start kuamini-agent"
echo "  Uninstall: systemctl stop kuamini-agent && systemctl disable kuamini-agent && rm -rf /opt/kuamini /etc/kuamini /var/log/kuamini /etc/systemd/system/kuamini-agent.service"
`
}

function generateWindowsScript(accountId: string, accountName: string, token: string, baseUrl: string): string {
  const trayUrl = `${baseUrl}/tray/windows.zip`
  return `# KuaminiThreatProtectAgent Installer for Windows
# Generated for account: ${accountName}
# Account ID: ${accountId}

$ErrorActionPreference = "Stop"

$INSTALL_DIR = "C:\\Program Files\\Kuamini"
$CONFIG_DIR = "C:\\ProgramData\\Kuamini"
$LOG_DIR = "C:\\ProgramData\\Kuamini\\Logs"
$AGENT_ID = [guid]::NewGuid().ToString()
$API_BASE = "${baseUrl}/api/agent"
$REGISTRATION_TOKEN = "${token}"
$TRAY_URL = "${trayUrl}"

Write-Host "=========================================="
Write-Host "KuaminiThreatProtectAgent Installer"
Write-Host "Account: ${accountName}"
Write-Host "=========================================="

# Check for admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Please run as Administrator"
    exit 1
}

Write-Host "[1/6] Creating directories..."
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $CONFIG_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null

Write-Host "[2/6] Creating configuration..."
@"
AGENT_ID=$AGENT_ID
ACCOUNT_ID=${accountId}
API_BASE=$API_BASE
REGISTRATION_TOKEN=$REGISTRATION_TOKEN
HEARTBEAT_INTERVAL=60
"@ | Out-File -FilePath "$CONFIG_DIR\\agent.conf" -Encoding UTF8

Write-Host "[3/6] Creating agent script..."
@'
$config = Get-Content "C:\\ProgramData\\Kuamini\\agent.conf" | ConvertFrom-StringData

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath "C:\\ProgramData\\Kuamini\\Logs\\agent.log" -Append
}

function Send-Heartbeat {
    $body = @{
        agent_id = $config.AGENT_ID
        account_id = $config.ACCOUNT_ID
    agent_version = "${INSTALLER_AGENT_VERSION}"
        status = "online"
        system_info = @{
            os = "windows"
            hostname = $env:COMPUTERNAME
            kernel = [System.Environment]::OSVersion.Version.ToString()
      agent_version = "${INSTALLER_AGENT_VERSION}"
        }
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$($config.API_BASE)/heartbeat" -Method Post -Body $body -ContentType "application/json"
    } catch {
        Write-Log "Heartbeat failed: $_"
    }
}

Write-Log "Agent starting..."

while ($true) {
    Send-Heartbeat
    Write-Log "Heartbeat sent"
    Start-Sleep -Seconds $config.HEARTBEAT_INTERVAL
}
'@ | Out-File -FilePath "$INSTALL_DIR\\kuamini-agent.ps1" -Encoding UTF8

Write-Host "[4/6] Creating scheduled task..."
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File \`"$INSTALL_DIR\\kuamini-agent.ps1\`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "KuaminiThreatProtectAgent" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "[5/6] Registering agent with console..."
$body = @{
    token = $REGISTRATION_TOKEN
    hostname = $env:COMPUTERNAME
    os = "windows"
    os_version = [System.Environment]::OSVersion.Version.ToString()
    agent_version = "${INSTALLER_AGENT_VERSION}"
    agent_id = $AGENT_ID
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$API_BASE/register" -Method Post -Body $body -ContentType "application/json"
} catch {
    Write-Host "Warning: Initial registration failed, will retry on agent start"
}

Write-Host "[6/6] Starting agent..."
Start-ScheduledTask -TaskName "KuaminiThreatProtectAgent"

Write-Host "[Optional] Installing tray (system tray icon)..."
$trayDir = "$INSTALL_DIR\\tray"
New-Item -ItemType Directory -Force -Path $trayDir | Out-Null
try {
  Invoke-WebRequest -Uri $TRAY_URL -OutFile "$trayDir\\tray.zip" -UseBasicParsing -ErrorAction Stop
  Expand-Archive -Path "$trayDir\\tray.zip" -DestinationPath $trayDir -Force
  $trayExe = Get-ChildItem -Path $trayDir -Filter "*.exe" -Recurse | Select-Object -First 1
  if ($trayExe) {
    $actionTray = New-ScheduledTaskAction -Execute $trayExe.FullName
    $triggerTray = New-ScheduledTaskTrigger -AtLogOn
    $principalTray = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName "KuaminiAgentTray" -Action $actionTray -Trigger $triggerTray -Principal $principalTray -Force | Out-Null
    Write-Host "Tray installed and scheduled."
  } else {
    Write-Host "Tray executable not found in archive; skipping."
  }
} catch {
  Write-Host "Tray bundle not found at $TRAY_URL (skipping)."
}

Write-Host ""
Write-Host "=========================================="
Write-Host "Installation Complete!"
Write-Host "Agent ID: $AGENT_ID"
Write-Host "=========================================="
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  View logs: Get-Content C:\\ProgramData\\Kuamini\\Logs\\agent.log -Tail 50"
Write-Host "  Stop agent: Stop-ScheduledTask -TaskName 'KuaminiThreatProtectAgent'"
Write-Host "  Start agent: Start-ScheduledTask -TaskName 'KuaminiThreatProtectAgent'"
Write-Host "  Uninstall: Unregister-ScheduledTask -TaskName 'KuaminiThreatProtectAgent' -Confirm:\\$false; Remove-Item -Recurse -Force 'C:\\Program Files\\Kuamini', 'C:\\ProgramData\\Kuamini'"
`
}
