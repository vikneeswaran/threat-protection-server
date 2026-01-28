# Kuamini Security Client - Installer Guide

## Overview

The Kuamini Security Client installer creates a Windows agent that:
- ✅ Installs as a system tray application
- ✅ Auto-starts on Windows boot
- ✅ Automatically registers with the console
- ✅ Sends heartbeats to maintain online status
- ✅ Creates desktop and start menu shortcuts

## Building the Installer

### Prerequisites

1. **Python 3.9+** installed and in PATH
2. **(Optional) NSIS** - For creating .exe installer
   - Download from: https://nsis.sourceforge.io/Download
   - Without NSIS, a portable ZIP will be created instead

### Quick Build

```powershell
# From project root
npm run build:installer

# Or directly with PowerShell
cd agent-tray\build
.\create-installer.ps1
```

### Build with Registration Token

```powershell
# Pre-configure the agent with a registration token
.\create-installer.ps1 -RegistrationToken "your-base64-token"

# Or from project root
npm run build:agent:token -- -RegistrationToken "your-base64-token"
```

### Build Options

```powershell
.\create-installer.ps1 `
    -RegistrationToken "token" `
    -ApiBase "https://yourdomain.com/api/agent" `
    -ConsoleUrl "https://yourdomain.com/console" `
    -Version "1.0.0"
```

## What Gets Built

### With NSIS Installed
**Output:** `public/tray/KuaminiSecurityClient-installer.exe`

Features:
- Full Windows installer (.exe)
- Installs to `C:\Program Files\Kuamini Security Client`
- Adds to Windows registry (Add/Remove Programs)
- Creates autostart registry entry
- Creates desktop and start menu shortcuts
- Launches agent immediately after install

### Without NSIS
**Output:** `public/tray/KuaminiSecurityClient-portable.zip`

Features:
- Portable ZIP package
- Extract and run anywhere
- Manual startup configuration needed

## Installation

### End-User Installation (With NSIS Installer)

1. **Download** `KuaminiSecurityClient-installer.exe`

2. **Run installer** as Administrator

3. **Follow prompts**
   - Choose installation directory (default: `C:\Program Files\Kuamini Security Client`)
   - Installer completes and launches agent automatically

4. **Verify Installation**
   - System tray icon appears (Kuamini logo)
   - Agent auto-registers with console (if token configured)
   - Check status: Right-click tray icon → View status

### Manual Installation (Portable ZIP)

1. **Extract** `KuaminiSecurityClient-portable.zip` to desired location
   - Example: `C:\Program Files\Kuamini Security Client`

2. **Run** `KuaminiSecurityClient.exe`
   - System tray icon should appear
   - Agent will auto-register if `config.json` has token

3. **(Optional) Configure Autostart**
   - Press `Win + R`
   - Type: `shell:startup`
   - Create shortcut to `KuaminiSecurityClient.exe` in startup folder

## Configuration

### config.json

Located in installation directory or `%USERPROFILE%\.kuamini\config.json`

```json
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "agent_id": "auto-generated-uuid",
  "registration_token": "optional-base64-token",
  "account_id": "derived-from-token",
  "heartbeat_interval": 60,
  "auto_register": true
}
```

### Configuration Priority

1. `~/.kuamini/config.json` (user directory)
2. `<install-dir>/config.json` (bundled config)
3. Environment variables
4. Defaults

## Using the Agent

### System Tray Menu

Right-click the tray icon to access:

- **Agent: [ID]** - Shows agent ID
- **Status: [Status]** - Current connection status
- **Account: [ID]** - Account ID (if registered)
- **Register now** - Manually trigger registration
- **Send heartbeat** - Manually send heartbeat
- **Open console** - Opens web console in browser
- **Quit** - Exits the agent

### Auto-Registration

If `registration_token` is configured, the agent will:

1. **On first launch:** Register with the console
2. **Every heartbeat:** Maintain connection (default: every 60 seconds)
3. **On 404 error:** Attempt re-registration automatically

### Logs

Logs are stored at:
`%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`

View logs:
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 50
```

## Troubleshooting

### Tray Icon Not Appearing

**Solution 1:** Check Windows notification settings
- Settings → System → Notifications
- Ensure "Kuamini Security Client" is allowed

**Solution 2:** Check if process is running
```powershell
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
```

**Solution 3:** Check logs
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
```

### Registration Failed

**Symptoms:** Agent shows "Registration failed" status

**Causes:**
- Invalid or missing registration token
- Network connectivity issues
- API endpoint unreachable

**Solutions:**

1. **Verify token:**
```powershell
# Edit config.json
notepad "$env:USERPROFILE\.kuamini\config.json"
# Add or update: "registration_token": "your-token"
```

2. **Check connectivity:**
```powershell
Test-NetConnection -ComputerName kuaminisystems.com -Port 443
```

