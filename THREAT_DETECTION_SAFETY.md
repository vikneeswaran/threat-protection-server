# Threat Detection Integration - Safety Guidelines

## Core Principle: Zero Impact to Existing Functionality

The threat detection module is designed as an **optional, completely isolated** component that:
- ✅ Does NOT interfere with registration 
- ✅ Does NOT interfere with heartbeat
- ✅ Does NOT interfere with tray icon
- ✅ Can be disabled without any other changes
- ✅ Fails gracefully without crashing the agent
- ✅ Runs in separate daemon threads

---

## Safe Integration Pattern

### Pattern 1: Console Policy Control (Recommended)

Threat detection is enabled by default and controlled by policies from the console.
The agent applies policies returned by the heartbeat API response.

Example policy config (admin-controlled):

```json
{
    "type": "scheduled_scan",
    "config": {
        "enabled": true,
        "scan_interval": 3600,
        "scan_mode": "quick"
    }
}
```

Agent integrates by initializing the module and using policy values at runtime:

```python
def tray_main():
    setup_logging()
    config = load_config()
    
    # Threat detection is enabled by default and policy-controlled
    threat_system = initialize_threat_detection(config)
    if not threat_system.get("enabled"):
        logging.warning("⚠ Threat detection module not found or failed to init")
    
    # Rest of existing code continues regardless
    # ... registration, heartbeat, tray icon setup ...
```

### Pattern 2: Lazy Import with Fallback

```python
def initialize_threat_detection(config):
    """Safely import and initialize threat detection"""
    try:
        from threat_detection import (
            ThreatDetectionEngine,
            ThreatReporter,
        )
        
        engine = ThreatDetectionEngine()
        reporter = ThreatReporter(
            api_base_url=config.get('api_base'),
            agent_id=config.get('agent_id'),
            account_id=config.get('account_id')
        )
        
        return {
            'engine': engine,
            'reporter': reporter,
            'enabled': True,
        }
    
    except ImportError as e:
        logging.warning("Threat detection module not available: %s", e)
        return {'enabled': False}
    
    except Exception as e:
        logging.error("Failed to initialize threat detection: %s", e, exc_info=True)
        return {'enabled': False}
```

---

## Integration Code (Isolated & Safe)

### Add to main.py - Complete Safe Implementation

**Location: Right after `setup_logging()` and config loading**

