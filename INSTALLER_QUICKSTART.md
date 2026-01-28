# Quick Start: Building Kuamini Security Client Installer

## Prerequisites Check

```powershell
# 1. Verify Python installed
python --version
# Expected: Python 3.9 or higher

# 2. (Optional) Check if NSIS installed
Test-Path "C:\Program Files (x86)\NSIS\makensis.exe"
# True = Full installer, False = Portable ZIP only
```

## Build Commands

### Standard Build (No Registration Token)

```powershell
# From project root
npm run build:installer

# Or manually
cd agent-tray\build
.\create-installer.ps1
```

**Output:** Agent will need manual registration after install

### Build with Registration Token (Recommended)

```powershell
# Build with auto-registration
cd agent-tray\build
.\create-installer.ps1 -RegistrationToken "your-base64-encoded-token-here"
```

**Output:** Agent auto-registers on first launch

### Full Custom Build

```powershell
.\create-installer.ps1 `
    -RegistrationToken "abc123..." `
    -ApiBase "https://yourdomain.com/api/agent" `
    -ConsoleUrl "https://yourdomain.com/console" `
    -Version "1.0.0"
```

## Expected Output

### With NSIS:
```
public/
  tray/
    KuaminiSecurityClient-installer.exe  ← Distribute this
```

### Without NSIS:
```
public/
  tray/
    KuaminiSecurityClient-portable.zip  ← Distribute this
```

## Testing the Installer

### 1. Test Build Locally

```powershell
# Run the executable directly (no install)
cd agent-tray\dist\KuaminiSecurityClient
.\KuaminiSecurityClient.exe

# Check if tray icon appears
# Check logs: $env:LOCALAPPDATA\KuaminiSecurityClient\agent.log
```

### 2. Test Full Installation

```powershell
# Run the installer
.\public\tray\KuaminiSecurityClient-installer.exe

# Verify installation
Test-Path "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"  # Should be True

# Check if running
Get-Process -Name "KuaminiSecurityClient"  # Should show process

# Check startup entry
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient"
```

### 3. Verify Registration

```powershell
# Check config has endpoint_id (means registered)
Get-Content "$env:USERPROFILE\.kuamini\config.json" | ConvertFrom-Json | Select-Object endpoint_id

# Check logs for registration success
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" | Select-String -Pattern "Registration"
```

## Distribution Workflow

### For Single Account (Pre-configured)

```powershell
# 1. Get registration token from console
$token = "account-specific-token-from-console"

# 2. Build installer with token
.\create-installer.ps1 -RegistrationToken $token

# 3. Distribute installer
# public/tray/KuaminiSecurityClient-installer.exe

# 4. User installs → Agent auto-registers to your account
```

### For Multiple Accounts (Generic)

```powershell
# 1. Build without token
.\create-installer.ps1

# 2. Distribute installer
# public/tray/KuaminiSecurityClient-installer.exe

# 3. User installs → Manual registration required
# Or configure token via console after install
```

## Common Scenarios

### Scenario 1: IT Department Rollout

**Goal:** Deploy to 100 workstations in Company XYZ

```powershell
# 1. Build with company registration token
.\create-installer.ps1 -RegistrationToken "company-xyz-token"

# 2. Deploy via Group Policy, SCCM, or manual install
# All machines auto-register to Company XYZ account

# 3. Verify in console
# All 100 endpoints appear in dashboard
```

### Scenario 2: MSP Multi-Tenant

**Goal:** Deploy to different clients with different accounts

```powershell
# For Client A
.\create-installer.ps1 -RegistrationToken "client-a-token"
Rename-Item "public/tray/KuaminiSecurityClient-installer.exe" "KuaminiSecurityClient-ClientA.exe"

# For Client B
.\create-installer.ps1 -RegistrationToken "client-b-token"
Rename-Item "public/tray/KuaminiSecurityClient-installer.exe" "KuaminiSecurityClient-ClientB.exe"

# Distribute appropriate installer to each client
```

### Scenario 3: SaaS Self-Service

**Goal:** Users download and install themselves

```powershell
# 1. Build generic installer
.\create-installer.ps1

# 2. Host on website
# https://yourdomain.com/downloads/install.exe

# 3. User flow:
#    a. User signs up on console
#    b. Console generates registration token
#    c. User downloads installer
#    d. User runs installer
#    e. User configures token manually OR
#    f. Console provides one-click registration link
```

## Troubleshooting Builds

### Python Dependencies Failed

```powershell
# Manual dependency install
python -m pip install --upgrade pip
python -m pip install pyinstaller pillow pystray psutil requests
```

### PyInstaller Build Failed

```powershell
# Clean and rebuild
Remove-Item agent-tray\dist -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item agent-tray\build -Recurse -Force -ErrorAction SilentlyContinue
.\create-installer.ps1
```

### NSIS Not Found

```powershell
# Download and install NSIS
# https://nsis.sourceforge.io/Download

# Or use portable ZIP instead
# The script will automatically fall back to ZIP if NSIS not found
```

### Config.json Not Generated

```powershell
# Manually generate
python agent-tray\generate_config.py

# Or create manually
@{
    api_base = "https://kuaminisystems.com/api/agent"
    console_url = "https://kuaminisystems.com/securityAgent"
    agent_id = [System.Guid]::NewGuid().ToString()
    heartbeat_interval = 60
    auto_register = $true
} | ConvertTo-Json | Out-File "agent-tray\config.json" -Encoding UTF8
```

## Verification Checklist

After building, verify:

- [ ] Installer/ZIP exists in `public/tray/`
- [ ] Executable size is reasonable (10-50 MB)
- [ ] Can extract/run without errors
- [ ] Tray icon appears when run
- [ ] Registration succeeds (if token configured)
- [ ] Heartbeats sent successfully
- [ ] Logs show no errors
- [ ] Autostart entry created
- [ ] Uninstaller works properly

## Next Steps

1. **Test thoroughly** on clean Windows VM
2. **Document** any custom configuration for end users
3. **Distribute** via your preferred method
4. **Monitor** agent registration in console
5. **Support** users with installation issues

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run build:installer` | Build installer (no token) |
| `.\create-installer.ps1` | Build installer manually |
| `.\create-installer.ps1 -RegistrationToken "..."` | Build with token |
| `Get-Process KuaminiSecurityClient` | Check if running |
| `Get-Content $env:LOCALAPPDATA\KuaminiSecurityClient\agent.log` | View logs |
| `.\uninstall-kuamini-windows.ps1` | Clean uninstall |

## Support

- **Logs:** `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
- **Config:** `%USERPROFILE%\.kuamini\config.json`
- **Install Dir:** `C:\Program Files\Kuamini Security Client`
- **Uninstaller:** `uninstallers/uninstall-kuamini-windows.ps1`
