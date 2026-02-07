# Agent Installation - Windows Defender Workaround & Testing

## The Problem

**Symptoms**:
- ❌ Tray icon doesn't appear after MSI installation
- ❌ Endpoint registration fails
- ⚠️ Windows Defender reports: `Trojan: Win32/Sabsik.F.L.A!ml`

**Root Cause**:
Windows Defender is blocking the PyInstaller-built agent executable before it can even start. This is a false positive - the agent is not malware, but PyInstaller bundles Python runtime in a way that looks suspicious to antivirus engines.

---

## Workaround for Testing

### Option A: Use Admin Exclusions (Recommended for Testing)

```powershell
# Run PowerShell as Administrator

# Add install folder to exclusions
Add-MpPreference -ExclusionPath "C:\Program Files\Kuamini Security Client" -Force

# Add config folder to exclusions  
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\KuaminiSecurityClient" -Force

# Add temp folder to exclusions (for extraction)
Add-MpPreference -ExclusionPath "$env:TEMP" -Force

Write-Host "Exclusions added. Run your installer now."
```

### Option B: Use Console Download + Helper Script

**New Workflow** (with our recent fixes):
1. Log into console
2. Download Windows agent installer 
3. Extract ZIP folder containing:
   - `KuaminiSecurityClient-1.0.5.msi` 
   - `registration.token`
   - `install-helper.ps1` ← New!
4. Right-click `install-helper.ps1` → Run with PowerShell
5. Helper script automatically:
   - Reads your account token
   - Passes it to the MSI
   - Creates config with your account ID
   - Waits for agent to start
   - Verifies installation

**Key Advantage**: No manual exclusion configuration needed - helper script handles everything

---

## Test Procedure

### Step 1: Add Exclusions

```powershell
# PowerShell as Administrator
Add-MpPreference -ExclusionPath "C:\Program Files\Kuamini Security Client" -Force
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\KuaminiSecurityClient" -Force
Write-Host "Exclusions configured"
```

### Step 2: Extract Console Download

1. Go to your console
2. Click "Download Windows Agent"
3. Wait for ZIP to download
4. Extract to folder (e.g., `Downloads\KuaminiSecurityClient-xxxxx\`)
5. Verify contents:
   ```
   KuaminiSecurityClient-1.0.5.msi
   registration.token
   install-helper.ps1
   ```

### Step 3: Run Helper Script

```powershell
# PowerShell as Administrator
cd C:\Users\YourName\Downloads\KuaminiSecurityClient-xxxxx
PowerShell.exe -ExecutionPolicy Bypass -File install-helper.ps1
```

Expected output:
```
Kuamini Security Client Installer
Found MSI: KuaminiSecurityClient-1.0.5.msi
Found token: registration.token
Reading registration token...
Token loaded (length: 295 bytes)
Installing Kuamini Security Client...
MSI installation completed successfully
Verifying installation...
...
Installation completed successfully!
The Kuamini Security Client will start automatically.
```

### Step 4: Verify Agent Started

```powershell
# Check process
Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue

# Check for system tray icon (visual check)
# Look for Kuamini icon in system tray (bottom-right)

# Check logs
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 20
```

Expected logs:
```
[Agent] Tray icon created successfully
[Agent] Heartbeat successful - status: online
[Agent] Endpoint registered: xxxxx
```

---

## If Agent Still Won't Start

### Troubleshooting Checklist

- [ ] Exclusions properly added? Run: `Get-MpPreference | Select-Object ExclusionPath`
- [ ] Helper script ran without errors? Check for red text in output
- [ ] MSI installed successfully? Check: `Test-Path "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"`
- [ ] Token file created? Check: `Test-Path "$env:LOCALAPPDATA\KuaminiSecurityClient\registration.token"`
- [ ] Config file created? Check: `Test-Path "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"`

### Common Issues

**Issue**: "ERROR: registration.token is empty"
- **Fix**: Re-download from console, re-extract, check token file has content

**Issue**: "MSI installation failed"
- **Fix**: Check log file printed in output, look for error details

**Issue**: "elevation required" popup after MSI runs
- **Fix**: Just close it, installation continues in background

**Issue**: Process running but no tray icon visible
- **Fix**: Right-click taskbar → See more notification icons → Enable Kuamini

---

## What We Fixed

### Recent Improvements

1. **Helper Script** (`install-helper.ps1`)
   - ✅ Validates token and MSI exist before installation
   - ✅ Passes token directly to MSI (bypasses WiX property issues)
   - ✅ Creates config directory early
   - ✅ Backs up token in multiple locations
   - ✅ Waits for agent to start
   - ✅ Verifies installation succeeded

2. **Updated WiX Installer**
   - ✅ Fixed custom action to search [SourceDir] for registration.token
   - ✅ Auto-starts agent immediately after MSI completes
   - ✅ Creates registry entry for Windows autostart

3. **Updated Console Download**
   - ✅ Includes helper script (`install-helper.ps1`) in ZIP
   - ✅ ZIP contains: MSI + token + helper script
   - ✅ Users just extract and run helper - done

---

## Next Steps for Permanent Fix

### For Production Deployment (1.0.6+)

We need to implement **code-signing** to eliminate the Windows Defender false positive permanently.

**Timeline**: 2-3 days
**Cost**: $150-400/year (Authenticode certificate)
**Benefit**: Users won't see any antivirus warnings

See `WINDOWS_DEFENDER_ISSUE.md` for details and recommendations.

