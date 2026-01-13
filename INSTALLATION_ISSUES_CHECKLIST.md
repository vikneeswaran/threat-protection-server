# Installation Issues Checklist & Fix Guide

## Critical Issues to Always Consider

When creating/updating installers, ALWAYS check for and address these issues:

### ❌ Issue 1: App Bundle Not Installed to /Applications

**Symptoms:**
- Process doesn't start
- Tray icon not visible
- LaunchAgent can't find executable

**Root Causes:**
- PKG postinstall runs before app is fully installed
- Permissions issues copying app to /Applications
- Temporary root directory cleanup removes files

**Prevention:**
- ✅ Verify app exists BEFORE trying to use it in postinstall
- ✅ Don't assume hard paths - search for app
- ✅ Use `sudo cp -r` for Installation directory
- ✅ Verify permissions are correct (755 for app, 644 for contents)
- ✅ Test PKG installation locally before release

### ❌ Issue 2: Config File Not Created

**Symptoms:**
- Agent crashes on startup (no config)
- No heartbeats sent
- Registration fails

**Root Causes:**
- Config directory not created in postinstall
- Permissions prevent write to ~/.kuamini
- Owner is root instead of user

**Prevention:**
- ✅ Always create ~/.kuamini directory in postinstall
- ✅ Set proper ownership: `chown $USER:staff`
- ✅ Verify permissions: `chmod 755 ~/.kuamini`, `chmod 644 config.json`
- ✅ Create default config if not exists
- ✅ Add verification code in agent to create config if missing

### ❌ Issue 3: LaunchAgent Plist Not Installed

**Symptoms:**
- Agent doesn't auto-start on login
- Tray icon never appears
- Manual start works but auto-start fails

**Root Causes:**
- Plist not found in app bundle (build issue)
- Postinstall fails silently looking for plist
- Wrong path to executable in plist
- Plist in wrong location (need ~/Library/LaunchAgents)

**Prevention:**
- ✅ Always bundle plist in PyInstaller `datas` section
- ✅ Have fallback: generate plist dynamically if not found
- ✅ Verify plist syntax before installing
- ✅ Use correct path: `/Applications/AppName.app/Contents/MacOS/executable`
- ✅ Set proper permissions: `chmod 644 plist`
- ✅ Test LaunchAgent loading: `launchctl load ~/Library/LaunchAgents/...`

### ❌ Issue 4: Agent Process Doesn't Start

**Symptoms:**
- Icon appears briefly then disappears
- No logs generated
- Process not in `ps aux`

**Root Causes:**
- Wrong executable path in app bundle
- Missing dependencies (certifi, pystray, etc.)
- Python path issues
- CA bundle path incorrect

**Prevention:**
- ✅ Verify executable is actually executable: `chmod +x`
- ✅ Test locally: `./KuaminiSecurityClient` or `open -a /Applications/KuaminiSecurityClient.app`
- ✅ Add startup verification in main.py (checks config, paths, etc.)
- ✅ Comprehensive error logging to stderr for debugging
- ✅ Use `setup_ca_bundle()` before any network calls

### ❌ Issue 5: Endpoint Not Registering in Console

**Symptoms:**
- No heartbeat received
- Endpoint doesn't appear in console
- Config has agent_id but console shows nothing

**Root Causes:**
- Agent can't reach API (network/TLS issue)
- API endpoint has incorrect auth
- Registration happening but silently failing
- Wrong account_id in config

**Prevention:**
- ✅ Always test registration locally first
- ✅ Add detailed logging for registration requests
- ✅ Verify TLS certificates work (setup_ca_bundle())
- ✅ Check API response codes (not just success/fail)
- ✅ Ensure auto_register is true in default config
- ✅ Test registration flow end-to-end before release

### ❌ Issue 6: Tray Icon Not Appearing

**Symptoms:**
- Process running but no icon in menu bar
- Icon appears temporarily then vanishes
- No status available

