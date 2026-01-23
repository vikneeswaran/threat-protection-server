# Kuamini Security Client - Debugging & Fix Guide

## Issues Fixed

### 1. **Systray Icon Creation Failed**
**Problem**: The agent failed to create a system tray icon, causing the entire application to crash.

**Root Causes**:
- Missing dependencies in PyInstaller `hiddenimports` configuration
- Poor error handling when pystray fails
- Missing PIL/Pillow compatibility patches

**Fixes Applied**:
1. Updated all `.spec` files to include hidden imports:
   - `pystray`, `psutil`, `PIL`, `PIL.Image`, `PIL.ImageDraw`, `requests` modules
   - All `requests` submodules needed for HTTP functionality
   
2. Improved error handling in `tray_main()`:
   - Changed from crashing to graceful fallback to background-only mode
   - Added detailed error logging with stack trace
   - Application continues operating even if systray fails

3. Enhanced icon creation error handling:
   - Better logging of icon update failures
   - Non-blocking icon operations

**Files Modified**:
- `agent-tray/KuaminiSecurityClient-win.spec`
- `agent-tray/KuaminiSecurityClient.spec`
- `agent-tray/KuaminiSecurityClient-mac.spec`
- `agent-tray/main.py` (tray_main function)

### 2. **Console Registration Failed**
**Problem**: Agent couldn't register with the console, showing missing or incorrect API endpoints.

**Root Causes**:
- Example config had wrong API endpoint (`/securityAgent/api/agent` instead of `/api/agent`)
- Missing validation of required configuration fields before registration
- Poor error messages when registration fails
- Sensitive token information being logged in full

**Fixes Applied**:
1. Fixed API endpoint in example config:
   ```json
   "api_base": "https://kuaminisystems.com/api/agent"
   ```

2. Added configuration validation in `register()` function:
   - Check for required `registration_token`
   - Check for valid `agent_id`
   - Return meaningful error messages

3. Improved registration error reporting:
   - Parse JSON error responses from server
   - Show HTTP status codes and error details
   - Log payload without exposing sensitive tokens

4. Better fallback in heartbeat:
   - Automatic re-registration on 404 errors
   - Retry logic when endpoint is lost

**Files Modified**:
- `agent-tray/config.example.json`
- `agent-tray/main.py` (register and heartbeat functions)

### 3. **Missing Default Configuration**
**Problem**: First-time installations lacked proper default configuration, especially for auto-registration.

**Root Causes**:
- `auto_register` not set in all config paths
- Config creation didn't include all necessary fields

**Fixes Applied**:
1. Added `"auto_register": true` to default config in all paths
2. Ensured consistent config structure across:
   - Initial bundled config creation
   - Fallback environment variable config
   - User directory config

**Files Modified**:
- `agent-tray/config.example.json`
- `agent-tray/main.py` (load_config, verify_installation functions)

## Deployment Instructions

### Step 1: Rebuild the Windows Client
```powershell
cd agent-tray
python -m pip install -r requirements.txt
python -m PyInstaller --clean KuaminiSecurityClient-win.spec
```

### Step 2: Create MSI Installer
```powershell
cd agent-tray/build
# Edit build-windows-msi.py to use your registration token
python build-windows-msi.py
```

### Step 3: Test Installation
```powershell
# Install the MSI
msiexec /i KuaminiSecurityClient.msi

# Check logs
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 20

# Verify process
Get-Process KuaminiSecurityClient
```

## Troubleshooting Checklist

### If Systray Icon Still Doesn't Appear:
- [ ] Check log file: `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
- [ ] Look for "Tray icon failed" or "pystray" errors
- [ ] Verify Pillow is installed: `python -m pip list | findstr Pillow`
- [ ] Check Windows theme/accessibility settings
- [ ] Try background-only mode if icon is optional

### If Registration Fails:
- [ ] Check `%LOCALAPPDATA%\.kuamini\config.json` exists
- [ ] Verify `registration_token` is present and valid
- [ ] Check logs for HTTP error codes and server responses
- [ ] Verify API endpoint is correct: `https://kuaminisystems.com/api/agent`
- [ ] Test network connectivity: `Test-NetConnection kuaminisystems.com -Port 443`

### If Heartbeat Fails (404 Not Found):
- This is expected on first run before registration
- Agent will automatically attempt re-registration
- Check logs for "Re-register result after 404"
- Once registered, heartbeats should succeed

## Log Location
Windows: `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
macOS: `~/Library/Logs/KuaminiSecurityClient/agent.log`
Linux: `~/.local/share/KuaminiSecurityClient/agent.log`

## Configuration Location
Windows: `%USERPROFILE%\.kuamini\config.json`
macOS/Linux: `~/.kuamini/config.json`

## Key Improvements

✅ **Graceful Degradation**: Application continues operating even if systray fails
✅ **Better Diagnostics**: Detailed logging with visual indicators (✓, ✗)
✅ **Error Messages**: Clear, actionable error messages for registration issues
✅ **Configuration**: Auto-registration enabled by default for smoother onboarding
✅ **Resilience**: Automatic re-registration on 404 errors during heartbeat
✅ **Security**: Sensitive tokens not logged in full payloads

## Testing Recommendations

1. **Fresh Install Test**: Install on clean machine without prior config
2. **Invalid Token Test**: Use invalid registration token, verify error message
3. **Network Failure Test**: Disconnect network during registration
4. **Heartbeat Recovery Test**: Unregister endpoint, verify auto re-registration
5. **Systray Fallback Test**: Disable display/accessibility settings, verify background mode

## Related Files
- [Installer Implementation](INSTALLER_IMPLEMENTATION.md)
- [Installation Issues Checklist](INSTALLATION_ISSUES_CHECKLIST.md)
- [Production Ready](PRODUCTION_READY.md)