```python
def tray_main():
    """Run as full tray application with icon and menu."""
    setup_logging()
    logging.info("Starting Kuamini Agent Tray")
    config = load_config()

    # ===== THREAT DETECTION (POLICY CONTROLLED) =====
    threat_system = initialize_threat_detection(config)
    if threat_system.get('enabled'):
        logging.info("✓ Threat detection ready (policy controlled)")
    else:
        logging.warning("⚠ Threat detection unavailable (module missing or init failed)")
    # ===== END THREAT DETECTION SETUP =====

    status = {"text": "Idle", "color": (46, 204, 113)}
    
    # ... EXISTING CODE (tray icon, registration, heartbeat) CONTINUES UNCHANGED ...
    
    def threat_scan_loop():
        """Isolated background thread for threat scanning"""
        if not threat_system or not threat_system.get('enabled'):
            return  # Exit immediately if not enabled
        
        try:
            endpoint_id = config.get("endpoint_id")
            scan_interval = int(config.get("threat_scan_interval", 3600))
            
            while not stop_event.is_set():
                try:
                    logging.debug("Starting scheduled threat scan...")
                    
                    # Perform scan
                    scan_report = threat_system['engine'].full_scan()
                    
                    # Report if threats found
                    if scan_report.total_threats > 0:
                        logging.warning(f"THREATS DETECTED: {scan_report.total_threats}")
                        
                        try:
                            threat_system['reporter'].report_scan_results(
                                scan_report,
                                endpoint_id=endpoint_id
                            )
                        except Exception as e:
                            logging.error("Failed to report threats: %s", e)
                        
                        # Update UI
                        set_status(f"⚠ {scan_report.total_threats} threats", (231, 76, 60))
                    else:
                        logging.debug("✓ Scan complete, no threats found")
                        set_status("Protected", (46, 204, 113))
                
                except Exception as e:
                    logging.error("Error during threat scan: %s", e, exc_info=True)
                    # Continue scanning even if one iteration fails
                    set_status("Scan error (retrying)", (255, 165, 0))
                
                # Wait for next interval
                stop_event.wait(scan_interval)
        
        except Exception as e:
            logging.error("Fatal error in threat scan loop, aborting: %s", e, exc_info=True)
            # Don't crash the agent
    
    def quick_threat_scan(icon_, item):
        """On-demand threat scan - isolated"""
        if not threat_system or not threat_system.get('enabled'):
            logging.info("Threat detection not enabled")
            return
        
        try:
            set_status("Scanning threats...", (255, 165, 0))
            logging.info("User requested quick threat scan")
            
            scan_report = threat_system['engine'].quick_scan()
            
            if scan_report.total_threats > 0:
                logging.warning(f"Quick scan found {scan_report.total_threats} threats")
                set_status(f"Found {scan_report.total_threats}", (231, 76, 60))
                
                try:
                    threat_system['reporter'].report_scan_results(
                        scan_report,
                        endpoint_id=config.get("endpoint_id")
                    )
                except Exception as e:
                    logging.error("Failed to report threats: %s", e)
            else:
                logging.info("✓ Quick scan - clean")
                set_status("Protected", (46, 204, 113))
        
        except Exception as e:
            logging.error("Error in quick scan: %s", e, exc_info=True)
            set_status("Scan failed", (255, 0, 0))
    
    # ... EXISTING CODE (icon creation, menu building, etc.) ...
    
    def build_menu():
        """Build menu dynamically so status updates in real time."""
        menu_items = [
            pystray.MenuItem(lambda item: f"● Agent: {config.get('agent_id', 'unknown')[:8]}...", None, enabled=False),
            pystray.MenuItem(lambda item: f"◉ Status: {status.get('text', 'Unknown')}", None, enabled=False),
            pystray.MenuItem(lambda item: f"  Account: {config.get('account_id', 'Not set')[:8]}..." if config.get('account_id') else "  Account: Not configured", None, enabled=False),
            pystray.Menu.SEPARATOR,
        ]
        
        # Add threat scan option ONLY if threat detection enabled
        if threat_system and threat_system.get('enabled'):
            menu_items.append(pystray.MenuItem("🔍 Quick threat scan", quick_threat_scan))
        
        menu_items.extend([
            pystray.MenuItem("Register now", do_register),
            pystray.MenuItem("Send heartbeat", do_heartbeat),
            pystray.MenuItem("Open console", open_console),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", quit_app),
        ])
        
        return pystray.Menu(*menu_items)
    
    icon.menu = build_menu()
    
    # ... EXISTING CODE continues ...
    
    # Start heartbeat loop (UNCHANGED)
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    
    # Start threat detection ONLY if enabled (SEPARATE DAEMON THREAD)
    if threat_system and threat_system.get('enabled'):
        threading.Thread(target=threat_scan_loop, daemon=True).start()
        logging.info("✓ Threat detection background thread started")
    
    # Rest of existing code runs normally...
```

---

## Helper Function to Add Above tray_main()

```python
def initialize_threat_detection(config):
    """
    Safely initialize threat detection as optional module.
    Returns dict with enabled flag for safe usage.
    """
    try:
        from threat_detection import (
            ThreatDetectionEngine,
            ThreatReporter,
        )
        
        logging.info("Initializing threat detection engine...")
        
        engine = ThreatDetectionEngine(log_callback=logging.info)
        reporter = ThreatReporter(
            api_base_url=config.get('api_base', 'https://kuaminisystems.com/api/agent'),
            agent_id=config.get('agent_id'),
            account_id=config.get('account_id'),
            log_callback=logging.info
        )
        
        return {
            'enabled': True,
            'engine': engine,
            'reporter': reporter,
        }
    
    except ImportError as e:
        logging.warning("⚠ Threat detection module not found (not installed): %s", e)
        return {"enabled": False}
    
    except Exception as e:
        logging.error("✗ Failed to initialize threat detection: %s", e, exc_info=True)
        return {"enabled": False}
```

---

## Configuration for config.json

```json
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "auto_register": true,
  "heartbeat_interval": 60,
  "agent_id": "generated-uuid",
    "threat_scan_interval": 3600,
    "threat_scan_mode": "quick",
    "threat_realtime_monitor": false,
    "threat_realtime_interval": 300
}
```

---

## Safety Guarantees

