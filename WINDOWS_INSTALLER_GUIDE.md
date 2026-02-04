# Windows Installer & Uninstaller - Implementation Guide

**Last Updated**: February 3, 2026
**Status**: ✅ Ready for Production Testing

---

## 🎯 Overview

This guide provides complete instructions for deploying and using the new robust Windows installer and uninstaller for Kuamini Security Client. These tools handle all installation states (valid, partial, corrupt, failed, absent) and properly manage endpoint registration with the console.

---

## 📦 Components Delivered

### 1. **Robust Windows Uninstaller** (`uninstallers/uninstall-kuamini-windows-robust.ps1`)
- Handles detection of existing installations in multiple locations
- Attempts API deregistration (doesn't fail if offline)
- Terminates all agent processes
- Cleans registry entries (Run key, Kuamini HKCR/HKLM keys)
- Removes all files (with robocopy fallback for locked files)
- Validates complete removal

### 2. **Windows Installer Wrapper** (`agent-tray/install-kuamini-windows.ps1`)
- Downloads MSI with embedded account details
- Creates initial configuration file
- Executes MSI installation
- Verifies installation success
- Waits for endpoint registration in console
- Handles all error scenarios gracefully

### 3. **Windows Installer API Endpoint** (`app/api/agent/installers/windows/route.ts`)
- `GET /api/agent/installers/windows?token=TOKEN&accountId=ID`
- Serves pre-built MSI with token embedded
- Future-proof for on-demand MSI generation
- Logs downloads for audit trail

### 4. **Console Download Endpoint** (`app/api/agent/installers/download/route.ts`)
- `GET /api/agent/installers/download?platform=windows&accountId=ID`
- Used by the "Download Installer" button in the console UI
- For Windows, triggers an on-demand MSI build if a tokenized MSI is not present
- Tokenized MSI is stored as `public/tray/KuaminiSecurityClient-<accountId>.msi`

### 4. **Enhanced Agent Code** (`agent-tray/main.py`)
- **Better Windows path detection**: Prioritizes `%LOCALAPPDATA%\KuaminiSecurityClient\` on Windows
- **Improved token handling**: Checks both `registration.token` and `registration_token.txt`
- **CA bundle improvements**: Better handling for PyInstaller bundles
- **Windows-specific config directory**: Uses proper Windows paths

---

## 🚀 Deployment Steps

### Step 1: Rebuild Windows Agent (One-Time)

```powershell
cd agent-tray

# Clean previous build
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue

# Build executable with PyInstaller
pyinstaller KuaminiSecurityClient-win.spec

# Build MSI (requires WiX Toolset 3.14 installed)
.\build\build-windows-msi.ps1 -RegistrationToken "placeholder-token" -Version "1.0.0"

# Output: dist\KuaminiSecurityClient-1.0.0.msi
# Copy to public/tray/ for distribution:
Copy-Item "dist\KuaminiSecurityClient-1.0.0.msi" -Destination "..\public\tray\"
```

### Step 2: Deploy Updated Agent Code

```bash
# Commit the changes
git add agent-tray/main.py app/api/agent/installers/windows/route.ts
git commit -m "feat: Enhanced Windows installer/uninstaller with robust error handling"
git push origin main

# Vercel will auto-deploy
```

### Step 3: Manual Uninstallation from Infected Endpoint

If an endpoint has the old agent installed:

```powershell
# Open PowerShell as Administrator on the Windows endpoint
# Option A: Use uninstall script directly
Invoke-WebRequest -Uri "https://kuaminisystems.com/api/agent/uninstallers/windows" `
  -OutFile "C:\temp\uninstall-kuamini.ps1"

Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
& "C:\temp\uninstall-kuamini.ps1" -Force

# Option B: Manual uninstall if script unavailable
# Copy uninstall-kuamini-windows-robust.ps1 to endpoint and execute
# It will handle all cleanup automatically
```

### Step 4: Fresh Installation

Users can install via two methods:

#### **Method A: Interactive Installation (Recommended)**

1. Log into Kuamini Console: `https://kuaminisystems.com/securityAgent`
2. Go to **Installers** → **Windows**
3. Click "Download Installer"
4. The console generates an account-specific MSI (may take ~30-60 seconds on first request)
5. Run: `msiexec /i KuaminiSecurityClient-<accountId>.msi`
6. Agent starts automatically and registers with console

#### **Method B: Scripted Installation**

```powershell
# On Windows endpoint (as Administrator)
$token = "eyJ...base64-or-jwt-token...QI="  # From console
$accountId = "12345678-abcd-..."

# Download and run installer wrapper
Invoke-WebRequest -Uri "https://kuaminisystems.com/agent-tray/install-kuamini-windows.ps1" `
  -OutFile "C:\temp\install-kuamini.ps1"

Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

# Run installer with account details
& "C:\temp\install-kuamini.ps1" -Token $token -AccountId $accountId
```

---

## 🔍 Installation File Locations

| Component | Windows Path | Purpose |
|-----------|--------------|---------|
| **Executable** | `C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe` | Main agent |
| **Config** | `%LOCALAPPDATA%\KuaminiSecurityClient\config.json` | Runtime configuration |
| **Logs** | `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log` | Agent logs |
| **Registry** | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` | Autostart entry |
| **Token File** | `C:\Program Files\...\registration.token` | Embedded during install (consumed on first run) |

---

## 📋 Configuration File Format

After installation, `%LOCALAPPDATA%\KuaminiSecurityClient\config.json` contains:

```json
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_id": "660e8400-e29b-41d4-a716-446655440001",
  "registration_token": "base64-or-jwt-token",
  "heartbeat_interval": 60,
  "auto_register": true
}
```

**Key Fields**:
- `agent_id`: Generated once during install, persists forever (UUID v4)
- `account_id`: Decoded from registration token
- `registration_token`: Embedded during MSI build
- `heartbeat_interval`: 60 seconds (configurable)
- `auto_register`: Automatic registration on startup

---

## 🔐 Security Features

### Token Handling
- Registration token is **NOT** stored as plaintext in installer script
- Token is **embedded in MSI** during build process
- Token file (`registration.token`) is **deleted after first use**
- Sensitive data hidden in logs (masked with `***`)

### Account Isolation
- Tokens contain Base64-encoded account information
- Endpoints can only register to their assigned account
- Cross-account registration is blocked by API

### Secure Communication
- All API calls use HTTPS (TLS 1.2+)
- Certificate validation enabled
- Service role keys used for agent authentication

---

## 🛠️ Troubleshooting

### Issue: Uninstaller Won't Remove All Files

**Solution**: Files may be locked by running processes.

```powershell
# Force terminate all processes
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Run uninstaller with -Force flag
.\uninstall-kuamini-windows-robust.ps1 -Force

# Reboot if files still locked
Restart-Computer
```

### Issue: Agent Won't Start After Installation

**Check logs**:
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 50
```

**Common causes**:
1. Config file missing → created automatically on first run
2. Registration token invalid → check `config.json` for token
3. Tray icon creation failed → check for PIL/pystray errors
4. Port already in use → unlikely, unrelated to agent

### Issue: Endpoint Not Appearing in Console After Installation

**Steps to debug**:
1. Wait 60 seconds (heartbeat interval)
2. Check agent logs: `Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"`
3. Verify network connectivity: `ping kuaminisystems.com`
4. Check firewall rules (agent needs HTTPS outbound to kuaminisystems.com)
5. Verify account has available licenses (Free tier: max 5 endpoints)

### Issue: Reinstalling After Uninstall Fails

**Cause**: Old installation files may still exist.

```powershell
# Manual cleanup
Remove-Item "C:\Program Files\Kuamini Security Client" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\KuaminiSecurityClient" -Recurse -Force -ErrorAction SilentlyContinue

# Clean registry
# HKLM\Software\Kuamini
# HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\KuaminiSecurityClient

# Then retry installation
```

---

## 📊 Comparison with macOS

| Feature | Windows | macOS |
|---------|---------|-------|
| **Installer** | MSI (signed) | PKG (signed) |
| **Auto-start** | Windows Scheduled Task | LaunchDaemon |
| **Config Path** | `%LOCALAPPDATA%\...` | `~/.kuamini/` |
| **Uninstaller** | PowerShell script | Bash script |
| **Registry** | Supported | N/A |
| **CA Bundle** | System defaults | Bundled in .app |

---

## 🧪 Testing Checklist

### Pre-Installation Tests
- [ ] MSI file exists in `public/tray/`
- [ ] MSI is digitally signed (Windows Authenticode)
- [ ] MD5/SHA256 checksum verified
- [ ] Download from API endpoint works

### Installation Tests
- [ ] MSI installation completes without errors
- [ ] Executable found in `C:\Program Files\Kuamini Security Client\`
- [ ] Config file created in `%LOCALAPPDATA%\KuaminiSecurityClient\`
- [ ] Autostart registry entry created
- [ ] Agent tray icon appears (within 30-60 seconds)
- [ ] Endpoint appears in console (within 2 minutes)

### Runtime Tests
- [ ] Heartbeat succeeds (check logs every 60s)
- [ ] Policies sync correctly
- [ ] Threat reporting works
- [ ] Agent survives system reboot

### Uninstallation Tests
- [ ] Uninstaller runs without errors
- [ ] All files removed
- [ ] Registry entries cleaned
- [ ] Endpoint removed from console (within 60 seconds)
- [ ] Reinstallation works cleanly

---

## 🚦 Rollback Plan

If issues occur:

1. **Pause new deployments**
   - Stop directing users to new installer URL

2. **Affected endpoints**
   ```powershell
   # Remote uninstall all endpoints
   Invoke-Command -ComputerName endpoint-01 -ScriptBlock {
     & "C:\temp\uninstall-kuamini-windows-robust.ps1" -Force
   }
   ```

3. **Restore previous agent version**
   - Use MSI from previous build
   - Point installer API to old MSI

4. **Investigate root cause**
   - Check logs, API responses
   - Update code and rebuild

---

## 📞 Support

### For Installation Issues:
1. Check agent logs: `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
2. Run diagnostic: `agent-diagnostics.py`
3. Contact support with logs

### For Uninstallation Issues:
1. Run uninstaller with `-Verbose` flag
2. Check MSI uninstall log: `%TEMP%\install.log`
3. Manual cleanup if automated fails

---

## 🔗 Related Documentation

- [Windows Agent Code](../agent-tray/main.py)
- [Windows Uninstaller](../uninstallers/uninstall-kuamini-windows-robust.ps1)
- [Windows Installer Wrapper](../agent-tray/install-kuamini-windows.ps1)
- [API Endpoint](../app/api/agent/installers/windows/route.ts)
- [Build System](../agent-tray/build/build-windows-msi.ps1)
- [Project Documentation](./PROJECT_DOCUMENTATION.md)

---

## ✅ Sign-Off

- **Implementation**: ✅ Complete
- **Testing**: ⏳ Pending
- **Documentation**: ✅ Complete
- **Code Review**: ⏳ Pending
- **Production Deployment**: ⏳ Ready

Last verified: **February 3, 2026**
