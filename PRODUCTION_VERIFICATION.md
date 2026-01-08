# Production Verification Guide

## Overview
This document provides step-by-step instructions to verify the complete installation, registration, uninstallation, and deregistration flow in the production environment.

## Prerequisites
- Production API server running (https://kuaminisystems.com)
- Valid registration token for test account
- macOS endpoint for testing
- Access to production console

## Test Scenario: Complete Lifecycle

### Phase 1: Installation & Registration

#### Step 1.1: Download Installer
```bash
# Visit the production console and click "Download for macOS"
# Or download directly:
curl -o ~/Downloads/KuaminiSecurityClient-1.0.0.pkg \
  "https://yourdomain.com/api/agent/installers/download?platform=macos&accountId=YOUR_ACCOUNT_ID"
```

**Verification:**
- [ ] PKG file downloads successfully (should be ~20MB)
- [ ] PKG includes valid app bundle with LaunchAgent plist
- [ ] PKG has embedded registration token in config

#### Step 1.2: Install Application
```bash
sudo installer -pkg ~/Downloads/KuaminiSecurityClient-1.0.0.pkg -target /
```

**Verification:**
- [ ] Installation completes without errors
- [ ] App appears at `/Applications/KuaminiSecurityClient.app`
- [ ] Config file created at `~/.kuamini/config.json`
- [ ] Config contains `api_base`, `agent_id`, and `registration_token`
- [ ] LaunchAgent plist installed at `~/Library/LaunchAgents/com.kuamini.securityclient.plist`

#### Step 1.3: Verify Agent Startup
```bash
# Check if agent process is running
ps aux | grep KuaminiSecurityClient | grep -v grep

# Check logs
tail -50 ~/Library/Logs/KuaminiSecurityClient/agent.log
```

**Verification:**
- [ ] KuaminiSecurityClient process running
- [ ] Logs show "Status changed: Registering..."
- [ ] Logs show "Auto-registration successful"
- [ ] Logs show "Status changed: Online"
- [ ] Green tray icon visible in menu bar
- [ ] Status shows "Online"

#### Step 1.4: Verify Console Registration
1. Log into production console
2. Navigate to "Endpoints" or "Devices" section
3. Find your test endpoint by hostname

**Verification:**
- [ ] Endpoint appears in console with correct hostname
- [ ] Endpoint status shows "Online"
- [ ] Agent ID matches config file
- [ ] OS shows "macOS"
- [ ] Last seen timestamp is recent

---

### Phase 2: Heartbeat Verification

#### Step 2.1: Monitor Heartbeats
```bash
# Watch logs for heartbeat activity
tail -f ~/Library/Logs/KuaminiSecurityClient/agent.log | grep -i heartbeat
```

**Verification:**
- [ ] Heartbeat requests sent at regular intervals (default: 300 seconds)
- [ ] HTTP 200 responses received
- [ ] "Status changed: Online" messages appear after each heartbeat
- [ ] No error messages in logs

#### Step 2.2: Verify Console Updates
1. Refresh console endpoints view
2. Check "Last Seen" timestamp for your endpoint

**Verification:**
- [ ] Last Seen timestamp updates regularly
- [ ] Endpoint remains in "Online" status

---

### Phase 3: Uninstallation & Deregistration

#### Step 3.1: Run Uninstaller
```bash
bash /Users/$(whoami)/Downloads/uninstall-kuamini-macos.sh
```
Or download from repository:
```bash
curl -o ~/uninstall.sh https://yourdomain.com/uninstallers/uninstall-kuamini-macos.sh
bash ~/uninstall.sh
```

**Expected Output:**
```
🗑️  Kuamini Security Client Uninstaller
=======================================

📋 Found config file, reading agent configuration...
✓ Agent ID: [UUID]
✓ API Base: https://kuaminisystems.com/api/agent

📡 Deregistering from console...
✓ Successfully deregistered from console

🛑 Stopping agent...
🗑️  Removing files...

✅ Kuamini Security Client has been completely removed
```

**Verification:**
- [ ] Script finds config file
- [ ] Agent ID is read correctly
- [ ] API Base is production URL (https://kuaminisystems.com/api/agent)
- [ ] Deregistration succeeds with HTTP 200
- [ ] Agent process stops
- [ ] App removed from /Applications
- [ ] Config removed from ~/.kuamini
- [ ] LaunchAgent removed from ~/Library/LaunchAgents
- [ ] Logs removed from ~/Library/Logs

#### Step 3.2: Verify Process Termination
```bash
# Confirm no agent processes running
ps aux | grep KuaminiSecurityClient | grep -v grep
# Should return: (no matches)
```

**Verification:**
- [ ] No KuaminiSecurityClient processes running
- [ ] No tray icon visible in menu bar

#### Step 3.3: Verify Console Deregistration
1. Refresh console endpoints view
2. Search for previously registered endpoint

**Verification:**
- [ ] Endpoint no longer appears in endpoints list
- [ ] Endpoint no longer counted in "Total Endpoints"
- [ ] License count for account decreased by 1

---

## Production Endpoints to Test

### macOS-Specific Endpoints
```
POST /api/agent/register
  - Input: agent_id, hostname, os, registration_token
  - Expected: 200 with endpoint_id
  
POST /api/agent/heartbeat
  - Input: agent_id, account_id, status
  - Expected: 200 with assigned policies
  
POST /api/agent/deregister
  - Input: agent_id
  - Expected: 200, endpoint deleted from database
```

### Config Retrieval
```
GET /api/agent/installers/config?accountId=UUID&registrationToken=TOKEN
  - Expected: 200 with config including api_base, heartbeat_interval
```

---

## Troubleshooting

### Agent Not Registering
1. Check if registration_token in config is valid (not expired)
2. Verify account exists and is active
3. Check network connectivity to API base URL
4. Review logs for specific error message

### Deregistration Fails
1. Verify agent_id in config is correct
2. Check if endpoint still exists in console
3. Verify network connectivity during uninstall
4. Check if account_id matches

### Tray Icon Not Appearing
1. Check LaunchAgent plist is in correct location
2. Verify plist has correct executable path
3. Check if app is code-signed properly
4. Review logs for startup errors

---

## Rollback Plan

If issues are found in production:

1. **Keep the test endpoint registered** - Don't run uninstaller yet
2. **Check server logs** for detailed error information
3. **Fix the issue** in development/staging
4. **Rebuild PKG** and test again
5. **Then proceed with uninstaller** to clean up test endpoint

---

## Success Criteria

✅ All endpoints verified = Production ready
- [x] Installation completes without errors
- [x] Auto-registration successful on first startup
- [x] Tray icon appears with correct status
- [x] Heartbeats sent at regular intervals
- [x] Console shows endpoint as Online
- [x] Uninstaller finds correct API base from config
- [x] Deregistration removes endpoint from console
- [x] All local files cleaned up

---

## Notes for Production Deployment

1. **API Base URL**: Agent automatically uses production URL from installer config
2. **Registration Token**: Embedded in PKG, unique per account
3. **Deregistration**: Automatic via uninstaller, no console action needed
4. **LaunchAgent**: Starts automatically on login after installation
5. **Heartbeat Interval**: Default 300 seconds, configurable via console

