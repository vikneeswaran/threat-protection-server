# Installation Verification Checklist

Use this checklist after installing the updated client to verify all fixes are working.

## Pre-Installation Setup

- [ ] Get registration token from console admin
- [ ] Prepare clean Windows machine (or use VM)
- [ ] Ensure network connectivity to kuaminisystems.com

## Installation

- [ ] Download latest `KuaminiSecurityClient.msi`
- [ ] Run installer: `msiexec /i KuaminiSecurityClient.msi`
- [ ] Wait for installation to complete
- [ ] Do NOT restart yet

## Immediate Post-Install Checks (First 2 minutes)

### Configuration File
```powershell
# Should exist and contain registration_token
Get-Content "$env:USERPROFILE\.kuamini\config.json" | ConvertFrom-Json | Format-List
```
- [ ] File exists at `%USERPROFILE%\.kuamini\config.json`
- [ ] Contains `registration_token` (non-empty)
- [ ] Contains `api_base`: `https://kuaminisystems.com/api/agent`
- [ ] Contains `agent_id` (UUID format)
- [ ] Contains `auto_register`: `true`

### Process Status
```powershell
Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue
```
- [ ] Process `KuaminiSecurityClient.exe` is running
- [ ] Process uses < 100 MB memory
- [ ] No "not responding" status

### Systray Icon
- [ ] System tray shows Kuamini icon in bottom-right
- [ ] Icon is visible and clickable
- [ ] Right-click shows menu with "Register now", "Send heartbeat", etc.
- [ ] Status shows "Idle" or "Registered"

## Registration Verification (After 10 seconds)

### Log File
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 30
```
- [ ] Log file exists at `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
- [ ] Contains `✓ Auto-registration successful` or similar
- [ ] NO `✗ Auto-registration failed` errors
- [ ] NO `[ERROR]` or `[IMPORT ERROR]` entries
- [ ] Entries show timestamps within last minute

### Expected Log Entries
Check for these successful patterns:
```
[SUCCESS EXAMPLE]
✓ Tray icon object created successfully
Auto-registration enabled, attempting registration
✓ Auto-registration successful: {...}
Registered, preparing heartbeat
```

### Check Config was Updated
```powershell
$config = Get-Content "$env:USERPROFILE\.kuamini\config.json" | ConvertFrom-Json
Write-Host "Account ID: $($config.account_id)"
Write-Host "Endpoint ID: $($config.endpoint_id)"
```
- [ ] `account_id` is now populated (was empty before registration)
- [ ] `endpoint_id` is now set (if server provided it)

## Heartbeat Verification (After 60+ seconds)

### Monitor Log for Heartbeat
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Wait | Select-String "heartbeat"
```
- [ ] See `✓ Heartbeat successful` messages
- [ ] Heartbeats appear approximately every 60 seconds
- [ ] NO repeated `✗ Heartbeat failed` errors

### Console Verification
- [ ] Log in to `https://kuaminisystems.com/securityAgent`
- [ ] Check "Endpoints" or "Agents" section
- [ ] New agent appears in list
- [ ] Status shows "Online" or "Active"
- [ ] Last heartbeat timestamp is recent (within last 2 minutes)

## Stress Tests

### Network Disconnection
- [ ] Disconnect network or block firewall
- [ ] Wait 2 minutes
- [ ] Check logs for connection errors
- [ ] Reconnect network
- [ ] Verify heartbeat resumes within 60 seconds

### Manual Registration Trigger
- [ ] Right-click tray icon → "Register now"
- [ ] Check log for registration attempt
- [ ] Verify no errors (should be idempotent)

### Manual Heartbeat Trigger
- [ ] Right-click tray icon → "Send heartbeat"
- [ ] Check log for successful heartbeat
- [ ] Verify status in console updates

## Restart Verification

- [ ] Restart computer
- [ ] Wait 30 seconds for system startup
- [ ] Verify systray icon appears
- [ ] Verify process is running
- [ ] Verify heartbeat resumes
- [ ] Check agent status in console

## Error Scenarios (Negative Testing)

### Invalid Token Scenario
```powershell
# Edit config with bad token
$config = Get-Content "$env:USERPROFILE\.kuamini\config.json" | ConvertFrom-Json
$config.registration_token = "invalid_token_data"
$config | ConvertTo-Json | Set-Content "$env:USERPROFILE\.kuamini\config.json"

# Restart process
Stop-Process -Name KuaminiSecurityClient -Force
Start-Process "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"

# Check for meaningful error
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 10
```
- [ ] See error message in log (not silent failure)
- [ ] Error message is understandable
- [ ] Application doesn't crash

### Missing Config File
```powershell
# Remove config temporarily
Remove-Item "$env:USERPROFILE\.kuamini\config.json"

# Restart process
Stop-Process -Name KuaminiSecurityClient -Force
Start-Process "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"

# Wait and check
Start-Sleep -Seconds 2
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 10
```
- [ ] Config file is recreated with defaults
- [ ] Application continues running (background mode)
- [ ] No crashes or exceptions

## Uninstall & Reinstall Test

```powershell
# Uninstall
msiexec /x KuaminiSecurityClient.msi /quiet

# Reinstall
msiexec /i KuaminiSecurityClient.msi /quiet

# Verify works
Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue
```
- [ ] Uninstall completes cleanly
- [ ] Reinstall works from fresh state
- [ ] All previous checks pass again

## Performance Baseline

Measure these for performance regression detection:
```powershell
# Startup time
$start = Get-Date
Start-Process "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe"
While (-not (Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue)) {
    Start-Sleep -Milliseconds 100
}
$startupTime = (Get-Date) - $start
Write-Host "Startup time: $($startupTime.TotalSeconds) seconds"
```

- [ ] Startup time: < 3 seconds
- [ ] Memory usage at idle: < 50 MB
- [ ] Memory after 24h: < 100 MB (no leak)
- [ ] CPU usage at idle: < 1%

## Final Approval

- [ ] All configuration checks pass ✅
- [ ] All process checks pass ✅
- [ ] All heartbeat checks pass ✅
- [ ] All error scenarios handled gracefully ✅
- [ ] No crash dumps in Windows Event Viewer ✅
- [ ] Console shows agent as "Online" ✅
- [ ] Ready for production deployment ✅

---

**Verified by:** _________________  
**Date:** _________________  
**Notes:** _________________________________  

---

## Quick Command Summary

```powershell
# One-liner to check everything
@(
  ("Config", Test-Path "$env:USERPROFILE\.kuamini\config.json"),
  ("Process", $null -ne (Get-Process KuaminiSecurityClient -EA SilentlyContinue)),
  ("Logs", Test-Path "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"),
  ("Network", (Test-NetConnection kuaminisystems.com -Port 443 -InformationLevel Quiet))
) | ForEach-Object { Write-Host "$($_.Item1): $(if ($_.Item2) { '✓' } else { '✗' })" }
```
