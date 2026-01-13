# Agent Installation & Troubleshooting Guide

## Issue Summary

When installing the latest macOS PKG installer:
- ❌ Status and tray icons are not created
- ❌ Endpoint is not appearing in console
- ✅ Installation completes without errors (PKG installs successfully)

## Root Causes Fixed

### 1. **PyInstaller Data Bundle Path** ✅ FIXED
**Problem:** The LaunchAgent plist was bundled to the wrong location in the app
- Was: `KuaminiSecurityClient.app/Contents/` (root)
- Should be: `KuaminiSecurityClient.app/Contents/Resources/` (standard macOS location)

**Fix Applied:**
- Updated `KuaminiSecurityClient.spec` line 7 to place plist in `Resources` folder

### 2. **Missing Configuration** ✅ FIXED
**Problem:** If config.json wasn't downloaded from the API, agent had nothing to connect with
- Postinstall script would fail silently if download failed
- No fallback configuration was created
- Agent couldn't register without config

**Fix Applied:**
- Updated postinstall script to always create default `config.json`
- Added fallback values:
  - `api_base`: https://kuaminisystems.com/api/agent
  - `console_url`: https://kuaminisystems.com/securityAgent
  - `auto_register`: true (enables automatic registration)
  - `heartbeat_interval`: 60 seconds
- Merges downloaded config with defaults if available

### 3. **Agent Auto-Registration Not Enabled** ✅ FIXED
**Problem:** Agent wouldn't auto-register even if configured
- Config wasn't setting `auto_register` to `true`
- Agent would sit idle waiting for manual registration

**Fix Applied:**
- Postinstall script now ensures `auto_register: true` in config
- Agent checks this flag on startup and auto-registers if available

### 4. **LaunchAgent Missing Logging Output** ✅ FIXED
**Problem:** Debugging was difficult without seeing agent output
- No logs from LaunchAgent launch failures
- Silent crashes were undetectable

**Fix Applied:**
- Added `StandardOutPath` and `StandardErrorPath` to plist
- Logs now go to `/tmp/kuamini-stdout.log` and `/tmp/kuamini-stderr.log`

## Installation & Validation Steps

### Step 1: Rebuild the Agent
```bash
cd agent-tray
# Clean previous builds
rm -rf dist build/KuaminiSecurityClient.app

# Run PyInstaller with updated spec
pyinstaller --clean KuaminiSecurityClient.spec

# Build the PKG
bash build/pkgbuild-mac.sh

# You should now have:
# dist/KuaminiSecurityClient.app/
# dist/KuaminiSecurityClient-1.0.0.pkg
```

### Step 2: Install the New PKG
```bash
sudo /usr/sbin/installer -pkg agent-tray/dist/KuaminiSecurityClient-1.0.0.pkg -target /
```

### Step 3: Verify Installation
```bash
# Run the diagnostic script
bash debug-agent-macos.sh
```

This will check:
- ✅ App installation
- ✅ LaunchAgent plist location and format
- ✅ Configuration file
- ✅ Running processes
- ✅ LaunchAgent loaded status
- ✅ Logs
- ✅ Network connectivity

### Step 4: Manual Steps If Needed

**If tray icon still doesn't appear:**
```bash
# 1. Check if LaunchAgent is loaded
launchctl list | grep com.kuamini

# 2. If not loaded, load it manually
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# 3. Check the process is running
ps aux | grep KuaminiSecurityClient

# 4. View LaunchAgent logs
cat /tmp/kuamini-stdout.log
cat /tmp/kuamini-stderr.log
```

**If endpoint still doesn't appear in console:**
```bash
# 1. Check config file
cat ~/.kuamini/config.json

# Should contain:
# - "registration_token" (if provided by installer)
# - "api_base": "https://kuaminisystems.com/api/agent"
# - "auto_register": true

# 2. Check agent logs
tail -50 ~/Library/Logs/KuaminiSecurityClient/agent.log

# 3. Manually trigger registration from tray icon
# - Right-click tray icon
# - Select "Register now"
# - Check logs for response

# 4. Send heartbeat manually
# - Right-click tray icon
# - Select "Send heartbeat"
# - Check logs for response
```

**If network connectivity is the issue:**
```bash
# Test API connectivity
curl -v https://kuaminisystems.com/api/agent/health

# If behind proxy, you may need to configure curl:
# Create ~/.curlrc with:
# proxy = [proxy_url]:[proxy_port]
```

## Configuration File Reference

After installation, you should have `~/.kuamini/config.json`:

```json
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "agent_id": "uuid-generated-on-first-run",
  "account_id": "uuid-from-registration-token",
  "registration_token": "base64-token-from-installer",
  "auto_register": true,
  "heartbeat_interval": 60
}
```

**Key fields:**
- `api_base` - API endpoint for registration/heartbeat
- `console_url` - Web console URL
- `agent_id` - Unique agent identifier (auto-generated)
- `account_id` - Your organization account ID
- `registration_token` - Token from installer (enables auto-registration)
- `auto_register` - If true, agent registers automatically on startup
- `heartbeat_interval` - Seconds between heartbeat messages

## Expected Behavior After Fix

1. **Install PKG**
   ```
   sudo /usr/sbin/installer -pkg KuaminiSecurityClient-1.0.0.pkg -target /
   ```

2. **Postinstall script runs:**
   - Creates config.json with defaults
   - Downloads account-specific config if KUAMINI_INSTALL_URL provided
   - Installs LaunchAgent plist to correct location
   - Loads LaunchAgent for current user
   - Prints completion message

3. **Agent starts automatically:**
   - LaunchAgent loads agent at login (or immediately if already logged in)
   - Agent reads config.json
   - Sees `auto_register: true`
   - Sends registration request with embedded token
   - Shows green tray icon with "Online" status

4. **Endpoint appears in console within 60 seconds:**
   - Agent sends first heartbeat
   - Console receives heartbeat
   - Endpoint appears in Endpoints list with "Online" status
   - Hostname, OS, IP address are populated

## Debug Files & Logs

### Log Locations

```
~/Library/Logs/KuaminiSecurityClient/agent.log     # Main agent log
/tmp/kuamini-stdout.log                             # LaunchAgent stdout
/tmp/kuamini-stderr.log                             # LaunchAgent stderr
~/.kuamini/config.json                              # Configuration
~/Library/LaunchAgents/com.kuamini.securityclient.plist  # LaunchAgent plist
/Applications/KuaminiSecurityClient.app/            # App installation
```

### Enable Verbose Logging

To get more detailed logs, you can set environment variables before running:

```bash
# Run agent with verbose output directly
export LOG_LEVEL=DEBUG
/Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient
```

## Verification Checklist

- [ ] PKG installed without errors
- [ ] `/Applications/KuaminiSecurityClient.app` exists
- [ ] `~/Library/LaunchAgents/com.kuamini.securityclient.plist` exists
- [ ] `~/.kuamini/config.json` exists with proper values
- [ ] `auto_register` is `true` in config
- [ ] LaunchAgent is loaded: `launchctl list | grep com.kuamini`
- [ ] Agent process running: `ps aux | grep KuaminiSecurityClient`
- [ ] Tray icon visible in menu bar (green = online, red = offline)
- [ ] Logs exist and show registration messages
- [ ] Can reach API: `curl https://kuaminisystems.com/api/agent/health`
- [ ] Endpoint appears in console within 2 minutes

## If Issues Persist

1. **Run diagnostic script:**
   ```bash
   bash debug-agent-macos.sh
   ```

2. **Check logs for errors:**
   ```bash
   tail -100 ~/Library/Logs/KuaminiSecurityClient/agent.log
   cat /tmp/kuamini-stdout.log
   cat /tmp/kuamini-stderr.log
   ```

3. **Check LaunchAgent is correct:**
   ```bash
   cat ~/Library/LaunchAgents/com.kuamini.securityclient.plist
   ```

4. **Manually try starting agent:**
   ```bash
   /Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient
   ```

5. **Check console logs for API errors:**
   ```bash
   # From console web UI:
   # Go to Settings > Audit Logs
   # Look for registration or heartbeat failures
   ```

## Next Rebuild Instructions

When rebuilding the installers through GitHub Actions:

1. ✅ PyInstaller will use updated spec file (plist in Resources)
2. ✅ PKG postinstall will use updated script (default config)
3. ✅ New PKG will be automatically uploaded to `public/tray/`
4. ✅ Deployments will include fixed installers

**No further changes needed** - just push to trigger GitHub Actions build.

## Related Files Changed

- `agent-tray/KuaminiSecurityClient.spec` - Fixed plist bundle path
- `agent-tray/build/scripts/postinstall` - Enhanced config creation
- `agent-tray/build/autostart/macos/com.kuamini.securityclient.plist` - Added logging
- `debug-agent-macos.sh` - New diagnostic script

---

**Last Updated:** January 13, 2026
**Status:** All fixes implemented and ready for testing