3. **Manually register:**
- Right-click tray icon → "Register now"
- Check logs for error details

### Heartbeat Failed

**Symptoms:** Agent shows "Heartbeat failed" or "Offline" status

**Causes:**
- Agent not registered yet
- Network interruption
- API endpoint down

**Solutions:**

1. **Verify registration:**
```powershell
# Check config has endpoint_id
Get-Content "$env:USERPROFILE\.kuamini\config.json"
```

2. **Force re-registration:**
- Right-click tray icon → "Register now"

3. **Manual heartbeat:**
- Right-click tray icon → "Send heartbeat"

### Agent Not Starting on Boot

**Solution 1:** Check registry entry
```powershell
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient"
```

**Solution 2:** Manually add startup entry
```powershell
$path = "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"
Set-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient" -Value $path
```

**Solution 3:** Use Task Scheduler
```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "KuaminiSecurityClient" -Action $action -Trigger $trigger -RunLevel Highest
```

## Uninstallation

### Using Windows Installer

1. **Control Panel** → Programs → Programs and Features
2. Find "Kuamini Security Client"
3. Click "Uninstall"
4. Follow prompts

### Using PowerShell Uninstaller

```powershell
# Run as Administrator
cd C:\Users\YOUR_USERNAME\Documents\Projects\threat-protection-agent\uninstallers
.\uninstall-kuamini-windows.ps1
```

### Manual Uninstallation

1. **Kill process:**
```powershell
Stop-Process -Name "KuaminiSecurityClient" -Force
```

2. **Remove from startup:**
```powershell
Remove-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient"
```

3. **Delete files:**
```powershell
Remove-Item "C:\Program Files\Kuamini Security Client" -Recurse -Force
Remove-Item "$env:USERPROFILE\.kuamini" -Recurse -Force
Remove-Item "$env:LOCALAPPDATA\KuaminiSecurityClient" -Recurse -Force
```

4. **Remove shortcuts:**
```powershell
Remove-Item "$env:PUBLIC\Desktop\Kuamini Security Client.lnk" -Force
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Kuamini Security Client" -Recurse -Force
```

## Development

### Build Process Overview

```
1. Python dependencies installed (PyInstaller, pystray, psutil, PIL, requests)
2. config.json generated with agent_id and registration_token
3. PyInstaller builds executable from main.py
4. config.json bundled with executable
5. NSIS creates installer with autostart configuration
6. Installer output to public/tray/
```

### Customization

**Change API Endpoint:**
```powershell
.\create-installer.ps1 -ApiBase "https://your-api.com/agent"
```

**Change Console URL:**
```powershell
.\create-installer.ps1 -ConsoleUrl "https://your-console.com"
```

**Change Installation Path:**
Edit `installer.nsi` line:
```nsis
InstallDir "$PROGRAMFILES\Your Company\Your Product"
```

### Testing

**Test without installing:**
```powershell
cd agent-tray\dist\KuaminiSecurityClient
.\KuaminiSecurityClient.exe
```

**Test auto-registration:**
```powershell
# Set token via environment
$env:REGISTRATION_TOKEN = "your-token"
.\KuaminiSecurityClient.exe
```

**Test configuration:**
```powershell
# Create test config
@{
    api_base = "http://localhost:3000/api/agent"
    auto_register = $true
    registration_token = "test-token"
} | ConvertTo-Json | Out-File "config.json" -Encoding UTF8
.\KuaminiSecurityClient.exe
```

## Distribution

### For End Users

**Recommended:** Distribute the installer `.exe`
- Simplest installation experience
- Handles all configuration automatically
- Creates proper Windows integration

**Alternative:** Distribute portable ZIP
- For users without admin rights
- For testing/evaluation
- Manual configuration required

### Pre-configured Installers

Build installer with embedded registration token:

```powershell
# Create installer for specific account
.\create-installer.ps1 -RegistrationToken "account-specific-token"

# Result: Installer that auto-registers to specific account
# Distribute to end user → They install → Agent auto-registers
```

## Security Notes

- **Registration tokens** are sensitive - treat like passwords
- **config.json** contains agent credentials - protect accordingly
- **HTTPS only** - API communication uses TLS/SSL
- **Admin rights** required for installation to Program Files
- **Logs** may contain sensitive data - review before sharing

## Support

**Logs Location:** `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`

**Config Location:** `%USERPROFILE%\.kuamini\config.json`

**Installation Directory:** `C:\Program Files\Kuamini Security Client\`

**Registry Keys:**
- Autostart: `HKLM:\Software\Microsoft\Windows\CurrentVersion\Run`
- Uninstall: `HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\KuaminiSecurityClient`

**Process Name:** `KuaminiSecurityClient.exe`

When reporting issues, include:
1. Log file contents
2. Windows version
3. Installation method (installer vs portable)
4. Error messages
5. Steps to reproduce
