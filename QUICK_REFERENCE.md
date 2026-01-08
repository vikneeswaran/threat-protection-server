# Quick Reference: Production Testing

## 5-Minute Setup

### Prerequisites
```bash
# Ensure you have:
# - Test account in production console
# - Registration token from console
# - Production domain (https://yourdomain.com)
# - macOS endpoint for testing
```

### 1. Get Registration Token
```bash
# Log into production console
# Go to: Account → API Tokens or Installers
# Copy registration token

TOKEN="your-token-here"
ACCOUNT_ID="your-account-id"
DOMAIN="https://yourdomain.com"
```

### 2. Download Installer
```bash
curl -o ~/Downloads/KuaminiSecurityClient.pkg \
  "$DOMAIN/api/agent/installers/download?platform=macos&accountId=$ACCOUNT_ID"

# Should download ~20MB file
ls -lh ~/Downloads/KuaminiSecurityClient.pkg
```

### 3. Install
```bash
sudo installer -pkg ~/Downloads/KuaminiSecurityClient.pkg -target /
```

### 4. Verify Installation (within 30 seconds)
```bash
# Check process
ps aux | grep KuaminiSecurityClient | grep -v grep

# Check config created
cat ~/.kuamini/config.json

# Check tray icon appeared
# Look for green "Kuamini" icon in menu bar
```

### 5. Check Console
- Refresh browser
- Go to Endpoints/Devices section
- Look for endpoint with your hostname
- Status should show "Online"

### 6. Uninstall
```bash
# Download uninstaller
curl -o ~/uninstall.sh \
  "$DOMAIN/uninstallers/uninstall-kuamini-macos.sh"

bash ~/uninstall.sh
```

### 7. Verify Uninstall
```bash
# Check endpoint removed from console
# Browser refresh should show endpoint gone

# Check local cleanup
ls /Applications/KuaminiSecurityClient.app 2>&1 && echo "FAIL: Still installed" || echo "PASS: Removed"
ls ~/.kuamini/config.json 2>&1 && echo "FAIL: Config still exists" || echo "PASS: Cleaned up"
```

---

## Common Test Commands

### Quick Health Check
```bash
curl -s "$DOMAIN/api/health" | jq .
```

### Test Registration
```bash
curl -X POST "$DOMAIN/api/agent/register" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$TOKEN'",
    "hostname": "'$(hostname)'",
    "os": "macos",
    "os_version": "15.5",
    "agent_version": "1.0.0"
  }' | jq .
```

### Test Config
```bash
curl "$DOMAIN/api/agent/installers/config?accountId=$ACCOUNT_ID&registrationToken=$TOKEN" | jq .
```

### Check Logs
```bash
# Agent logs
tail -50 ~/Library/Logs/KuaminiSecurityClient/agent.log

# Watch for registration
tail -f ~/Library/Logs/KuaminiSecurityClient/agent.log | grep -i register

# Watch for heartbeats
tail -f ~/Library/Logs/KuaminiSecurityClient/agent.log | grep -i heartbeat
```

---

## Expected Outputs

### Successful Installation
```
2026-01-08 19:21:39,240 [INFO] Status changed: Registering...
2026-01-08 19:21:40,202 [INFO] Auto-registration successful: {...}
2026-01-08 19:21:40,204 [INFO] Status changed: Online
```

### Successful Uninstall
```
✓ Agent ID: [UUID]
✓ API Base: https://yourdomain.com/api/agent
✓ Successfully deregistered from console
✓ All files cleaned up
```

---

## Success Criteria (All Must Pass)

| Test | Expected | Status |
|------|----------|--------|
| Download | 20MB PKG | [ ] |
| Install | No errors | [ ] |
| Process | Running | [ ] |
| Tray Icon | Green "Online" | [ ] |
| Console | Endpoint visible | [ ] |
| Config | Correct API base | [ ] |
| Heartbeat | 200 response | [ ] |
| Uninstall | Completes | [ ] |
| Deregister | 200 response | [ ] |
| Cleanup | All files gone | [ ] |
| Console | Endpoint removed | [ ] |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Download fails (403) | Token expired, get new one |
| Download fails (404) | PKG not at public/tray, rebuild |
| Install fails | Run as non-sudo, check permissions |
| No tray icon | Check LaunchAgent plist, restart Mac |
| Agent not registering | Check api_base in config (not localhost) |
| Deregister fails | Verify agent_id in config still exists |
| Console shows offline | Check heartbeat logs, network connectivity |
| Uninstall permission errors | Some files need sudo to remove |

---

## Checklist for Sign-Off

- [ ] All 11 success criteria passing
- [ ] Installation repeatable 3x
- [ ] Uninstallation repeatable 3x
- [ ] Multi-account tested (2+ accounts)
- [ ] Network failure tested
- [ ] License counting verified
- [ ] No security warnings
- [ ] Performance acceptable
- [ ] Logs clear and helpful
- [ ] Ready for production release

---

## Getting Help

Check these files for detailed info:
1. `PRODUCTION_DEPLOYMENT.md` - Full deployment guide
2. `PRODUCTION_VERIFICATION.md` - Detailed test procedures
3. `PRODUCTION_TESTING_CHECKLIST.md` - Comprehensive checklist

Or check agent logs:
```bash
tail -200 ~/Library/Logs/KuaminiSecurityClient/agent.log
```