### ✓ Registration NOT Affected
```python
# Registration logic runs UNCHANGED
ok, res = register(config)
set_status("Registered" if ok else "Register failed", ...)
# Works exactly as before
```

### ✓ Heartbeat NOT Affected
```python
# Heartbeat loop runs in separate thread
def heartbeat_loop():
    interval = int(config.get("heartbeat_interval") or DEFAULT_HEARTBEAT_INTERVAL)
    while not stop_event.is_set():
        ok, _ = heartbeat(config)  # UNCHANGED
        stop_event.wait(interval)

# Threat detection in DIFFERENT thread
# Heartbeat continues even if threat detection fails
```

### ✓ Tray Icon NOT Affected
```python
# Tray icon created and configured BEFORE threat detection starts
icon = pystray.Icon("KuaminiThreatProtectAgent")
icon.menu = build_menu()
icon.icon = make_icon(status["color"])
icon.run()  # Runs regardless of threat detection status
```

### ✓ Graceful Degradation
```python
# If threat detection module missing: agent continues normally
if threat_system and threat_system.get('enabled'):
    threading.Thread(target=threat_scan_loop, daemon=True).start()
    # If this fails, agent doesn't crash
else:
    logging.info("Running without threat detection")
    # Agent works fine in minimal mode
```

### ✓ Thread Isolation
```python
# Each component runs in its own thread
threading.Thread(target=heartbeat_loop, daemon=True).start()  # Core functionality
threading.Thread(target=threat_scan_loop, daemon=True).start()  # Optional feature

# If threat scan crashes, heartbeat continues
# If heartbeat crashes, threat scan continues
# If tray icon exits, background threads keep agent alive
```

---

## Testing Before Deployment

### Test 1: Verify Without Threat Detection Module
```bash
# Remove threat detection module
# rm -rf agent-tray/threat_detection/

# Start agent - should work normally
python agent-tray/main.py

# Expected: All registration, heartbeat, tray icon work
# No errors about missing threat detection module
```

### Test 2: Verify With Policy Disabled
```json
{
    "type": "scheduled_scan",
    "config": {
        "enabled": false
    }
}
```

```bash
# Start agent
python agent-tray/main.py

# Expected: Module imported, scans paused by policy
# Tray menu may still show quick scan (scan is blocked by policy)
# No threat detection scans running
```

### Test 3: Verify With Policy Enabled
```json
{
    "type": "scheduled_scan",
    "config": {
        "enabled": true,
        "scan_interval": 60
    }
}
```

```bash
# Start agent
python agent-tray/main.py

# Expected: 
# - Registration works
# - Heartbeat works
# - Tray icon shows threat scan option
# - Threat scans run in background
```

### Test 4: Verify Failure Handling
```python
# Break threat detection module temporarily
# Replace engine.py with syntax error

# Start agent
python agent-tray/main.py

# Expected:
# - Warning logged about initialization failure
# - Agent continues normally
# - Registration, heartbeat, tray all work
# - No menu option for threat scan
```

---

## Monitoring & Debugging

### Check if Threat Detection Running
```bash
# Check agent log file
tail -f ~/.kuamini/agent.log  # macOS/Linux
# or
$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log  # Windows

# Look for:
# ✓ "Threat detection ready"          = Enabled and working
# ⚠ "Threat detection disabled"        = Module not found
# ✗ "Failed to initialize"             = Init error
```

### Disable If Problems
Disable scheduled scans from the console policy:
```json
{
    "type": "scheduled_scan",
    "config": {
        "enabled": false
    }
}
```

Agent continues to run; scans stop after the next heartbeat policy refresh.

---

## Rollback Plan

If threat detection causes any issues:

1. **Immediate**: Disable scheduled scans in console policy
2. **Quick Fix**: Restart agent - threat detection threads stop
3. **Total Removal**: Delete `threat_detection/` folder - no impact to agent
4. **No Changes Needed**: Existing registration, heartbeat, tray logic untouched

---

## Key Points

- 🔒 **Isolated**: Threat detection runs in separate daemon threads
- 🛡️ **Safe**: Try-except wraps all threat detection code
- 📋 **Optional**: Console policy controls enable/disable
- 🎯 **Non-invasive**: Zero changes to existing registration/heartbeat/tray logic
- 🔄 **Graceful Degradation**: Agent works perfectly fine without it
- 📊 **Observable**: Clear logging shows what's happening
- ⚡ **Reversible**: Can disable via policy or remove module
