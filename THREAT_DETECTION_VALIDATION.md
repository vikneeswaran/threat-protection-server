# Threat Detection Integration - Validation Checklist

Use this checklist to verify that threat detection integration is safe and doesn't affect existing functionality.

---

## Pre-Integration Checklist

### Module Preparation
- [ ] Copy `threat_detection/` folder to `agent-tray/`
- [ ] Verify `threat_detection/__init__.py` exists
- [ ] All 6 module files present:
  - [ ] `__init__.py`
  - [ ] `signatures.py`
  - [ ] `scanner.py`
  - [ ] `process_monitor.py`
  - [ ] `engine.py`
  - [ ] `reporter.py`

### Code Review
- [ ] Read `THREAT_DETECTION_IMPLEMENTATION.md`
- [ ] Read `THREAT_DETECTION_SAFETY.md`
- [ ] Read `THREAT_DETECTION_ARCHITECTURE.md`
- [ ] Understand the 6 integration steps
- [ ] Understand thread isolation model

### Backup
- [ ] Backup original `main.py`
- [ ] Backup original `config.json`
- [ ] Have rollback plan ready

---

## Integration Checklist

### Step 1: Add Helper Function
- [ ] Added `initialize_threat_detection()` function
- [ ] Function has try-except for ImportError
- [ ] Function has try-except for general Exception
- [ ] Function returns `{enabled: False}` on any error
- [ ] Function placed BEFORE `tray_main()`

### Step 2: Initialize in tray_main()
- [ ] Added `threat_system = initialize_threat_detection(config)`
- [ ] No config flag gating (policy controlled)
- [ ] Logging shows initialization status

### Step 3: Add Scan Functions
- [ ] Added `quick_threat_scan()` function
- [ ] Added `threat_scan_loop()` function
- [ ] Both functions check `if not threat_system or not threat_system.get('enabled')`
- [ ] Both functions have try-except blocks
- [ ] Both functions handle errors without crashing
- [ ] Both functions placed INSIDE `tray_main()`

### Step 4: Update Menu Builder
- [ ] Updated `build_menu()` function
- [ ] Menu item added conditionally
- [ ] Condition: `if threat_system and threat_system.get('enabled')`
- [ ] Menu shows only when enabled
- [ ] Menu item text: "🔍 Quick threat scan"

### Step 5: Start Background Thread
- [ ] Heartbeat thread started (unchanged)
- [ ] Threat scan thread conditional: `if threat_system and threat_system.get('enabled')`
- [ ] Threat thread is daemon thread
- [ ] Both threads run independently
- [ ] Logging shows both threads started

### Step 6: Update Configuration
- [ ] `threat_scan_interval: 3600` (local default)
- [ ] `threat_scan_mode: "quick"` (local default)
- [ ] `threat_realtime_monitor: false` (local default)
- [ ] `threat_realtime_interval: 300` (local default)
- [ ] Console policy controls enable/disable and intervals

---

## Testing Checklist (CRITICAL)

### Test 1: Policy Disabled

**Setup (console policy):**
```json
{
  "type": "scheduled_scan",
  "config": {
    "enabled": false
  }
}
```

**Verification:**
- [ ] Agent starts without errors
- [ ] No import errors in console
- [ ] Registration works (POST /api/agent/register succeeds)
- [ ] Heartbeat works (POST /api/agent/heartbeat succeeds)
- [ ] Tray icon displays correctly
- [ ] Menu shows Quick threat scan option (scan is blocked by policy)
- [ ] Threat policy update appears in logs
- [ ] Agent closes cleanly (Quit works)

**Expected Log Output:**
```
[INFO] Threat policy updated: enabled=false ...
[INFO] Starting Kuamini Agent Tray
[INFO] ✓ Auto-registration successful
[INFO] ✓ Heartbeat successful
```

### Test 2: Enabled Mode, Module Missing

**Setup (console policy):**
```json
{
  "type": "scheduled_scan",
  "config": {
    "enabled": true
  }
}
```
Delete `threat_detection/` folder temporarily

