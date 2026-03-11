# Installation Guide - All Platforms

**Status**: ✅ Production Ready  
**Last Updated**: February 8, 2026  
**Version**: 2.1

Complete installation instructions for Windows, macOS, and Linux endpoints.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Windows Installation](#windows-installation)
3. [macOS Installation](#macos-installation)
4. [Linux Installation](#linux-installation)
5. [Post-Installation Verification](#post-installation-verification)
6. [Uninstallation](#uninstallation)
7. [Pre-Deployment Checklist](#pre-deployment-checklist)

---

## Quick Start

### 1. Get Registration Token

1. Log into **https://kuaminisystems.com/securityAgent**
2. Navigate to **Installers** section
3. Copy your registration token

### 2. Run Installer (Choose Your Platform Below)

**Windows:**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1'); Main -Token 'YOUR_TOKEN'"
```

**macOS:**
```bash
bash <(curl -s https://kuaminisystems.com/tray/install-kuamini-macos.sh) YOUR_TOKEN
```

**Linux:**
```bash
bash <(curl -s https://kuaminisystems.com/tray/install-kuamini-linux.sh) YOUR_TOKEN
```

### 3. Verify Installation

- ✅ Agent appears in system tray with green status
- ✅ Endpoint shows as "Online" in console dashboard
- ✅ Agent runs automatically after reboots

---

## Windows Installation

### System Requirements

- **OS**: Windows 10 (64-bit) or later, Windows Server 2016+
- **Privileges**: Administrator rights required
- **Network**: HTTPS access to `kuaminisystems.com` (port 443)
- **Disk Space**: ~50 MB minimum
- **Memory**: 100 MB RAM minimum

### Installation Methods

#### Method 1: One-Line PowerShell (Recommended)

```powershell
# Run in PowerShell as Administrator
# Replace YOUR_TOKEN with your registration token

powershell -NoProfile -ExecutionPolicy Bypass -Command "iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1'); Main -Token 'YOUR_TOKEN'"
```

#### Method 2: Download MSI from Console

1. Navigate to **Installers** → **Windows**
2. Click **"Download Installer"**
3. Run the MSI:
   ```cmd
   msiexec /i KuaminiSecurityClient-<accountId>.msi /quiet /norestart
   ```

#### Method 3: Manual Installation

```powershell
# Step 1: Prepare installation directory
New-Item -Path "C:\temp" -ItemType Directory -Force

# Step 2: Download installer script
Invoke-WebRequest -Uri "https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1" `
  -OutFile "C:\temp\install-kuamini-windows-cli.ps1"

# Step 3: Run installer with token
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
& "C:\temp\install-kuamini-windows-cli.ps1" -Token "YOUR_TOKEN"
```

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| Executable | `C:\Program Files (x86)\Kuamini Security Client\` | Agent binary |
| Config | `%LOCALAPPDATA%\KuaminiSecurityClient\config.json` | Runtime settings |
| Logs | `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log` | Activity logs |
| Token | `C:\Program Files (x86)\Kuamini...\registration.token` | Registration token |

### Configuration Example

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

### Modifying Configuration

```powershell
# Edit configuration
$configPath = "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
$config = Get-Content $configPath | ConvertFrom-Json
$config.heartbeat_interval = 120  # Change heartbeat to 2 minutes
$config | ConvertTo-Json | Set-Content $configPath

# Restart agent
Stop-Process -Name "KuaminiSecurityClient" -Force
Start-Process "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
```

---

## macOS Installation

### System Requirements

- **OS**: macOS 10.15 (Catalina) or later
- **Privileges**: User can grant permissions (admin may not be needed)
- **Network**: HTTPS access to `kuaminisystems.com` (port 443)
- **Disk Space**: ~50 MB minimum
- **Memory**: 100 MB RAM minimum

### Installation Methods

#### Method 1: One-Line Bash (Recommended)

```bash
bash <(curl -s https://kuaminisystems.com/tray/install-kuamini-macos.sh) YOUR_TOKEN
```

#### Method 2: Download DMG/PKG

1. Navigate to **Installers** → **macOS**
2. Download `.pkg` file
3. Install:
   ```bash
   sudo installer -pkg KuaminiSecurityClient-*.pkg -target /
   ```

#### Method 3: Manual Bash Installation

```bash
# Download installer script
curl -o ~/install-kuamini-macos.sh https://kuaminisystems.com/tray/install-kuamini-macos.sh

# Make executable and run
chmod +x ~/install-kuamini-macos.sh
./install-kuamini-macos.sh YOUR_TOKEN
```

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| Executable | `/Applications/KuaminiSecurityClient.app` | Agent application |
| Config | `~/.kuamini/config.json` | Runtime settings |
| Logs | `~/.kuamini/agent.log` | Activity logs |
| LaunchAgent | `~/Library/LaunchAgents/com.kuamini.securityclient.plist` | Auto-start agent |

### Configuration Example

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

### Modifying Configuration

```bash
# Edit configuration (use your preferred editor)
nano ~/.kuamini/config.json

# Or with defaults command
defaults write ~/.kuamini/config.json heartbeat_interval -int 120

# Restart LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.kuamini.securityclient.plist
launchctl load ~/Library/LaunchAgents/com.kuamini.securityclient.plist
```

---

## Linux Installation

### System Requirements

- **OS**: Ubuntu 18.04+, CentOS 7+, Debian 10+, or compatible
- **Privileges**: Sudo access required for system-level installation
- **Network**: HTTPS access to `kuaminisystems.com` (port 443)
- **Disk Space**: ~50 MB minimum
- **Memory**: 100 MB RAM minimum

### Installation Methods

#### Method 1: One-Line Bash (Recommended)

```bash
bash <(curl -s https://kuaminisystems.com/tray/install-kuamini-linux.sh) YOUR_TOKEN
```

#### Method 2: Download DEB/RPM

1. Navigate to **Installers** → **Linux**
2. Choose package format:
   - **DEB** (Ubuntu/Debian):
     ```bash
     sudo dpkg -i KuaminiSecurityClient-*.deb
     ```
   - **RPM** (CentOS/RHEL):
     ```bash
     sudo rpm -i KuaminiSecurityClient-*.rpm
     ```

#### Method 3: Manual Bash Installation

```bash
# Download installer script
curl -o ~/install-kuamini-linux.sh https://kuaminisystems.com/tray/install-kuamini-linux.sh

# Make executable and run
chmod +x ~/install-kuamini-linux.sh
sudo ./install-kuamini-linux.sh YOUR_TOKEN
```

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| Executable | `/usr/bin/KuaminiSecurityClient` or `/opt/kuamini/` | Agent binary |
| Config | `/etc/kuamini/config.json` | Runtime settings |
| Logs | `/var/log/kuamini/agent.log` | Activity logs |
| Systemd | `/etc/systemd/system/kuamini-agent.service` | Service unit |

### Configuration Example

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

### Modifying Configuration

```bash
# Edit configuration
sudo nano /etc/kuamini/config.json

# Restart service
sudo systemctl restart kuamini-agent-tray

# View service status
sudo systemctl status kuamini-agent-tray
```

---

## Post-Installation Verification

### Step 1: Verify Agent Process

**Windows:**
```powershell
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
# Should show running process
```

**macOS:**
```bash
pgrep -fl KuaminiSecurityClient
# Should show process name and PID
```

**Linux:**
```bash
ps aux | grep KuaminiSecurityClient
# Should show running process
```

### Step 2: Check Agent Status

**Windows:**
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 10
```

**macOS:**
```bash
tail -f ~/.kuamini/agent.log
```

**Linux:**
```bash
sudo tail -f /var/log/kuamini/agent.log
```

### Step 3: Verify System Tray Icon

- **Green**: Online and connected ✅
- **Red**: Disconnected or error
- **Yellow**: Connecting/updating

### Step 4: Check Console Dashboard

1. Log into **https://kuaminisystems.com/securityAgent**
2. Navigate to **Endpoints** tab
3. Verify endpoint appears with:
   - **Status**: Online (green)
   - **Hostname**: Correct computer name
   - **OS**: Correct OS and version
   - **Last Seen**: Within last 2 minutes

### Step 5: Test Auto-start

```
1. Restart computer
2. Log back in
3. Verify agent appears in system tray automatically
4. Check console dashboard - endpoint still shows Online
```

---

## Uninstallation

### Windows

**Option 1: Control Panel**
```
Settings → Apps → Apps & Features → Kuamini Security Client → Uninstall
```

**Option 2: Automated Script**
```powershell
# If available, run:
C:\Program Files (x86)\Kuamini Security Client\uninstall.ps1
```

**Option 3: MSI Removal**
```powershell
msiexec /x {GUID} /quiet /norestart
# Get GUID from registry if needed
```

**Option 4: Manual Cleanup**
```powershell
# Remove installation directory
Remove-Item "C:\Program Files (x86)\Kuamini Security Client" -Recurse -Force

# Remove config/logs
Remove-Item "$env:LOCALAPPDATA\KuaminiSecurityClient" -Recurse -Force

# Remove registry entry (Run as Administrator)
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient" -Force
```

### macOS

**Option 1: App Cleanup Script** (if provided)
```bash
bash /Applications/KuaminiSecurityClient.app/uninstall.sh
```

**Option 2: Manual Cleanup**
```bash
# Remove application
rm -rf /Applications/KuaminiSecurityClient.app

# Remove configuration
rm -rf ~/.kuamini

# Remove LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.kuamini.securityclient.plist
rm ~/Library/LaunchAgents/com.kuamini.securityclient.plist
```

### Linux

**Option 1: Package Manager (Ubuntu/Debian)**
```bash
sudo apt-get remove kuamini-security-client
sudo apt-get autoremove
```

**Option 2: Package Manager (CentOS/RHEL)**
```bash
sudo yum remove kuamini-security-client
```

**Option 3: Manual Cleanup**
```bash
# Remove systemd service
sudo systemctl stop kuamini-agent-tray
sudo systemctl disable kuamini-agent-tray
sudo rm /etc/systemd/system/kuamini-agent.service

# Remove installation
sudo rm -rf /opt/kuamini /usr/bin/KuaminiSecurityClient*

# Remove logs and config
sudo rm -rf /etc/kuamini /var/log/kuamini
```

---

## Pre-Deployment Checklist

Use this checklist when deploying to production:

- [ ] **Network**: Firewall allows HTTPS (port 443) to `kuaminisystems.com`
- [ ] **Privileges**: Installation user has admin/sudo rights
- [ ] **Token**: Registration token obtained and has NOT expired
- [ ] **Prerequisites**: OS version meets minimum requirements
- [ ] **Disk Space**: At least 50 MB free disk space available
- [ ] **Download**: MSI/PKG/DEB cached locally for offline deployment (optional)
- [ ] **Backup**: Backed up existing security agent config if replacing
- [ ] **Rollback**: Have uninstall procedure tested if existing agent present
- [ ] **Communication**: Users informed of installation time/restart if needed
- [ ] **Testing**: Installation tested in dev/staging before production rollout
- [ ] **Verification**: Post-installation verification steps documented for IT team
- [ ] **Support**: Support team trained on common issues and solutions
- [ ] **Monitoring**: Dashboard monitoring configured to alert on offline endpoints
- [ ] **Upgrades**: Update strategy and schedule documented
- [ ] **Compliance**: Installation logged and reported for compliance tracking

---

## Troubleshooting

### Agent Won't Start

**Windows:**
```powershell
# Check Windows Event Viewer for errors
Get-EventLog -LogName Application -Newest 5 | Where-Object {$_.Source -like "*Kuamini*"}

# Restart with verbose logging
$env:DEBUG="kuamini:*"
Start-Process "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
```

**macOS/Linux:**
```bash
# Check logs with increased verbosity
DEBUG=kuamini:* /path/to/agent
```

### "Invalid Token" Error

1. Go to console and generate new registration token
2. Ensure token is copied completely (no truncation)
3. Provide token immediately (some tokens may expire)
4. Re-run installer with fresh token

### Agent Shows Offline in Console

1. Check network connectivity: `ping kuaminisystems.com`
2. Check firewall rules allow HTTPS to kuaminisystems.com
3. Review agent logs for connection errors
4. Restart agent: `systemctl restart kuamini-agent-tray` (Linux)
5. Check system time (clock skew can cause failures)

### High CPU/Memory Usage

1. Increase scan_interval in config (default 3600 = 1 hour)
2. Add exclusions for large directories
3. Reduce heartbeat frequency if unnecessary
4. Check logs for stuck processes

For additional help, see [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md).
