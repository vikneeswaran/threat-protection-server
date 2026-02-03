# Fix for Existing Windows Endpoint - Quick Start Guide

**Problem**: Agent not showing systray icon and endpoint not registered with console  
**Root Cause**: Old agent version with initialization error  
**Solution**: Complete removal and clean reinstallation

---

## ⚡ Quick Fix (5 minutes)

### Step 1: Uninstall Old Agent (Run as Administrator)

```powershell
# Open PowerShell as Administrator
# Download the robust uninstaller
Invoke-WebRequest -Uri "https://kuaminisystems.com/api/agent/uninstallers/windows" `
  -OutFile "C:\temp\uninstall.ps1" -ErrorAction SilentlyContinue

# If download fails, use the local copy:
# Copy uninstallers/uninstall-kuamini-windows-robust.ps1 to C:\temp\

# Run uninstaller
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
& "C:\temp\uninstall.ps1" -Force -Quiet

# Wait for completion
Write-Host "Uninstallation complete. Waiting 10 seconds..."
Start-Sleep -Seconds 10
```

### Step 2: Verify Complete Removal

```powershell
# Check: No processes running
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue

# Check: No installation directory
Test-Path "C:\Program Files\Kuamini Security Client"

# Check: No config files
Test-Path "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
Test-Path "$env:USERPROFILE\.kuamini\config.json"

# All should return False or show "False"
```

### Step 3: Install Fresh Agent (Run as Administrator)

```powershell
# Get registration token from console
# 1. Log in: https://kuaminisystems.com/securityAgent
# 2. Go to: Installers → Windows
# 3. Copy the download link (contains embedded token)

# Download installer wrapper
Invoke-WebRequest -Uri "https://kuaminisystems.com/agent-tray/install-kuamini-windows.ps1" `
  -OutFile "C:\temp\install.ps1"

# Run installer
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
& "C:\temp\install.ps1"

# Watch for:
# ✓ "MSI downloaded successfully"
# ✓ "Configuration file created"
# ✓ "Installation verification completed successfully"
# ✓ "Endpoint successfully registered and responsive"

# Installation complete! (60-120 seconds total)
```

### Step 4: Verify Registration

```powershell
# Check logs
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 20

# Look for:
# - "Logging initialized"
# - "Auto-registration successful"
# - "Heartbeat successful"
# - Status should be "Online"
```

### Step 5: Confirm in Console

1. Go to: https://kuaminisystems.com/securityAgent/dashboard/endpoints
2. Look for your computer name
3. Status should be **Online** (green)
4. Last Seen should be recent (within 2 minutes)

**Success!** Your endpoint is now registered and protected. ✅

---

## 🔧 If Installation Fails

### Issue: MSI Download Fails

**Cause**: Network or token issue

**Fix**:
```powershell
# 1. Verify network connectivity
Test-NetConnection -ComputerName kuaminisystems.com -Port 443

# 2. Check Windows Firewall
Get-NetFirewallProfile | Select -ExpandProperty Enabled

# 3. Try download with retry
$url = "https://kuaminisystems.com/api/agent/installers/windows?token=..."
# (Copy the full URL from console Installers page)

Invoke-WebRequest -Uri $url -OutFile "C:\temp\installer.msi" -TimeoutSec 300
```

### Issue: Installation Errors

**Cause**: Old files still present or permissions issue

**Fix**:
```powershell
# Manual cleanup
Remove-Item "C:\Program Files\Kuamini Security Client" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\KuaminiSecurityClient" -Recurse -Force -ErrorAction SilentlyContinue

# Check/fix permissions
icacls "$env:LOCALAPPDATA\KuaminiSecurityClient" /grant:r "$env:USERNAME`:F" /T

# Retry installation
```

### Issue: Agent Won't Start (No Tray Icon)

**Cause**: Missing dependencies or configuration

**Check**:
```powershell
# View logs
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 50

# Look for errors like:
# - "Failed to import PIL"
# - "Failed to create pystray icon"
# - "NameError"

# Reinstall if errors found
& "C:\temp\uninstall.ps1" -Force
& "C:\temp\install.ps1"
```

### Issue: Endpoint Doesn't Appear in Console

**Cause**: Heartbeat not working or account full

**Recommended actions**:
1. Wait 2-3 minutes for first heartbeat
2. Check console for license warnings (Endpoints: 5/5 used?)
3. Verify config file has account_id:
   ```powershell
   Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json" | ConvertFrom-Json
   # Should see: account_id, agent_id, registration_token
   ```
4. Check logs for heartbeat errors
5. Verify network: `Test-NetConnection kuaminisystems.com -Port 443`

---

## 📊 Expected Behavior After Installation

### First 30 Seconds
- Tray icon appears (may be in hidden icons tray on Windows 11)
- Green circle = Online status

### First 2 Minutes
- Agent registers with console
- Endpoint appears in "Endpoints" list
- Status: "Online" (green)

### Every 60 Seconds
- Heartbeat sent to API
- Policies sync
- Last Seen timestamp updates

### On System Reboot
- Agent auto-starts
- Tray icon appears
- Continues heartbeat cycle

---

## 📋 Files & Locations

| Description | Path |
|-------------|------|
| Agent Executable | `C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe` |
| Configuration | `%LOCALAPPDATA%\KuaminiSecurityClient\config.json` |
| Logs | `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log` |
| Autostart Entry | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` |

---

## ✅ Checklist for Complete Fix

- [ ] Downloaded uninstaller script
- [ ] Ran uninstaller (completed successfully)
- [ ] Verified no processes/files remaining
- [ ] Downloaded installer wrapper
- [ ] Got registration token from console
- [ ] Ran installer (completed successfully)
- [ ] Checked logs (no errors)
- [ ] Verified tray icon visible
- [ ] Verified endpoint in console (Online status)
- [ ] Policies assigned as needed

---

## 🎯 Expected Result

Your Windows endpoint is now:
- ✅ Properly installed
- ✅ Registered with console
- ✅ Showing tray icon
- ✅ Sending heartbeats every 60 seconds
- ✅ Visible in endpoint list (Online status)
- ✅ Ready to receive security policies

---

## 📞 Need Help?

If you're still experiencing issues:

1. **Collect logs**:
   ```powershell
   Copy-Item "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Destination "C:\kuamini-logs.txt"
   ```

2. **Run diagnostics**:
   ```powershell
   # Download and run diagnostic tool
   Invoke-WebRequest -Uri "https://kuaminisystems.com/agent-diagnostics.py" `
     -OutFile "C:\temp\diagnose.py"
   
   python "C:\temp\diagnose.py"
   ```

3. **Contact support** with:
   - Logs from `agent.log`
   - Output from diagnostics
   - Windows version (winver)
   - Network details (if applicable)

---

## 🔗 Additional Resources

- [Complete Windows Installer Guide](./WINDOWS_INSTALLER_GUIDE.md)
- [Project Documentation](./PROJECT_DOCUMENTATION.md)
- [Troubleshooting Guide](./AGENT_ISSUES_FIXED.md)
- [Console](https://kuaminisystems.com/securityAgent)

---

**Last Updated**: February 3, 2026  
**Status**: ✅ Ready to Use
