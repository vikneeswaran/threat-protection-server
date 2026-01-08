# Production Testing Checklist

## Pre-Deployment
- [ ] All code changes committed to main branch
- [ ] PKG built with latest agent code
- [ ] PKG available at `public/tray/KuaminiSecurityClient-1.0.0.pkg`
- [ ] Installer download route configured for production API base
- [ ] Environment variables set (INSTALLER_TOKEN_SECRET, API URLs)
- [ ] Database migrations applied
- [ ] LaunchAgent plist included in app bundle

## Installation Phase
- [ ] PKG downloads successfully from installer endpoint
- [ ] PKG signature valid (codesign verification)
- [ ] Installation completes without permission errors
- [ ] App installed to `/Applications/KuaminiSecurityClient.app`
- [ ] Config file created with production API base
- [ ] Registration token embedded in PKG and config

## Registration Phase
- [ ] Agent starts automatically after installation
- [ ] Auto-registration call made to `/api/agent/register`
- [ ] Endpoint registered in database with correct account_id
- [ ] Agent receives endpoint_id from registration response
- [ ] Tray icon appears showing "Online" status
- [ ] Logs show successful registration

## Heartbeat Phase
- [ ] Heartbeat requests sent at configured interval
- [ ] Heartbeat responses return HTTP 200
- [ ] Console shows endpoint as "Online"
- [ ] Last Seen timestamp updates in console
- [ ] Policies can be assigned to endpoint from console

## Uninstallation Phase
- [ ] Uninstaller script runs without permission errors
- [ ] Uninstaller reads `api_base` from config
- [ ] Deregister API call succeeds (HTTP 200)
- [ ] Endpoint removed from console
- [ ] All files removed from system:
  - [ ] `/Applications/KuaminiSecurityClient.app`
  - [ ] `~/.kuamini/config.json`
  - [ ] `~/Library/LaunchAgents/com.kuamini.securityclient.plist`
  - [ ] `~/Library/Logs/KuaminiSecurityClient/`
- [ ] No processes left running
- [ ] Tray icon disappeared

## Verification in Console
- [ ] Endpoint appears in endpoints list
- [ ] Endpoint shows correct hostname
- [ ] Endpoint shows correct OS (macOS)
- [ ] Agent ID matches local config
- [ ] Account license count incremented on install
- [ ] Account license count decremented on uninstall
- [ ] Endpoint removed after uninstall deregistration

## Network & Security
- [ ] All API calls use HTTPS in production
- [ ] API base URL correctly set (not localhost)
- [ ] Registration token properly validated
- [ ] HMAC signatures verified correctly
- [ ] No sensitive data in logs
- [ ] API responses don't leak account info

## Error Handling
- [ ] Network timeout during registration doesn't crash app
- [ ] Invalid registration token shows clear error
- [ ] Expired token can be refreshed from console
- [ ] Deregistration failure doesn't prevent uninstall
- [ ] Missing config file handled gracefully

## Performance
- [ ] App startup time < 5 seconds
- [ ] Memory usage < 100MB
- [ ] CPU usage minimal when idle
- [ ] Heartbeat doesn't block UI
- [ ] Tray icon responsive to clicks

## Multi-Account Testing
- [ ] Account 1: Install, register, verify
- [ ] Account 2: Install, register, verify both endpoints
- [ ] Account 1: Uninstall, verify only Account 1 endpoint removed
- [ ] Account 2: Uninstall, verify Account 2 endpoint removed
- [ ] Console shows correct endpoint counts per account

## Final Sign-Off
- [ ] All checklist items complete
- [ ] No critical issues found
- [ ] Installation & uninstall cycle repeatable
- [ ] Ready for production release
- [ ] Documentation updated
- [ ] Support team notified

**Date Tested:** _______________
**Tester Name:** _______________
**Status:** [ ] PASS [ ] FAIL
**Issues Found:** (if any)

