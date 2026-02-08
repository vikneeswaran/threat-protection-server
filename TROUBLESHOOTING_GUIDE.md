# Troubleshooting & Debug Guide

**Last Updated**: February 8, 2026  
**Status**: ✅ Comprehensive Reference  
**Platforms**: Windows, macOS, Linux

---

## Table of Contents

1. [General Troubleshooting](#general-troubleshooting)
2. [Windows-Specific Issues](#windows-specific-issues)
3. [macOS-Specific Issues](#macos-specific-issues)
4. [Linux-Specific Issues](#linux-specific-issues)
5. [Network & Connectivity](#network--connectivity)
6. [Registration & Authentication](#registration--authentication)
7. [Diagnostic Tools](#diagnostic-tools)
8. [Common Error Messages](#common-error-messages)
9. [Performance Issues](#performance-issues)
10. [Support Resources](#support-resources)

---

## General Troubleshooting

### Agent Not Appearing in Console

**Symptoms:**
- Agent installed successfully
- No endpoint showing in console dashboard
- Logs show no registration success message

**Diagnostic Steps:**
1. Verify agent is running (see platform-specific sections)
2. Check network connectivity to API
3. Review agent logs for registration errors
4. Verify registration token is valid

**Solutions:**

**Check Configuration:**
```bash
# Windows
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"

# macOS
cat ~/.kuamini/config.json

# Linux
sudo cat /etc/kuamini/config.json
```

**Verify Network Connectivity:**
```bash
# Test API endpoint
curl -v https://kuaminisystems.com/api/health

# Expected response: HTTP 200 OK
```

**Manual Registration Trigger:**
```bash
# Windows
Stop-Process -Name "KuaminiSecurityClient" -Force
Start-Process "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"

# macOS
launchctl bootout gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# Linux
sudo systemctl restart kuamini-agent-tray
```

### Agent Status Shows "Offline" in Console

**Symptoms:**
- Agent was previously online
- Now showing offline status
- Heartbeat not being received

**Common Causes:**
- Agent process terminated unexpectedly
- Network connectivity lost
- Firewall blocking outbound HTTPS
- System suspended/hibernated

**Solutions:**

**1. Restart Agent:**
```bash
# Windows
Restart-Service -Name "KuaminiAgentTray" -Force

# macOS
launchctl kickstart -k gui/$UID/com.kuamini.securityclient

# Linux
sudo systemctl restart kuamini-agent-tray
```

**2. Check Firewall:**
```bash
# Windows
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Kuamini*"}

# Linux (UFW)
sudo ufw status

# Linux (firewalld)
sudo firewall-cmd --list-all
```

**3. Verify Heartbeat Interval:**
```bash
# Check config for heartbeat_interval (should be 60 seconds)
# If too high, agent may be marked offline between heartbeats
```

### "Invalid Token" Error

**Symptoms:**
- Installation completes but registration fails
- Error message: "Invalid token" or "Token validation failed"
- Logs show 400/401 HTTP errors

**Solutions:**

**1. Verify Token Format:**
```bash
# Token should be:
# - Base64-encoded string
# - Or JWT format (three parts separated by dots)
# - No extra spaces or newlines

# Check token length
echo -n "YOUR_TOKEN" | wc -c
# Should be substantial (50+ characters for base64, 100+ for JWT)
```

**2. Get Fresh Token:**
1. Log into console: https://kuaminisystems.com/securityAgent
2. Navigate to **Installers**
3. Generate new token
4. Copy entire token (no truncation)
5. Reinstall with new token

**3. Check Token Expiration:**
```bash
# Some tokens may have expiration
# Generate and use token immediately for installation
```

### High CPU/Memory Usage

**Symptoms:**
- Agent consuming excessive CPU (>20%)
- High memory usage (>500 MB)
- System slowdown

**Diagnostic:**
```bash
# Windows
Get-Process -Name "KuaminiSecurityClient" | Select-Object CPU, WS, StartTime

# macOS
ps aux | grep KuaminiSecurityClient | grep -v grep

# Linux
top -p $(pgrep KuaminiSecurityClient)
```

**Solutions:**

**1. Adjust Scan Intervals:**
```json
{
  "scan_interval": 7200,  // Increase from 3600 (1h) to 7200 (2h)
  "heartbeat_interval": 60  // Keep at 60 seconds
}
```

**2. Add Exclusions:**
- Exclude large directories from scans
- Add trusted applications to whitelist
- Configure via console policy settings

**3. Check for Stuck Scans:**
```bash
# Review logs for scanning activity
# If scan has been running for hours, restart agent
```

---

## Windows-Specific Issues

### Installation Diagnostic Script

Run this comprehensive diagnostic to gather all Windows installation information:

```powershell
# Complete Windows Diagnostic Script
Write-Host "=== Kuamini Windows Agent Diagnostics ===" -ForegroundColor Cyan

# 1. Process Status
Write-Host "`n[1. Process Status]" -ForegroundColor Yellow
$process = Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
if ($process) {
    $process | Select-Object Id, ProcessName, StartTime, CPU, WorkingSet | Format-Table
} else {
    Write-Host "Process NOT running" -ForegroundColor Red
}

# 2. Installation Directory
Write-Host "`n[2. Installation Directory]" -ForegroundColor Yellow
$installPaths = @(
    "C:\Program Files\Kuamini Security Client",
    "C:\Program Files (x86)\Kuamini Security Client"
)
foreach ($path in $installPaths) {
    if (Test-Path $path) {
        Write-Host "Found: $path" -ForegroundColor Green
        Get-ChildItem $path | Select-Object Name, Length, LastWriteTime | Format-Table
    } else {
        Write-Host "Not found: $path" -ForegroundColor Yellow
    }
}

# 3. Configuration File
Write-Host "`n[3. Configuration File]" -ForegroundColor Yellow
$configPath = "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
if (Test-Path $configPath) {
    Write-Host "Config exists: $configPath" -ForegroundColor Green
    Get-Content $configPath | ConvertFrom-Json | Format-List
} else {
    Write-Host "Config NOT found: $configPath" -ForegroundColor Red
}

# 4. Log Files
Write-Host "`n[4. Log Files]" -ForegroundColor Yellow
$logPath = "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
if (Test-Path $logPath) {
    Write-Host "Log exists, showing last 20 lines:" -ForegroundColor Green
    Get-Content $logPath -Tail 20
} else {
    Write-Host "Log file NOT found: $logPath" -ForegroundColor Red
}

# 5. Registry Autostart
Write-Host "`n[5. Registry Autostart]" -ForegroundColor Yellow
$runKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
$entry = Get-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
if ($entry) {
    Write-Host "Autostart configured:" -ForegroundColor Green
    $entry.KuaminiSecurityClient
} else {
    Write-Host "Autostart NOT configured" -ForegroundColor Red
}

# 6. Scheduled Tasks
Write-Host "`n[6. Scheduled Tasks]" -ForegroundColor Yellow
$task = Get-ScheduledTask -TaskName "KuaminiAgentTray" -ErrorAction SilentlyContinue
if ($task) {
    $task | Select-Object TaskName, State, LastRunTime | Format-Table
} else {
    Write-Host "No scheduled task found" -ForegroundColor Yellow
}

# 7. Firewall Rules
Write-Host "`n[7. Firewall Rules]" -ForegroundColor Yellow
$rules = Get-NetFirewallRule -DisplayName "*Kuamini*" -ErrorAction SilentlyContinue
if ($rules) {
    $rules | Select-Object DisplayName, Enabled, Direction | Format-Table
} else {
    Write-Host "No firewall rules found" -ForegroundColor Yellow
}

# 8. Network Connectivity
Write-Host "`n[8. Network Connectivity]" -ForegroundColor Yellow
$result = Test-NetConnection kuaminisystems.com -Port 443 -WarningAction SilentlyContinue
if ($result.TcpTestSucceeded) {
    Write-Host "Network OK: Can reach kuaminisystems.com:443" -ForegroundColor Green
} else {
    Write-Host "Network FAIL: Cannot reach kuaminisystems.com:443" -ForegroundColor Red
}

# 9. Event Viewer Errors
Write-Host "`n[9. Recent Event Viewer Errors]" -ForegroundColor Yellow
$events = Get-EventLog -LogName Application -After (Get-Date).AddHours(-24) -ErrorAction SilentlyContinue | 
          Where-Object { $_.Message -like "*Kuamini*" -or $_.Source -like "*Kuamini*" }
if ($events) {
    $events | Select-Object TimeGenerated, EntryType, Message | Format-Table -Wrap
} else {
    Write-Host "No Kuamini events found in last 24 hours" -ForegroundColor Yellow
}

Write-Host "`n=== End Diagnostics ===" -ForegroundColor Cyan
```

### Issue: MSI Installation Fails

**Error Codes:**
- **1603**: Fatal error during installation
- **1618**: Another installation in progress
- **1619**: Installation package cannot be opened
- **1625**: Installation forbidden by system policy

**Solutions:**

```powershell
# Enable verbose MSI logging
msiexec /i "installer.msi" /l*v "C:\temp\msi-install.log"

# Review log for specific errors
Get-Content "C:\temp\msi-install.log" | Select-String "error|fail|return value 3"

# Common fixes:
# 1. Close all Windows Installer processes
Get-Process -Name msiexec | Stop-Process -Force

# 2. Restart Windows Installer service
Restart-Service -Name msiserver -Force

# 3. Reboot and retry
Restart-Computer -Force
```

### Issue: Agent Won't Start After Installation

**Solutions:**

```powershell
# 1. Check if VCREDIST is installed
Get-ItemProperty HKLM:\SOFTWARE\Wow6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64 -ErrorAction SilentlyContinue

# 2. Install Visual C++ Redistributable if missing
# Download from Microsoft: https://aka.ms/vs/17/release/vc_redist.x64.exe

# 3. Run agent with detailed output
& "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe" --debug

# 4. Check Windows Defender exclusions
# Add agent executable to exclusions if being blocked
```

### Issue: System Tray Icon Not Visible

**Solutions:**

```powershell
# 1. Check if process is actually running
Get-Process -Name "KuaminiSecurityClient"

# 2. Configure Windows to show hidden icons
# Settings → Personalization → Taskbar → "Select which icons appear on the taskbar"

# 3. Restart Windows Explorer
Stop-Process -Name explorer -Force

# 4. Restart agent
Stop-Process -Name "KuaminiSecurityClient" -Force
Start-Process "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
```

---

## macOS-Specific Issues

### Installation Diagnostic Script

```bash
#!/bin/bash
echo "=== Kuamini macOS Agent Diagnostics ==="

# 1. Process Status
echo -e "\n[1. Process Status]"
ps aux | grep KuaminiSecurityClient | grep -v grep || echo "Process NOT running"

# 2. Application
echo -e "\n[2. Application]"
if [ -d "/Applications/KuaminiSecurityClient.app" ]; then
    echo "App exists:"
    ls -la /Applications/KuaminiSecurityClient.app
else
    echo "App NOT found"
fi

# 3. Configuration
echo -e "\n[3. Configuration]"
if [ -f ~/.kuamini/config.json ]; then
    echo "Config exists:"
    cat ~/.kuamini/config.json
else
    echo "Config NOT found"
fi

# 4. LaunchAgent
echo -e "\n[4. LaunchAgent Status]"
launchctl print gui/$UID/com.kuamini.securityclient 2>&1

# 5. Logs
echo -e "\n[5. Recent Logs]"
if [ -f ~/.kuamini/logs/agent.log ]; then
    tail -20 ~/.kuamini/logs/agent.log
else
    echo "Log file NOT found"
fi

# 6. LaunchAgent Plist
echo -e "\n[6. LaunchAgent Plist]"
if [ -f ~/Library/LaunchAgents/com.kuamini.securityclient.plist ]; then
    echo "Plist exists"
    plutil ~/Library/LaunchAgents/com.kuamini.securityclient.plist
else
    echo "Plist NOT found"
fi

# 7. Network
echo -e "\n[7. Network Test]"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://kuaminisystems.com/api/health

# 8. Gatekeeper Status
echo -e "\n[8. Gatekeeper/Quarantine Check]"
xattr -l /Applications/KuaminiSecurityClient.app 2>&1 | grep quarantine || echo "No quarantine flag"

echo -e "\n=== End Diagnostics ==="
```

### Issue: "App is damaged and can't be opened"

**Solution:**

```bash
# Remove quarantine attribute
sudo xattr -rd com.apple.quarantine /Applications/KuaminiSecurityClient.app

# Verify signature (if code signed)
codesign -vv /Applications/KuaminiSecurityClient.app
spctl -a -vv /Applications/KuaminiSecurityClient.app

# Temporarily bypass Gatekeeper (not recommended for production)
sudo spctl --master-disable
# Re-enable after installation:
sudo spctl --master-enable
```

### Issue: LaunchAgent Bootstrap Error 5

**Causes:**
- Incorrect plist syntax
- Invalid file paths
- Permission issues
- Missing $HOME variable

**Solutions:**

```bash
# 1. Validate plist syntax
plutil ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# Fix syntax errors if found

# 2. Check permissions
chmod 644 ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# 3. Ensure paths are absolute (no $HOME variable in plist)
# Edit plist and replace $HOME with /Users/yourusername

# 4. Use legacy launchctl load
launchctl unload ~/Library/LaunchAgents/com.kuamini.securityclient.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# 5. Check console logs for details
log show --predicate 'process == "launchd"' --last 10m | grep kuamini
```

### Issue: macOS Sequoia PKG Bug

**Symptoms:**
- PKG installation reports success
- But application not in /Applications
- Files not extracted

**Solution:**

```bash
# Use the shell script wrapper instead of direct PKG install
./install-kuamini-macos.sh /path/to/KuaminiSecurityClient-1.0.0.pkg

# Or manual extraction:
pkgutil --expand-full KuaminiSecurityClient-1.0.0.pkg extracted_pkg
cd extracted_pkg/Payload
sudo cp -R KuaminiSecurityClient.app /Applications/
```

### Issue: Menu Bar Icon Not Showing

**Solutions:**

```bash
# 1. Verify process is running
ps aux | grep KuaminiSecurityClient | grep -v grep

# 2. Restart Dock to refresh menu bar
killall Dock

# 3. Check if PyObjC/Rumps is working
# Run agent manually to see errors:
/Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient

# 4. Grant accessibility permissions
# System Preferences → Security & Privacy → Privacy → Accessibility
# Add KuaminiSecurityClient
```

---

## Linux-Specific Issues

### Installation Diagnostic Script

```bash
#!/bin/bash
echo "=== Kuamini Linux Agent Diagnostics ==="

# 1. Service Status
echo -e "\n[1. Service Status]"
sudo systemctl status kuamini-agent-tray --no-pager

# 2. Process Status
echo -e "\n[2. Process Status]"
ps aux | grep KuaminiSecurityClient | grep -v grep || echo "Process NOT running"

# 3. Installation Files
echo -e "\n[3. Installation Files]"
ls -la /opt/kuamini-agent-tray/ 2>/dev/null || echo "Installation directory NOT found"

# 4. Configuration
echo -e "\n[4. Configuration]"
if [ -f /etc/kuamini/config.json ]; then
    sudo cat /etc/kuamini/config.json
else
    echo "Config NOT found"
fi

# 5. Systemd Service File
echo -e "\n[5. Systemd Service File]"
if [ -f /etc/systemd/system/kuamini-agent-tray.service ]; then
    echo "Service file exists:"
    sudo cat /etc/systemd/system/kuamini-agent-tray.service
else
    echo "Service file NOT found"
fi

# 6. Logs
echo -e "\n[6. Recent Logs]"
sudo journalctl -u kuamini-agent-tray -n 30 --no-pager

# 7. Binary Check
echo -e "\n[7. Binary Executable Check]"
file /opt/kuamini-agent-tray/KuaminiSecurityClient 2>/dev/null
ldd /opt/kuamini-agent-tray/KuaminiSecurityClient 2>/dev/null | grep "not found" || echo "All libraries OK"

# 8. Network
echo -e "\n[8. Network Test]"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://kuaminisystems.com/api/health

# 9. Firewall
echo -e "\n[9. Firewall Status]"
if command -v ufw &> /dev/null; then
    sudo ufw status
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --list-all
else
    echo "No firewall detected"
fi

# 10. System Info
echo -e "\n[10. System Info]"
uname -a
cat /etc/os-release 2>/dev/null | grep -E "^(NAME|VERSION)="

echo -e "\n=== End Diagnostics ==="
```

### Issue: Service Won't Start

**Solutions:**

```bash
# 1. Check service status
sudo systemctl status kuamini-agent-tray

# 2. Check detailed logs
sudo journalctl -u kuamini-agent-tray -n 100 --no-pager

# 3. Verify execute permissions
sudo chmod +x /opt/kuamini-agent-tray/KuaminiSecurityClient

# 4. Check missing libraries
ldd /opt/kuamini-agent-tray/KuaminiSecurityClient

# Install missing dependencies (Ubuntu/Debian)
sudo apt-get install -y libgtk-3-0 libappindicator3-1

# Install missing dependencies (CentOS/RHEL)
sudo yum install -y gtk3 libappindicator-gtk3

# 5. Reload systemd
sudo systemctl daemon-reload
sudo systemctl restart kuamini-agent-tray
```

### Issue: Permission Denied Errors

**Solutions:**

```bash
# 1. Fix ownership
sudo chown -R root:root /opt/kuamini-agent-tray
sudo chown -R root:root /etc/kuamini
sudo chown -R root:root /var/log/kuamini

# 2. Fix permissions
sudo chmod 755 /opt/kuamini-agent-tray
sudo chmod +x /opt/kuamini-agent-tray/KuaminiSecurityClient
sudo chmod 644 /etc/kuamini/config.json
sudo chmod 755 /var/log/kuamini

# 3. SELinux (if applicable)
# Check for denials
sudo ausearch -m avc -ts recent

# Temporarily disable to test
sudo setenforce 0

# Re-enable after testing
sudo setenforce 1

# 4. AppArmor (if applicable)
sudo aa-status
sudo aa-complain /opt/kuamini-agent-tray/KuaminiSecurityClient
```

### Issue: System Tray Icon Not Showing

**Solutions:**

```bash
# Install tray support libraries
# Ubuntu/Debian:
sudo apt-get install -y libappindicator3-1 gir1.2-appindicator3-0.1

# Fedora:
sudo dnf install -y libappindicator-gtk3

# CentOS/RHEL:
sudo yum install -y libappindicator-gtk3

# Restart service
sudo systemctl restart kuamini-agent-tray
```

---

## Network & Connectivity

### Testing API Connectivity

```bash
# Basic connectivity test
curl -v https://kuaminisystems.com/api/health

# Expected response: HTTP 200 OK with JSON body

# Test registration endpoint (with dummy data)
curl -X POST https://kuaminisystems.com/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"test":"connectivity"}' -v

# Expected: HTTP 400 (bad request) - proves endpoint is reachable
```

### Firewall Configuration

**Windows:**
```powershell
# Allow outbound HTTPS
New-NetFirewallRule -DisplayName "Kuamini Agent" -Direction Outbound -Protocol TCP -RemotePort 443 -Action Allow

# Check existing rules
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Kuamini*"}
```

**Linux (UFW):**
```bash
# Allow outbound HTTPS
sudo ufw allow out 443/tcp

# Check status
sudo ufw status
```

**Linux (firewalld):**
```bash
# Allow HTTPS
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Check configuration
sudo firewall-cmd --list-all
```

**macOS:**
```bash
# macOS generally allows outbound connections
# If using Little Snitch or similar, add exception for:
# Application: KuaminiSecurityClient
# Domain: kuaminisystems.com
# Port: 443 (HTTPS)
```

### Proxy Configuration

If behind a corporate proxy:

```json
{
  "api_base_url": "https://kuaminisystems.com/api/agent",
  "proxy": {
    "http": "http://proxy.company.com:8080",
    "https": "http://proxy.company.com:8080"
  },
  "no_proxy": "localhost,127.0.0.1"
}
```

---

## Registration & Authentication

### Troubleshooting Registration TokensRegistration token issues:

**Verify Token Format:**
```bash
# Valid formats:
# 1. Base64-encoded JSON
# 2. JWT (three base64 parts separated by dots)

# Decode base64 token (for debugging only)
echo "YOUR_TOKEN" | base64 -d

# Should show JSON with accountId field
```

**Check Token in Configuration:**
```bash
# Windows
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json" | Select-String "token"

# macOS/Linux
grep token ~/.kuamini/config.json /etc/kuamini/config.json 2>/dev/null
```

**Generate Fresh Token:**
1. Log into console
2. Go to Installers page
3. Click "Generate New Token"
4. Copy ENTIRE token (don't truncate)
5. Use immediately (may have expiration)

---

## Common Error Messages

### "Connection refused" or "Connection timeout"

**Causes:**
- Firewall blocking outbound HTTPS
- Network offline
- DNS resolution issues
- API endpoint down

**Solutions:**
```bash
# Test DNS resolution
nslookup kuaminisystems.com

# Test connectivity
ping kuaminisystems.com

# Test HTTPS
curl -I https://kuaminisystems.com

# Check system proxy settings
```

### "SSL Certificate Verification Failed"

**Causes:**
- System time incorrect
- Missing CA certificates
- Corporate SSL inspection

**Solutions:**
```bash
# Check system time
date

# Linux: Update CA certificates
sudo update-ca-certificates

# macOS: Trust certificate
# Keychain Access → System → Add certificate

# Windows: Import certificate
# certmgr.msc → Trusted Root Certification Authorities
```

### "Agent ID already registered"

**Causes:**
- Attempting to reinstall with same agent_id
- Agent_id conflict

**Solutions:**
```bash
# Option 1: Use existing agent_id (keep config.json)
# Just reinstall and reuse existing configuration

# Option 2: Generate new agent_id
# Delete config.json before reinstalling
# Agent will generate new UUID on first run

# Option 3: Deregister old agent from console
# Console → Endpoints → Find old entry → Uninstall/Remove
```

---

## Performance Issues

### High CPU Usage

**Investigate:**
```bash
# Check which operations are consuming CPU
# Review logs for scanning activity

# Reduce scan frequency
# Edit config: increase scan_interval from 3600 to 7200+
```

### High Memory Usage

**Solutions:**
```bash
# Add memory limits (Linux systemd)
sudo nano /etc/systemd/system/kuamini-agent-tray.service

# Add under [Service]:
MemoryLimit=256M
MemoryMax=512M

sudo systemctl daemon-reload
sudo systemctl restart kuamini-agent-tray
```

### Slow System Performance

**Solutions:**
- Add exclusions for large directories
- Schedule scans during off-hours
- Reduce scan depth/frequency
- Check for competing antivirus software

---

## Support Resources

### Getting Help

1. **Review Logs**: Always check agent logs first
2. **Run Diagnostics**: Use platform-specific diagnostic scripts above
3. **Check Console**: Verify endpoint status in dashboard
4. **Contact Support**: Provide diagnostic output

### Support Channels

- **Documentation**: https://kuaminisystems.com/docs
- **Support Portal**: https://kuaminisystems.com/support
- **Email**: support@kuaminisystems.com
- **Console**: https://kuaminisystems.com/securityAgent

### Information to Provide

When contacting support, include:
- Platform and OS version
- Agent version
- Diagnostic script output
- Recent log entries (last 100 lines)
- Screenshots of error messages
- Steps to reproduce issue

---

**Document Version**: 1.0  
**Last Updated**: February 8, 2026  
**Platforms**: Windows, macOS, Linux
