# Thread Architecture & Safety Diagram

## Current Agent Architecture (Unchanged by Threat Detection)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Thread                             │
│                                                                 │
│  1. Singleton Check                                             │
│  2. Setup Logging                                               │
│  3. Load Config                                                 │
│  4. Setup CA Bundle                                             │
│  5. Initialize Tray Icon                                        │
│  6. Build Menu                                                  │
│  7. Register with Console (first time)                          │
│  8. Auto-register on startup                                    │
│  9. Setup Tray UI                                               │
│  10. Run Icon Event Loop (BLOCKING)                             │
│      └─ Tray Icon stays responsive                              │
│      └─ Menu callbacks execute                                  │
│      └─ Status updates in real-time                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │                           │                    │
         ├─ Daemon Thread 1          ├─ Daemon Thread 2  └─ Daemon Thread N
         │                           │                    (if enabled)
         │ Heartbeat Loop            │ Threat Scan Loop
         │ (60 second interval)      │ (3600 sec interval)
         │                           │
         │ ┌──────────────────┐     │ ┌──────────────────┐
         │ │ Send heartbeat   │     │ │ Run full scan    │
         │ │ Update status    │     │ │ Report threats   │
         │ │ Retry if failed  │     │ │ Update UI status │
         │ └──────────────────┘     │ └──────────────────┘
         │                           │
         └── Continues regardless    └── Stops if scan fails
             of threat detection         (non-blocking)
```

---

## Thread Safety Isolation

### Scenario 1: Policy Disabled (Default)

```
Agent Startup
  ├─ Initialize threat detection module ✓
  ├─ Apply policies from heartbeat
  │  └─ scheduled_scan.enabled = false ✓
  │
  ├─ Threat scan loop runs but skips scans ✓
  │
  ├─ Start tray icon
  ├─ Start heartbeat thread
  │
  └─ Menu: Quick threat scan is blocked by policy

Result: Core agent behavior unchanged
        Scans paused by policy
        No performance impact from scanning
```

### Scenario 2: Policy Enabled, Module Missing

```
Agent Startup
  ├─ Initialize threat detection module
  │  ├─ Import threat_detection.ThreatDetectionEngine
  │  │  └─ ImportError: Module not found
  │  │
  │  └─ Catch exception ✓
  │     └─ Log warning ✓
  │     └─ Return {enabled: False} ✓
  │
  ├─ Check threat_system.get('enabled')
  │  └─ FALSE
  │
  ├─ Skip threat scan thread ✓
  │
  ├─ Start tray icon
  ├─ Start heartbeat thread
  │
  └─ Menu: No threat scan option

Result: Agent continues normally
        Clear warning in logs
        No crashes
        No registration impact
        No heartbeat impact
```

### Scenario 3: Threat Detection Enabled and Working

```
Agent Startup
  │
  ├─ Initialize threat detection ✓
  │
  ├─ Start tray icon
  │
  ├─ Start heartbeat thread           Start threat scan thread
  │                                   │
  │  ┌─────────────────────┐         │ ┌──────────────────────┐
  │  │ Heartbeat Loop      │         │ │ Threat Scan Loop     │
  │  │ (Every 60s)         │         │ │ (Every 1h)           │
  │  │                     │         │ │                      │
  │  │ 1. Collect status   │         │ │ 1. Start scan        │
  │  │ 2. POST /heartbeat  │         │ │ 2. Scan files        │
  │  │ 3. Update endpoint  │         │ │ 3. Monitor processes │
  │  │ 4. Sleep 60s        │         │ │ 4. Check registry    │
  │  │                     │         │ │ 5. Report threats    │
  │  │ Continues even if   │ ╳       │ │ 6. Sleep 1h          │
  │  │ threat detection    │         │ │                      │
  │  │ crashes             │         │ │ Throws exception?    │
  │  │                     │         │ │ └─ Caught ✓           │
  │  │                     │         │ │ └─ Logged ✓           │
  │  │                     │         │ │ └─ Loop continues ✓   │
  │  └─────────────────────┘         │ └──────────────────────┘
  │                                   │
  │  INDEPENDENT THREAD               INDEPENDENT THREAD
  │  Failure = No Impact              Failure = No Impact
  │  On Registration                  On Registration
  │  On Heartbeat                     On Heartbeat
  │  On Tray Icon                     On Tray Icon
  │