**Root Causes:**
- pystray library issue
- App running as root (no GUI)
- Display server issues
- Icon file missing

**Prevention:**
- ✅ Never run agent as root (must run as user)
- ✅ Verify icon file exists in app bundle
- ✅ Test pystray initialization: add try/except with logging
- ✅ For headless systems: graceful fallback without icon
- ✅ Test on actual macOS machine (not VM sometimes works)

## Installation Verification Checklist

After each installer is built, verify:

### macOS PKG
```bash
# Extract and check contents
pkgutil --expand KuaminiSecurityClient-1.0.0.pkg /tmp/test-pkg
ls -la /tmp/test-pkg/KuaminiSecurityClient.pkg/Payload

# Verify app structure
open /Applications/KuaminiSecurityClient.app
ls -la /Applications/KuaminiSecurityClient.app/Contents/MacOS/
ls -la /Applications/KuaminiSecurityClient.app/Contents/Resources/

# Test plist exists
ls -la /Applications/KuaminiSecurityClient.app/Contents/Resources/com.kuamini.securityclient.plist

# Test config created
cat ~/.kuamini/config.json

# Test agent can run
/Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient --help

# Test manual registration
open -a /Applications/KuaminiSecurityClient.app
sleep 5
ps aux | grep KuaminiSecurityClient
```

### Windows MSI
```powershell
# Test installation
Start-Process msiexec.exe -ArgumentList "/i KuaminiSecurityClient-1.0.0.msi /quiet" -Wait

# Verify files installed
Get-ChildItem "$env:ProgramFiles\Kuamini"
Get-ChildItem "$env:APPDATA\Kuamini"

# Verify scheduled task created
Get-ScheduledTask -TaskName "KuaminiSecurityClient" -ErrorAction SilentlyContinue

# Test uninstall doesn't error
msiexec /x KuaminiSecurityClient-1.0.0.msi /quiet
```

### Linux Script
```bash
# Test installation
sudo bash KuaminiSecurityClient-1.0.0.sh

# Verify files installed
ls -la /opt/kuamini-security-client/

# Verify systemd service
sudo systemctl status kuamini-security-client

# Check if running
ps aux | grep KuaminiSecurityClient

# Check service logs
sudo journalctl -u kuamini-security-client -n 50
```

## Auto-Fix Logic to Add to Agents

All agents should include startup verification that:

1. **Checks config exists** - create default if missing
2. **Verifies API connectivity** - with detailed error logging
3. **Tests registration** - ensure agent_id obtained or in config
4. **Checks dependencies** - certifi, pystray, etc.
5. **Validates cert paths** - especially for bundled apps
6. **Creates logs directory** - with proper permissions
7. **Logs all startup steps** - for debugging installation issues

## Installer Delivery Checklist

Before releasing any installer:

- [ ] Tested installation on clean system
- [ ] Verified app appears in /Applications (macOS) or Program Files (Windows) or /opt (Linux)
- [ ] Verified config.json created with correct defaults
- [ ] Verified tray icon appears after 5-10 seconds
- [ ] Verified agent process running (ps aux/Get-Process)
- [ ] Verified endpoint appears in console within 2 minutes
- [ ] Verified uninstaller removes all traces
- [ ] Verified uninstaller deregisters from console
- [ ] Verified auto-start works after restart
- [ ] Tested on at least 2 machines per platform
- [ ] Logs capture all installation/startup diagnostics
- [ ] Error messages are user-friendly with solutions

## Future Improvement Ideas

1. **Installation Report Tool**: Create tool that captures installation state
2. **Diagnostic Bundle**: Include `diagnose-installation.sh` to check system
3. **Repair Mode**: Allow agent to repair its own installation
4. **Verbose Installer**: Add verbose logging mode to installer scripts
5. **Pre-flight Checks**: Validate system before installation begins
6. **Installation Notifications**: Show progress/status to user
7. **Rollback Support**: If postinstall fails, rollback cleanly
8. **Telemetry**: Log installation success/failure to backend
