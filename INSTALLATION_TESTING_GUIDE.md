# Uninstaller and Installer Testing Guide

## Summary of Changes

### 1. Uninstaller Improvements (`uninstall-kuamini-windows.ps1`)

✅ **Endpoint Deregistration**
- Reads config.json from multiple locations
- Extracts endpoint_id and agent_id
- Calls `/api/agent/deregister` to remove endpoint from console
- Executes any cleanup commands returned by the API

✅ **Improved Folder Removal**
- Three-phase removal approach:
  1. Direct removal with attribute reset
  2. Robocopy mirror method for locked files
  3. Move to temp with scheduled deletion on reboot
- Specifically targets `C:\Program Files (x86)\Kuamini Security Client`
- Adds pending file operations to registry for reboot cleanup

### 2. MSI Build Script Improvements (`build-windows-msi.ps1`)

✅ **Registration Token Injection**
- New parameters:
  - `-RegistrationToken`: Base64-encoded registration token
  - `-ApiBase`: API endpoint (default: https://kuaminisystems.com/api/agent)
  - `-ConsoleUrl`: Console URL (default: https://kuaminisystems.com/securityAgent)
- Processes config.json and injects token before MSI compilation
- Automatically restores original config after build

✅ **Usage Example**
```powershell
.\build-windows-msi.ps1 `
    -RegistrationToken "eyJhY2NvdW50SWQiOiJjOTNmNDcyNC0zNzI3LTRhYjEtYjgzYy1hMGE5NDJhYzkyMGUiLCJhY2NvdW50TmFtZSI6IlRlc3RDbyIsInRpbWVzdGFtcCI6MTc2OTY4MjE2NjUzMH0=" `
    -Version "1.0.1"
```

### 3. API Endpoint (`/api/agent/deregister`)

✅ **New Unauthenticated Endpoint**
- Location: `app/securityAgent/api/agent/deregister/route.ts`
- Method: POST
- Accepts: `endpoint_id` or `agent_id`
- Removes endpoint from database
- Returns success even if endpoint not found (allows uninstallation to proceed)

### 4. Error Handling (`main.py`)

✅ **Enhanced Startup Error Handling**
- Emergency log file: `%LOCALAPPDATA%\KuaminiSecurityClient\startup_errors.log`
- Logs all errors before logging system is initialized
- Captures full tracebacks for debugging
- Singleton check to prevent multiple instances

---

## Testing Procedure

### Phase 1: Test Uninstaller

#### Step 1: Check Current Endpoint
1. Open console at https://kuaminisystems.com/securityAgent
2. Navigate to Endpoints section
3. Note the current endpoint details (hostname, endpoint_id)

#### Step 2: Run Uninstaller
```powershell
# Run with Admin privileges
cd C:\Users\vigne\Documents\Projects\threat-protection-agent\uninstallers
.\uninstall-kuamini-windows.ps1
```

#### Step 3: Verify Uninstallation
**Expected Results:**
- ✅ All processes terminated (KuaminiSecurityClient.exe)
- ✅ Endpoint deregistered from console (check Phase 1.5 in output)
- ✅ `C:\Program Files (x86)\Kuamini Security Client` folder removed
- ✅ Registry entries cleaned
- ✅ Scheduled tasks removed
- ✅ Startup entries removed

**Check Console:**
- Endpoint should be removed from endpoints list
- OR marked as "uninstalled" if deregistration was attempted

**Check Folder:**
```powershell
Test-Path "C:\Program Files (x86)\Kuamini Security Client"
# Should return: False
```

---

### Phase 2: Rebuild Agent with Token Injection

#### Step 1: Get Registration Token
1. Open console at https://kuaminisystems.com/securityAgent
2. Click "Register New Endpoint" or copy existing token
3. Copy the base64-encoded token (e.g., `eyJhY2NvdW50SWQiOiI...`)

#### Step 2: Rebuild PyInstaller Executable
```powershell
cd C:\Users\vigne\Documents\Projects\threat-protection-agent\agent-tray

# Activate virtual environment
& ..\.venv\Scripts\Activate.ps1

# Rebuild executable
pyinstaller KuaminiSecurityClient.spec --clean --noconfirm
```

**Verify:**
```powershell
Test-Path ".\dist\KuaminiSecurityClient\KuaminiSecurityClient.exe"
Test-Path ".\dist\KuaminiSecurityClient\_internal"
```

#### Step 3: Build MSI with Token Injection
```powershell
cd build

# Build MSI with your registration token
.\build-windows-msi.ps1 `
    -RegistrationToken "YOUR_TOKEN_HERE" `
    -Version "1.0.1"
```

**Expected Output:**
```
Building Kuamini Security Client MSI Installer...
Source files verified
Processing configuration file...
  Injected registration token
  API Base: https://kuaminisystems.com/api/agent
  Console URL: https://kuaminisystems.com/securityAgent
  Temporary config created: C:\Users\...\Temp\config_12345.json
...
Compiling WiX source...
...
MSI created successfully: ...dist\KuaminiSecurityClient-1.0.1.msi
File size: 19.57 MB
Original config file restored
Build completed successfully!
```

#### Step 4: Verify Config in MSI
```powershell
# Extract MSI contents to verify config.json
$msiPath = "..\..\public\tray\KuaminiSecurityClient-1.0.1.msi"
$extractPath = "$env:TEMP\msi-verify"

# Use msiexec to extract (requires admin)
msiexec /a $msiPath /qb TARGETDIR="$extractPath"

# Check config.json
Get-Content "$extractPath\PFiles\Kuamini Security Client\config.json" | ConvertFrom-Json
```

**Expected Config Content:**
```json
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "registration_token": "YOUR_ACTUAL_TOKEN_HERE",
  "agent_id": "<GENERATED_AGENT_ID>",
  "account_id": "<ACCOUNT_ID>",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "heartbeat_interval": 60,
  "auto_register": true
}
```

---

### Phase 3: Test Fresh Installation

#### Step 1: Install New MSI
```powershell
# Double-click the MSI or use msiexec
$msiPath = "C:\Users\vigne\Documents\Projects\threat-protection-agent\public\tray\KuaminiSecurityClient-1.0.1.msi"
Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`"" -Wait
```

**Installation Should:**
- ✅ Install to `C:\Program Files (x86)\Kuamini Security Client`
- ✅ Copy config.json with registration token
- ✅ Create registry auto-launch entry
- ✅ Create Start Menu shortcut

#### Step 2: Check Auto-Launch Registry
```powershell
$regPath = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
Get-ItemProperty $regPath -Name "KuaminiSecurityClient"
```

**Expected:**
```
KuaminiSecurityClient : C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe
```

#### Step 3: Manually Start Application
```powershell
& "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
```

**Expected:**
- ✅ System tray icon appears
- ✅ No crash or error dialogs
- ✅ Check startup errors log if issues occur:
  ```powershell
  Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\startup_errors.log"
  Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
  ```

#### Step 4: Verify Registration
Within 10 seconds:
1. Check console at https://kuaminisystems.com/securityAgent
2. Endpoint should appear in endpoints list
3. Status should be "Online" or "Registered"

**Check Agent Logs:**
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 30
```

**Expected Log Entries:**
```
[STARTUP] Agent starting...
[STARTUP] About to call tray_main()
Starting Kuamini Agent Tray
Loading config from: C:\Users\...\
Auto-registration enabled, attempting registration
✓ Auto-registration successful: {...}
✓ Heartbeat successful (HTTP 200)
```

#### Step 5: Test Reboot
```powershell
# Reboot to test auto-launch
Restart-Computer
```

**After Reboot:**
- ✅ System tray icon automatically appears
- ✅ Endpoint shows as "Online" in console
- ✅ No error dialogs or crashes
- ✅ Check `startup_errors.log` if issues occur

---

### Phase 4: Test Uninstaller Again

#### Step 1: Check Endpoint in Console
Before uninstalling, note the endpoint_id from console

#### Step 2: Uninstall
```powershell
cd C:\Users\vigne\Documents\Projects\threat-protection-agent\uninstallers
.\uninstall-kuamini-windows.ps1
```

**Watch for Phase 1.5 Output:**
```
[HH:MM:SS] Phase 1.5: Deregistering endpoint from console...
[HH:MM:SS]   Found config at: C:\Program Files (x86)\Kuamini Security Client\config.json
[HH:MM:SS]   Found endpoint_id: cb4530c0...
[HH:MM:SS]   Found agent_id: ed8ea24a...
[HH:MM:SS]   Attempting to deregister endpoint...
[HH:MM:SS]     Deregistration successful
[HH:MM:SS]   Endpoint successfully deregistered from console
```

#### Step 3: Verify Console
- Check console - endpoint should be removed from list
- No "Remove Endpoint" cleanup commands needed

#### Step 4: Verify Folder Removal
```powershell
Test-Path "C:\Program Files (x86)\Kuamini Security Client"
# Should return: False
```

---

## Troubleshooting

### Issue: Tray Icon Not Appearing

**Check Logs:**
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\startup_errors.log"
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
```

**Common Causes:**
1. **Python DLL missing**: Check if `_internal` folder was included in MSI
2. **Config file missing token**: Verify config.json has actual token
3. **Process already running**: Check Task Manager for `KuaminiSecurityClient.exe`

**Fix:**
```powershell
# Kill existing processes
taskkill /F /IM KuaminiSecurityClient.exe /T

# Check if _internal folder exists
Test-Path "C:\Program Files (x86)\Kuamini Security Client\_internal"

# Verify config has token
Get-Content "C:\Program Files (x86)\Kuamini Security Client\config.json" | ConvertFrom-Json
```

### Issue: Endpoint Not Registered

**Check:**
1. Config file has valid registration_token
2. API endpoint is reachable
3. Token is not expired

**Manual Test:**
```powershell
$config = Get-Content "C:\Program Files (x86)\Kuamini Security Client\config.json" | ConvertFrom-Json

# Test API connectivity
Invoke-RestMethod -Uri "$($config.api_base)/register" -Method POST -Body (@{
    token = $config.registration_token
    hostname = $env:COMPUTERNAME
    os = "windows"
    os_version = [System.Environment]::OSVersion.Version.ToString()
    agent_version = "tray-1.0.1"
    agent_id = $config.agent_id
} | ConvertTo-Json) -ContentType "application/json"
```

### Issue: Folder Not Removed After Uninstall

**Manual Removal:**
```powershell
# Method 1: Reset attributes and force delete
Get-ChildItem "C:\Program Files (x86)\Kuamini Security Client" -Recurse -Force | ForEach-Object { $_.Attributes = "Normal" }
Remove-Item "C:\Program Files (x86)\Kuamini Security Client" -Recurse -Force

# Method 2: Robocopy mirror
$emptyDir = "$env:TEMP\empty-$(Get-Random)"
New-Item -ItemType Directory $emptyDir | Out-Null
robocopy $emptyDir "C:\Program Files (x86)\Kuamini Security Client" /MIR
Remove-Item "C:\Program Files (x86)\Kuamini Security Client" -Recurse -Force
Remove-Item $emptyDir -Force

# Method 3: Reboot and delete
# The uninstaller should have scheduled deletion on reboot
Restart-Computer
```

### Issue: Unhandled Script Error on Reboot

**Check Startup Errors:**
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\startup_errors.log"
```

**Common Causes:**
1. Python runtime not found
2. Missing dependencies
3. Config file corrupted

**Fix:**
```powershell
# Verify Python runtime exists
Test-Path "C:\Program Files (x86)\Kuamini Security Client\_internal\python314.dll"

# Reinstall if missing
$msiPath = "C:\Users\vigne\Documents\Projects\threat-protection-agent\public\tray\KuaminiSecurityClient-1.0.1.msi"
msiexec /i $msiPath /qn /norestart
```

---

## Success Criteria

### Uninstaller
- [ ] Endpoint deregistered from console automatically
- [ ] All folders removed (no manual cleanup needed)
- [ ] No registry entries remain
- [ ] No scheduled tasks remain
- [ ] No startup entries remain
- [ ] No processes running after uninstall

### MSI Installation
- [ ] Config.json has actual registration token (not placeholder)
- [ ] Application starts on installation
- [ ] System tray icon appears
- [ ] Endpoint registers automatically
- [ ] Heartbeat established within 60 seconds
- [ ] Application auto-starts on reboot
- [ ] No error dialogs or crashes

### Error Handling
- [ ] Startup errors logged to `startup_errors.log`
- [ ] Application errors logged to `agent.log`
- [ ] Emergency logging works even when logging system fails
- [ ] Graceful degradation if tray icon creation fails

---

## Next Steps

1. **Test Phase 1**: Run uninstaller on current installation
2. **Test Phase 2**: Rebuild MSI with token
3. **Test Phase 3**: Clean install from new MSI
4. **Test Phase 4**: Verify reboot auto-launch
5. **Test Phase 5**: Uninstall and verify deregistration

Report any issues with:
- Error messages from console output
- Log file contents (`startup_errors.log` and `agent.log`)
- Screenshots of any error dialogs
- Endpoint status in console