```

### Scenario 4: Threat Detection Scan Fails

```
Threat Scan Loop
  │
  ├─ Check threat_system.get('enabled')
  │  └─ TRUE
  │
  ├─ Run full_scan()
  │  ├─ File scanning
  │  ├─ Process monitoring
  │  └─ Registry check
  │
  ├─ Exception: Out of memory ✗
  │
  ├─ Catch Exception ✓
  │  ├─ Log error ✓
  │  ├─ Update status "Scan error" ✓
  │  └─ Continue loop ✓
  │
  ├─ Wait for next interval
  │  └─ Loop continues normally
  │
  └─ Agent keeps running
     ├─ Tray icon responsive ✓
     ├─ Heartbeat continues ✓
     ├─ Registration intact ✓

Result: Single scan failed
        Next scan will retry
        Rest of agent unaffected
        Graceful degradation
```

### Scenario 5: Heartbeat Fails (Threat Detection Still Works)

```
Heartbeat Loop              Threat Scan Loop
  │                             │
  ├─ POST /heartbeat            │
  │  └─ Network timeout ✗        │ ┌────────────────────┐
  │                              │ │ Scanning files... ✓│
  ├─ Log error                   │ │ Monitoring process│
  │                              │ │ Reporting threats │
  ├─ Retry next interval         │ └────────────────────┘
  │
  └─ Agent works fine
     └─ Threat detection continues ✓
```

---

## Error Handling Tree

```
Initialize Threat Detection
  │
  ├─ Initialize module (always on)
  │  ├─ Import threat_detection modules
  │  ├─ ImportError → Log warning → Return {enabled: False}
  │  ├─ SyntaxError → Log error → Return {enabled: False}
  │  └─ Any Exception → Log error → Return {enabled: False}
  │
  ├─ Try: Create ThreatDetectionEngine
  │  ├─ Exception → Log error → Return {enabled: False}
  │  └─ Success → Continue
  │
  ├─ Try: Create ThreatReporter
  │  ├─ Exception → Log error → Return {enabled: False}
  │  └─ Success → Continue
  │
  └─ Return {enabled: True, engine: ..., reporter: ...}

Result: ALWAYS returns a dict
        NEVER crashes init function
        ALWAYS allows agent to continue
