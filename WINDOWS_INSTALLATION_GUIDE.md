# Windows Installation & Deployment Guide

**Last Updated**: February 8, 2026  
**Status**: ✅ Production Ready  
**Version**: 2.1

---

## Table of Contents

1. [Overview](#overview)
2. [Installation Methods](#installation-methods)
3. [Prerequisites](#prerequisites)
4. [Installation Steps](#installation-steps)
5. [Configuration](#configuration)
6. [Verification](#verification)
7. [Uninstallation](#uninstallation)
8. [Building from Source](#building-from-source)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Kuamini Security Client for Windows provides enterprise-grade endpoint protection with centralized management. This guide covers complete installation, configuration, and deployment procedures for Windows environments.

### Key Features
- **MSI-based Installation**: Professional Windows installer package
- **Auto-registration**: Automatic endpoint registration with management console
- **System Tray Integration**: Visual status indicator and quick access menu
- **Auto-start**: Runs automatically on system boot
- **Silent Installation**: Supports unattended deployment
- **Robust Cleanup**: Complete uninstallation with registry cleanup

### System Requirements
- **OS**: Windows 10 (64-bit) or later, Windows Server 2016+
- **Privileges**: Administrator rights required for installation
- **Network**: HTTPS access to kuaminisystems.com
- **Disk Space**: ~50 MB minimum
- **Memory**: 100 MB RAM minimum

---

## Installation Methods

### Method 1: One-Line PowerShell (Recommended)

**Best for**: Quick deployment, console UI workflows

```powershell
# Copy and paste in PowerShell (as Administrator)
# Replace YOUR_TOKEN with your registration token from console

powershell -NoProfile -ExecutionPolicy Bypass -Command "iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1'); Main -Token 'YOUR_TOKEN'"
```

### Method 2: Download MSI from Console (Recommended for Multiple Installs)

**Best for**: Distributing to multiple endpoints, offline installation

1. Log into https://kuaminisystems.com/securityAgent
2. Navigate to **Installers** → **Windows**
3. Click **"Download Installer"** button
4. Save the MSI file: `KuaminiSecurityClient-<accountId>.msi`
5. Run MSI on target endpoint:
   ```cmd
   msiexec /i KuaminiSecurityClient-<accountId>.msi /quiet /norestart
   ```
6. Agent starts automatically and registers with console

### Method 3: Batch File + PowerShell Script

**Best for**: Custom deployment workflows, GPO deployment

1. Download both files from installer page:
   - `install-kuamini.bat`
   - `install-kuamini-windows-cli.ps1`
2. Place both in same folder
3. Run as Administrator:
   ```cmd
   install-kuamini.bat "YOUR_TOKEN"
   ```

### Method 4: Direct MSI Installation (Manual Configuration)

**Best for**: Advanced users, custom setup

```powershell
# Download MSI
$msiPath = "C:\temp\KuaminiSecurityClient-1.0.5.msi"

# Install MSI silently
msiexec.exe /i $msiPath /quiet /norestart

# Manually create registration token file
$token = "YOUR_TOKEN"
$installPath = "C:\Program Files (x86)\Kuamini Security Client"
Set-Content -Path "$installPath\registration.token" -Value $token -Encoding UTF8

# Start agent
Start-Process "$installPath\KuaminiSecurityClient.exe"
```

---

## Prerequisites

### 1. Administrator Privileges
Installation requires administrator rights. Right-click PowerShell or Command Prompt and select **"Run as Administrator"**.

### 2. Network Access
Ensure firewall allows HTTPS connections to:
- `kuaminisystems.com` (port 443)
- Agent API endpoints: `/api/agent/*`

### 3. Registration Token
Obtain registration token from console:
1. Log into https://kuaminisystems.com/securityAgent
2. Go to **Installers** section
3. Copy the registration token

### 4. Execution Policy (for PowerShell)
Temporarily bypass execution policy during installation:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
```

---

## Installation Steps

### Complete Installation Flow

```
1. User obtains registration token from console
2. User runs installer script with token parameter
3. Script validates token and checks prerequisites
4. Script downloads MSI from API endpoint
5. Script creates config.json in %LOCALAPPDATA%
6. Script runs MSI installation
7. Script writes registration.token to install directory
8. Agent starts automatically and reads token file
9. Agent registers with console using token
10. Console shows endpoint as "Online" within 60 seconds
```

### Step-by-Step Instructions

#### Step 1: Prepare Environment
```powershell
# Open PowerShell as Administrator
# Create temp directory
New-Item -Path "C:\temp" -ItemType Directory -Force

# Verify network connectivity
Test-NetConnection kuaminisystems.com -Port 443
```

#### Step 2: Download Installer Script
```powershell
# Download installer script
Invoke-WebRequest -Uri "https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1" `
  -OutFile "C:\temp\install-kuamini-windows-cli.ps1"
```

#### Step 3: Run Installer
```powershell
# Set token variable (replace with your actual token)
$token = "eyJ...your-token-here...QI="

# Run installer
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
& "C:\temp\install-kuamini-windows-cli.ps1" -Token $token
```

#### Step 4: Wait for Registration
```
Installer output will show:
✓ Token validated
✓ MSI downloaded
✓ Configuration created
✓ Agent installed
✓ Registration successful
✓ Endpoint online in console
```

---

## Configuration

### File Locations

| Component | Path | Purpose |
|-----------|------|---------|
| **Executable** | `C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe` | Main agent executable |
| **Configuration** | `%LOCALAPPDATA%\KuaminiSecurityClient\config.json` | Runtime configuration |
| **Logs** | `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log` | Agent activity logs |
| **Token File** | `C:\Program Files (x86)\...\registration.token` | Registration token (consumed on first run) |
| **Autostart Registry** | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` | Windows autostart entry |

### Configuration File Format

**Location**: `%LOCALAPPDATA%\KuaminiSecurityClient\config.json`

```json
{
  "registration_token": "eyJ...token...QI=",
  "agent_id": "uuid-generated-on-first-run",
  "api_base_url": "https://kuaminisystems.com/api/agent",
  "heartbeat_interval": 60,
  "scan_interval": 3600,
  "enable_auto_start": true,
  "log_level": "INFO"
}
```

### Token Handling

The installer manages tokens in three locations:

1. **config.json** - JSON configuration in `%LOCALAPPDATA%\KuaminiSecurityClient\`
2. **registration.token** - Plain text file in installation directory (consumed on first run)
3. **Agent Memory** - Loaded on startup for API authentication

### Modifying Configuration

```powershell
# Edit configuration
$configPath = "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
$config = Get-Content $configPath | ConvertFrom-Json
$config.heartbeat_interval = 120  # Change to 2 minutes
$config | ConvertTo-Json | Set-Content $configPath

# Restart agent to apply changes
Stop-Process -Name "KuaminiSecurityClient" -Force
Start-Process "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
```

---

## Verification

### Verify Installation

#### 1. Check Process
```powershell
# Check if agent process is running
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
```

#### 2. Check Installation Directory
```powershell
# Verify files exist
Test-Path "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
Test-Path "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
```

#### 3. Check System Tray Icon
Look for Kuamini icon in Windows system tray (bottom-right corner):
- **Green**: Online and connected
- **Red**: Disconnected or error
- **Yellow**: Connecting/updating

#### 4. Check Logs
```powershell
# View recent log entries
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 20
```

Look for:
```
[INFO] Agent started successfully
[INFO] Registration successful (endpoint_id: xxx)
[INFO] Heartbeat sent successfully
```

#### 5. Check Console Dashboard
1. Log into https://kuaminisystems.com/securityAgent
2. Navigate to **Endpoints**
3. Verify endpoint shows:
   - **Status**: Online (green)
   - **Hostname**: Correct computer name
   - **OS**: Windows (with version)
   - **Last Seen**: Within last 2 minutes

### Verify Auto-start

```powershell
# Check registry entry
Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient"

# Restart computer and verify agent starts automatically
Restart-Computer -Force
```

---

## Uninstallation

### Method 1: Automated Uninstaller (Recommended)

```powershell
# Download and run uninstaller
Invoke-WebRequest -Uri "https://kuaminisystems.com/api/agent/uninstallers/windows" `
  -OutFile "C:\temp\uninstall-kuamini.ps1"

Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
& "C:\temp\uninstall-kuamini.ps1" -Force
```

### Method 2: Windows Add/Remove Programs

1. Open **Settings** → **Apps** → **Apps & features**
2. Search for "Kuamini Security Client"
3. Click **Uninstall**
4. Follow prompts

### Method 3: MSI Uninstall Command

```powershell
# Find product code
Get-WmiObject -Class Win32_Product | Where-Object {$_.Name -like "*Kuamini*"}

# Uninstall by product code
msiexec /x "{PRODUCT-CODE-GUID}" /quiet /norestart
```

### Complete Manual Cleanup

If automated uninstaller fails:

```powershell
# 1. Stop agent process
Stop-Process -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue

# 2. Remove installation directory
Remove-Item -Path "C:\Program Files (x86)\Kuamini Security Client" -Recurse -Force

# 3. Remove configuration
Remove-Item -Path "$env:LOCALAPPDATA\KuaminiSecurityClient" -Recurse -Force

# 4. Clean registry
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" `
  -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue

# 5. Verify removal
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
# Should return nothing
```

### Deregister from Console

After uninstalling:
1. Log into https://kuaminisystems.com/securityAgent
2. Go to **Endpoints**
3. Find the uninstalled endpoint
4. Click "⋮" menu → **Uninstall/Remove**
5. Endpoint will be marked as offline

---

## Building from Source

### Prerequisites for Building

- Python 3.10 or later
- PyInstaller: `pip install pyinstaller`
- WiX Toolset 3.14: https://wixtoolset.org/
- Microsoft Visual C++ Build Tools

### Build Agent Executable

```powershell
# Navigate to agent directory
cd agent-tray

# Install Python dependencies
pip install -r requirements.txt

# Clean previous builds
Remove-Item -Path "dist", "build" -Recurse -Force -ErrorAction SilentlyContinue

# Build with PyInstaller
pyinstaller KuaminiSecurityClient-win.spec

# Output: dist\KuaminiSecurityClient.exe
```

### Build MSI Installer

```powershell
# Build MSI package
.\build\build-windows-msi.ps1 -RegistrationToken "placeholder-token" -Version "1.0.5"

# Output: dist\KuaminiSecurityClient-1.0.5.msi

# Copy to distribution directory
Copy-Item "dist\KuaminiSecurityClient-1.0.5.msi" -Destination "..\public\tray\"
```

### Code Signing (Optional but Recommended)

```powershell
# Sign executable with Authenticode certificate
$certPath = "C:\certs\codesigning.pfx"
$certPassword = ConvertTo-SecureString "password" -AsPlainText -Force

# Sign EXE
signtool sign /f $certPath /p $certPassword /tr http://timestamp.digicert.com `
  /td sha256 /fd sha256 "dist\KuaminiSecurityClient.exe"

# Sign MSI
signtool sign /f $certPath /p $certPassword /tr http://timestamp.digicert.com `
  /td sha256 /fd sha256 "dist\KuaminiSecurityClient-1.0.5.msi"
```

### Deployment to CDN

```bash
# Copy built MSI to public directory
cp dist/KuaminiSecurityClient-1.0.5.msi ../public/tray/

# Commit and push
git add public/tray/KuaminiSecurityClient-1.0.5.msi
git commit -m "chore: Update Windows installer to v1.0.5"
git push origin main

# Vercel will auto-deploy
```

---

## Troubleshooting

### Issue: "Invalid token" error

**Cause**: Token is malformed, expired, or contains extra characters

**Solution**:
```powershell
# 1. Copy token from console again (ensure no spaces)
# 2. Verify token format
$token = "eyJ...your-token...QI="
Write-Host "Token length: $($token.Length)"

# 3. Try installation again with fresh token
```

### Issue: Agent installed but not showing in console

**Cause**: Registration failed or network issues

**Diagnostic Steps**:
```powershell
# 1. Check agent logs
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 50 | Select-String "error|fail|register"

# 2. Verify network connectivity
Test-NetConnection kuaminisystems.com -Port 443

# 3. Check if registration token exists
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json" | Select-String "registration_token"

# 4. Manually trigger registration
Stop-Process -Name "KuaminiSecurityClient" -Force
Start-Process "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
```

**Solution**:
1. Review logs for specific error message
2. Verify token is correct in config.json
3. Check firewall settings
4. Reinstall with fresh token

### Issue: "Administrator privileges required" error

**Cause**: Running in non-elevated PowerShell

**Solution**:
1. Right-click PowerShell → **"Run as Administrator"**
2. Re-run installation command

### Issue: Agent not starting automatically

**Cause**: Auto-start registry entry missing or disabled

**Solution**:
```powershell
# Check registry entry
$runKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
Get-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue

# Recreate if missing
$exePath = "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
Set-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -Value $exePath
```

### Issue: System tray icon not visible

**Cause**: Windows hiding tray icons or process not running

**Solution**:
```powershell
# 1. Check if process is running
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue

# 2. Check Windows tray settings
# Go to Settings → Personalization → Taskbar → Select which icons appear

# 3. Restart agent
Stop-Process -Name "KuaminiSecurityClient" -Force
Start-Process "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
```

### Issue: Installation hangs or takes too long

**Cause**: Network timeout, antivirus blocking, or slow download

**Solution**:
```powershell
# 1. Check internet speed
Test-NetConnection kuaminisystems.com -Port 443

# 2. Disable antivirus temporarily (Windows Defender)
Set-MpPreference -DisableRealtimeMonitoring $true

# 3. Download MSI manually first
$url = "https://kuaminisystems.com/tray/KuaminiSecurityClient-1.0.5.msi"
Invoke-WebRequest -Uri $url -OutFile "C:\temp\installer.msi"
msiexec /i "C:\temp\installer.msi" /quiet

# 4. Re-enable antivirus
Set-MpPreference -DisableRealtimeMonitoring $false
```

### Issue: "Access denied" when writing to Program Files

**Cause**: Insufficient permissions

**Solution**:
1. Ensure PowerShell is running as Administrator
2. Check User Account Control (UAC) settings
3. Temporarily disable antivirus if blocking installation
4. Verify no file locks on installation directory:
   ```powershell
   Get-Process | Where-Object {$_.Path -like "*Kuamini*"}
   ```

### Issue: MSI installation fails with error code

**Common MSI Error Codes**:
- **1603**: Fatal error during installation (check logs)
- **1618**: Another installation in progress (wait or reboot)
- **1619**: Installation package cannot be opened
- **1625**: This installation is forbidden by system policy

**Solution**:
```powershell
# Check Windows Installer log
msiexec /i installer.msi /l*v "C:\temp\msi-install.log"

# Review log for specific error
Get-Content "C:\temp\msi-install.log" | Select-String "error|fail|return value 3"
```

### Issue: Agent consuming high CPU/Memory

**Cause**: Scanning large files or configuration issue

**Diagnostic**:
```powershell
# Check resource usage
Get-Process -Name "KuaminiSecurityClient" | Select-Object CPU, WorkingSet, StartTime

# Check configuration
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
```

**Solution**:
1. Adjust scan intervals in config.json
2. Add exclusions for large directories
3. Restart agent
4. Contact support if issue persists

### Issue: Reinstalling after uninstall fails

**Cause**: Incomplete cleanup or registry artifacts

**Solution**:
```powershell
# Complete manual cleanup
Stop-Process -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Program Files (x86)\Kuamini Security Client" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\KuaminiSecurityClient" -Recurse -Force -ErrorAction SilentlyContinue

# Clean registry
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\SOFTWARE\Kuamini" -Recurse -Force -ErrorAction SilentlyContinue

# Reboot
Restart-Computer -Force

# Retry installation after reboot
```

### Getting Diagnostic Information

Run this diagnostic script to gather troubleshooting information:

```powershell
# Comprehensive diagnostic script
Write-Host "=== Kuamini Agent Diagnostics ===" -ForegroundColor Cyan

# 1. Process status
Write-Host "`n[Process Status]" -ForegroundColor Yellow
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue | 
  Select-Object Id, ProcessName, StartTime, CPU, WorkingSet

# 2. Installation directory
Write-Host "`n[Installation Directory]" -ForegroundColor Yellow
$installPaths = @(
  "C:\Program Files\Kuamini Security Client",
  "C:\Program Files (x86)\Kuamini Security Client"
)
foreach ($path in $installPaths) {
  if (Test-Path $path) {
    Write-Host "Found: $path" -ForegroundColor Green
    Get-ChildItem $path | Select-Object Name, Length, LastWriteTime
  }
}

# 3. Configuration
Write-Host "`n[Configuration]" -ForegroundColor Yellow
$configPath = "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
if (Test-Path $configPath) {
  Write-Host "Config exists: $configPath" -ForegroundColor Green
  Get-Content $configPath
} else {
  Write-Host "Config NOT found: $configPath" -ForegroundColor Red
}

# 4. Logs
Write-Host "`n[Recent Logs]" -ForegroundColor Yellow
$logPath = "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
if (Test-Path $logPath) {
  Get-Content $logPath -Tail 20
} else {
  Write-Host "Log file NOT found: $logPath" -ForegroundColor Red
}

# 5. Registry
Write-Host "`n[Registry Autostart]" -ForegroundColor Yellow
$runKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
Get-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue

# 6. Network connectivity
Write-Host "`n[Network Test]" -ForegroundColor Yellow
Test-NetConnection kuaminisystems.com -Port 443 | Select-Object TcpTestSucceeded, RemoteAddress

Write-Host "`n=== End Diagnostics ===" -ForegroundColor Cyan
```

---

## Advanced Topics

### Silent Installation for Mass Deployment

```powershell
# Create deployment script
$scriptBlock = {
  param($Token)
  
  # Silent installation
  $msiUrl = "https://kuaminisystems.com/tray/installer.msi"
  $msiPath = "$env:TEMP\kuamini-installer.msi"
  
  Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath
  msiexec /i $msiPath /quiet /norestart
  
  # Write token
  $installPath = "C:\Program Files (x86)\Kuamini Security Client"
  Set-Content -Path "$installPath\registration.token" -Value $Token
}

# Deploy to multiple machines
$computers = @("PC001", "PC002", "PC003")
$token = "YOUR_TOKEN"

foreach ($computer in $computers) {
  Invoke-Command -ComputerName $computer -ScriptBlock $scriptBlock -ArgumentList $token
}
```

### Group Policy Deployment

1. Create GPO for software installation
2. Add MSI package to GPO
3. Configure to run as Computer Configuration
4. Use startup script to write registration token

### Custom Registration Endpoint

For custom deployment workflows:

```powershell
# Register with custom API endpoint
$config = @{
  registration_token = "YOUR_TOKEN"
  api_base_url = "https://custom-domain.com/api/agent"
  agent_id = [guid]::NewGuid().ToString()
}

$configPath = "$env:LOCALAPPDATA\KuaminiSecurityClient"
New-Item -Path $configPath -ItemType Directory -Force
$config | ConvertTo-Json | Set-Content "$configPath\config.json"
```

---

## Support & Resources

- **Documentation**: https://kuaminisystems.com/docs
- **Support Portal**: https://kuaminisystems.com/support
- **Console**: https://kuaminisystems.com/securityAgent

For installation issues, gather diagnostic information using the script above and contact support.

---

**Document Version**: 2.1  
**Last Updated**: February 8, 2026  
**Platform**: Windows 10/11, Windows Server 2016+