**Verification:**
- [ ] Agent starts (doesn't crash)
- [ ] Warning logged: "Threat detection module not found"
- [ ] Registration still works
- [ ] Heartbeat still works
- [ ] Tray icon displays correctly
- [ ] Menu shows NO "Quick threat scan" option
- [ ] Agent fully functional with warning

**Expected Log Output:**
```
[WARNING] ⚠ Threat detection module not installed
[INFO] ✓ Registration successful
[INFO] ✓ Heartbeat successful
```

**Rollback:** Restore `threat_detection/` folder

### Test 3: Enabled Mode, Module Present & Working

**Setup (console policy):**
```json
{
  "type": "scheduled_scan",
  "config": {
    "enabled": true,
    "scan_interval": 60
  }
}
```
Restore `threat_detection/` folder

**Verification:**
- [ ] Agent starts without errors
- [ ] Initialization logged: "✓ Threat detection initialized successfully"
- [ ] Background thread started: "✓ Threat detection background thread started"
- [ ] Registration works (within 30 seconds)
- [ ] Heartbeat works (within 30 seconds)
- [ ] Tray icon displays correctly
- [ ] Menu shows "🔍 Quick threat scan" option
- [ ] Scanning logs appear every 60 seconds (due to interval)
- [ ] No interference with registration/heartbeat timing

**Expected Log Output:**
```
[INFO] Initializing threat detection engine...
[INFO] ✓ Threat detection initialized successfully
[INFO] ✓ Threat detection background thread started
[INFO] Starting scheduled threat scan...
[INFO] Scanning all processes...
[INFO] Quick scan complete: 0 files, 0 threats found
[INFO] ✓ Registration successful
[INFO] ✓ Heartbeat successful
```

### Test 4: On-Demand Scan

**Setup:** Threat detection enabled

**Action:** Click "🔍 Quick threat scan" in tray menu

**Verification:**
- [ ] UI status changes to "Scanning threats..."
- [ ] Logs show scan start
- [ ] Menu stays responsive
- [ ] After 5-10 seconds: status returns to normal
- [ ] If threats found: status shows threat count
- [ ] If clean: status shows "Protected"
- [ ] Heartbeat continues during scan
- [ ] Tray icon doesn't freeze

**Expected**:
```
[INFO] User requested quick threat scan
[INFO] Starting quick scan...
[INFO] Scanning critical directories...
[INFO] Quick scan complete: 0 threats found
```

### Test 5: Graceful Failure Recovery

**Setup:** Threat detection enabled

**Action:** Break `signatures.py` (introduce syntax error)

**Starting:**
- [ ] Agent starts (doesn't crash)
- [ ] Error logged during initialization
- [ ] Returns `{enabled: False}`
- [ ] Menu has NO threat scan option
- [ ] Registration works
- [ ] Heartbeat works

**Rollback:** Fix `signatures.py`

**After Fix & Restart:**
- [ ] All threat detection functions work
- [ ] NO need to reset registration
- [ ] NO need to reset config
- [ ] Clean restart to enabled mode

### Test 6: Shutdown Behavior

**Setup:** Threat detection enabled, scan running

**Action:** Click "Quit" in menu

**Verification:**
- [ ] stop_event is set
- [ ] Heartbeat thread exits cleanly
- [ ] Threat scan thread exits cleanly
- [ ] No hanging processes
- [ ] No error messages on exit
- [ ] Tray icon closes properly

**Check:**
```powershell
# Windows
Get-Process KuaminiSecurityClient  # Should not exist

# macOS/Linux
pgrep -f KuaminiSecurityClient  # Should not exist
```

### Test 7: Registration Verification

**Critical Path:** Ensure registration NOT affected

**Before Integration:**
1. Delete existing config
2. Start agent
3. Log agent_id and endpoint_id
4. Verify registration email received

**After Integration:**
1. Delete existing config
2. Ensure scheduled_scan policy enabled
3. Start agent
4. Compare agent_id and endpoint_id
5. **Result**: Should be DIFFERENT (new registration)
   OR same if token not cleared
6. Verify registration email received

**Expected**: Registration process UNCHANGED

### Test 8: Heartbeat Verification

**Critical Path:** Ensure heartbeat NOT affected

**Setup:** Agent running, threat detection enabled

**Monitor Heartbeat for 5 minutes:**
```bash
# Check every heartbeat is sent
tail -f ~/.kuamini/agent.log | grep -i heartbeat
```

**Expected:** Every 60 seconds:
```
[INFO] ✓ Heartbeat successful
```

**Threat scan should NOT interfere:**
- Heartbeats remain at 60s intervals
- No delays in heartbeat
- No dropped heartbeats

---

## Security Checklist

### Import Safety
- [ ] No wildcard imports (`import *`)
- [ ] All imports are explicit
- [ ] Imports are lazy (inside init)
- [ ] Missing module doesn't crash agent

### Exception Handling
- [ ] All try-except blocks have specific exceptions first
- [ ] Generic `Exception` catch as last resort
- [ ] All errors logged with traceback
- [ ] Errors don't propagate up

### Data Privacy
- [ ] No sensitive data logged (tokens, passwords)
- [ ] No threat details sent without consent
- [ ] Registration token handling unchanged
- [ ] Account ID handling unchanged

### Resource Limits
- [ ] Scan can be interrupted
- [ ] File handles closed properly
- [ ] Memory cleaned after scan
- [ ] CPU throttled during scans
- [ ] Background thread uses minimal CPU when idle

---

## Performance Checklist

### Startup Time
- [ ] Agent starts within 2 seconds (with threat detection)
- [ ] Initialization doesn't block registration
- [ ] Tray icon appears within 3 seconds

### Runtime Performance
- [ ] Menu responsive (click response <100ms)
- [ ] No lag when scanning
- [ ] Heartbeat sent on time (within 1 second)
- [ ] Background threads don't spike CPU

### Memory Usage
- [ ] Agent base: < 100 MB
- [ ] Idle (no scan): < 50 MB additional
- [ ] During scan: < 500 MB peak

---

## Rollback Checklist

If any issues during testing:

### Immediate (1 minute)
- [ ] Disable scheduled_scan in console policy
- [ ] Restart agent or wait for policy refresh
- [ ] Verify registration works
- [ ] Verify heartbeat works

### If Still Issues (2 minutes)
- [ ] Delete `threat_detection/` folder
- [ ] Restart agent
- [ ] Verify all functions work

### If Still Issues (5 minutes)
- [ ] Restore backup `main.py`
- [ ] Restart agent
- [ ] Verify all functions work
- [ ] Report issue with logs

---

## Sign-Off Checklist

Before deployment to production:

### Code Quality
- [ ] All 6 steps completed
- [ ] No modifications to existing functions
- [ ] Only additions (no deletions)
- [ ] Two reviewers verified code

### Testing Complete
- [ ] All 8 tests passed
- [ ] No errors in logs
- [ ] Performance verified
- [ ] Rollback tested

### Documentation
- [ ] Installation guide reviewed
- [ ] Config documented
- [ ] Log output documented
- [ ] Troubleshooting documented

### Deployment Ready
- [ ] Version number incremented
- [ ] Changelog updated
- [ ] Release notes prepared
- [ ] QA sign-off received

---

## Quick Rollback Reference

| Issue | Action | Time |
|-------|--------|------|
| Module missing | Disable scheduled_scan policy | 1 min |
| Broken threat logic | Delete threat_detection/ | 2 min |
| Registration broken | Restore main.py | 5 min |
| Still broken | Restore config.json | 5 min |
| Restore original | Git revert + restart | 10 min |

---

## Success Criteria

✅ **All tests pass**
✅ **No errors in logs**
✅ **Registration still works**
✅ **Heartbeat still works**
✅ **Tray icon still responsive**
✅ **Feature can be disabled via console policy**
✅ **Can remove threat_detection/ folder, agent still works**
✅ **Two independent threads work together**
✅ **Performance acceptable**
✅ **Documentation complete**

---

## Sign-Off

| Role | Date | Status |
|------|------|--------|
| Developer | _ | ☐ |
| QA/Tester | _ | ☐ |
| Code Reviewer | _ | ☐ |
| Release Manager | _ | ☐ |

---

## Final Notes

- **Zero changes to existing code** - Only additions
- **Console policy control** - Can be toggled anytime
- **Graceful degradation** - Works fine with scans disabled
- **Thread isolation** - Failures don't cascade
- **Easy rollback** - Remove feature or folder

**Ready to deploy? Go through entire checklist!**