```

---

## Thread Runtime Lifecycle

```
┌─── AGENT STARTUP ──────────────────────────────────────────┐
│                                                            │
│ 1. MAIN THREAD                                             │
│    ├─ Load config                                          │
│    ├─ Initialize threat detection (safe)                  │
│    ├─ Create tray icon                                    │
│    │                                                      │
│    ├─ Spawn HEARTBEAT THREAD → Daemon (background)        │
│    │  │ Continues even if main exits                      │
│    │  └─ Runs until tray icon closes                      │
│    │                                                      │
│    ├─ Spawn THREAT SCAN THREAD → Daemon (background)      │
│    │  │ Scans gated by policy                             │
│    │  └─ Runs independently of heartbeat                  │
│    │                                                      │
│    └─ Run TRAY ICON → Blocking event loop                 │
│       ├─ Processes user events                            │
│       ├─ Calls menu handlers                              │
│       └─ Updates display                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─── DURING OPERATION ──────────────────────────────────────┐
│                                                            │
│ TRAY ICON THREAD      HEARTBEAT THREAD    THREAT THREAD   │
│ (Main)                (Daemon)            (Daemon)        │
│                                                            │
│ Waiting for           Every 60s:          Every 1h:       │
│ user clicks           ├─ Send POST        ├─ Scan files   │
│                       ├─ Update status    ├─ Check procs  │
│ User clicks           ├─ Handle errors    ├─ Report       │
│ menu item?            └─ Sleep 60s        └─ Sleep 1h     │
│ ├─ Handle it                                              │
│ └─ Call handler       Even if threat      Even if tray    │
│                       scan crashes         closes          │
│                                                            │
│ Tray still            Heartbeat still     Scan can        │
│ responsive ✓          running ✓           fail safely ✓   │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─── ON SHUTDOWN ──────────────────────────────────────────┐
│                                                           │
│ User clicks "Quit"                                        │
│   │                                                       │
│   ├─ Set stop_event → HEARTBEAT THREAD sees it           │
│   │  └─ Stops sending heartbeats                         │
│   │  └─ Exits cleanly                                    │
│   │                                                       │
│   ├─ Set stop_event → THREAT SCAN THREAD sees it         │
│   │  └─ Stops scanning                                   │
│   │  └─ Exits cleanly                                    │
│   │                                                       │
│   └─ MAIN THREAD exits tray event loop                   │
│      └─ Application closes                               │
│                                                           │
│ Result: Clean shutdown                                    │
│         All threads stopped gracefully                   │
│         No hanging processes                             │
│                                                           │
└────────────────────────────────────────────────────────────┘
```

---

## Failure Scenario Matrix

| Scenario | Heartbeat | Tray Icon | Registration | Outcome |
|----------|-----------|-----------|--------------|---------|
| Threat scan fails | ✓ Works | ✓ Works | ✓ Works | All functions operate, threat feature unavailable |
| Heartbeat fails | ⚠ Retries | ✓ Works | ✓ Works | Threat scan continues, registration unaffected |
| Tray icon crashes | ✓ Works | ⚠ Fallback | ✓ Works | Background mode, heartbeat + threat scan continue |
| All fail at once | ✗ Crashes | ✗ Crashes | ✓ Done | Post-registration, agent in background mode |

---

## Memory & CPU Impact

### Threat Detection Disabled
```
Memory:  No threat detection modules loaded
CPU:     No scanning (0% threat detection)
Impact:  Zero - identical to original agent
```

### Threat Detection Enabled

**Quick Scan (5-10 minutes)**
```
Memory:  100-200 MB (during scan)
CPU:     20-30% (disk heavy)
I/O:     High disk reads
Impact:  Run during off-hours
```

**Full Scan (30+ minutes)**
```
Memory:  200-500 MB (during scan)
CPU:     30-50% (heavy)
I/O:     Sustained heavy
Impact:  Run nightly/weekly
```

**Idling (Between Scans)**
```
Memory:  ~5-10 MB (loaded module)
CPU:     <1% (sleeping)
I/O:     None
Impact:  Minimal
```

---

## Testing the Safety

### Test 1: Policy Disabled and Run

```bash
# Console policy
{
  "type": "scheduled_scan",
  "config": {
    "enabled": false
  }
}

# Start agent
python main.py

# Should see:
# [INFO] Threat policy updated: enabled=false ...
# [INFO] ✓ Registration successful
# [INFO] ✓ Heartbeat successful
# Scans paused by policy
```

### Test 2: Enable but Break Module

```bash
# Create empty threat_detection/__init__.py
touch agent-tray/threat_detection/__init__.py

# Start agent
python main.py

# Should see:
# [WARNING] ⚠ Threat detection module not installed
# [INFO] ✓ Registration successful
# [INFO] ✓ Heartbeat successful
# No threat scan in menu
```

### Test 3: Policy Enabled and Working

```bash
# Console policy
{
  "type": "scheduled_scan",
  "config": {
    "enabled": true,
    "scan_interval": 3600
  }
}

# Start agent
python main.py

# Should see:
# [INFO] Initializing threat detection engine...
# [INFO] ✓ Threat detection initialized successfully
# [INFO] ✓ Threat detection background thread started
# [INFO] ✓ Registration successful
# [INFO] ✓ Heartbeat successful
# Menu shows threat scan option
```

---

## Key Takeaway

```
┌──────────────────────────────────────────────────────┐
│  THREAT DETECTION RUNS IN COMPLETELY SEPARATE THREAD │
│                                                      │
│  Main Agent                 Threat Detection         │
│  ├─ Registration            ├─ File Scanning         │
│  ├─ Heartbeat               ├─ Process Monitor       │
│  ├─ Tray Icon               └─ Threat Reporting      │
│  └─ Console UI                                       │
│                                                      │
│  🔒 Cross-thread failures don't cascade              │
│  🔒 Registration can't break heartbeat               │
│  🔒 Threat scans won't break registration            │
│  🔒 UI stays responsive even during heavy scans      │
│  🔒 Can disable without affecting anything else      │
└──────────────────────────────────────────────────────┘
```
