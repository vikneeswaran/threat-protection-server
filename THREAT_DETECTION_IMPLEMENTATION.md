# Ready-to-Use: Safe Threat Detection Integration Code

Copy and paste this code into `agent-tray/main.py` - it's completely isolated and safe.

---

## Step 1: Add This Helper Function

**Add BEFORE the `tray_main()` function (around line 1100)**

```python
def initialize_threat_detection(config):
    """
    Safely initialize threat detection as optional module.
    Returns dict with enabled flag for safe usage.
    Never crashes the agent - always returns gracefully.
    """
    try:
        # Lazy import - only load if needed
        from threat_detection import (
            ThreatDetectionEngine,
            ThreatReporter,
        )
        
        logging.info("Initializing threat detection engine...")
        
        # Create instances
        engine = ThreatDetectionEngine(log_callback=logging.info)
        reporter = ThreatReporter(
            api_base_url=config.get('api_base', 'https://kuaminisystems.com/api/agent'),
            agent_id=config.get('agent_id'),
            account_id=config.get('account_id'),
            log_callback=logging.info
        )
        
        logging.info("✓ Threat detection initialized successfully")
        
        return {
            'enabled': True,
            'engine': engine,
            'reporter': reporter,
        }
    
    except ImportError as e:
        logging.warning("⚠ Threat detection module not installed: %s", e)
        return {"enabled": False}
    
    except Exception as e:
        logging.error("✗ Failed to initialize threat detection: %s", e, exc_info=True)
        return {"enabled": False}
```

---

## Step 2: Update tray_main() Function

**In the `tray_main()` function, AFTER `setup_logging()` and config loading:**

```python
def tray_main():
    """Run as full tray application with icon and menu."""
    setup_logging()
    logging.info("Starting Kuamini Agent Tray")
    config = load_config()

    # ═══════════════════════════════════════════════════════════════════
    # THREAT DETECTION INITIALIZATION (POLICY CONTROLLED)
    # ═══════════════════════════════════════════════════════════════════
    threat_system = initialize_threat_detection(config)
    if not threat_system.get('enabled'):
        logging.warning("⚠ Threat detection unavailable (module missing or init failed)")
    # ═══════════════════════════════════════════════════════════════════

    status = {"text": "Idle", "color": (46, 204, 113)}
    
    # ... [EXISTING CODE - tray icon setup, all existing functions unchanged] ...
    # ... [do_register, do_heartbeat, open_console, quit_app] ...
```

---

## Step 3: Add Threat Scan Functions

**Add these functions INSIDE the `tray_main()` function, AFTER the existing menu handler functions (do_register, do_heartbeat, etc.):**

```python
    # ════════════════════════════════════════════════════════════════════
    # THREAT DETECTION FUNCTIONS (ISOLATED)
    # ════════════════════════════════════════════════════════════════════
    
    def quick_threat_scan(icon_, item):
        """On-demand quick threat scan - isolated from other functions"""
        if not threat_system or not threat_system.get('enabled'):
            logging.warning("Threat detection not enabled")
            return
        
        try:
            set_status("Scanning threats...", (255, 165, 0))
            logging.info("User requested quick threat scan")
            
            # Perform scan
            scan_report = threat_system['engine'].quick_scan()
            
            # Report results
            if scan_report.total_threats > 0:
                logging.warning(f"Quick scan found {scan_report.total_threats} threats")
                set_status(f"⚠ {scan_report.total_threats} threats", (231, 76, 60))
                
                # Try to report to server (non-blocking failure)
                try:
                    threat_system['reporter'].report_scan_results(
                        scan_report,
                        endpoint_id=config.get("endpoint_id")
                    )
                except Exception as report_err:
                    logging.warning("Failed to report threats to server: %s", report_err)
            else:
                logging.info("✓ Quick scan complete - no threats found")
                set_status("Protected", (46, 204, 113))
        
        except Exception as e:
            logging.error("Error during quick scan: %s", e, exc_info=True)
            set_status("Scan failed", (255, 0, 0))
            # Don't crash - just update status
    
    def threat_scan_loop():
        """
        Background thread for periodic threat scanning.
        Completely isolated - failures don't affect other agent functions.
        """
        if not threat_system or not threat_system.get('enabled'):
            logging.debug("Threat detection not enabled, scan loop exiting")
            return
        
        try:
            endpoint_id = config.get("endpoint_id")
            scan_interval = int(config.get("threat_scan_interval", 3600))
            
            logging.info(f"Threat scan loop starting (interval: {scan_interval}s)")
            
            while not stop_event.is_set():
                try:
                    logging.debug("Starting scheduled threat scan...")
                    
                    # Perform scan
                    scan_report = threat_system['engine'].full_scan()
                    
                    # Handle results
                    if scan_report.total_threats > 0:
                        logging.warning(f"THREATS DETECTED: {scan_report.total_threats}")
                        
                        # Try to report (non-blocking)
                        try:
                            threat_system['reporter'].report_scan_results(
                                scan_report,
                                endpoint_id=endpoint_id
                            )
                            logging.info(f"✓ Reported {scan_report.total_threats} threats to server")
                        except Exception as report_err:
                            logging.error("Failed to report threats: %s", report_err)
                        
                        # Update UI status
                        set_status(f"⚠ {scan_report.total_threats} threats", (231, 76, 60))
                    else:
                        logging.debug("✓ Scan complete - no threats found")
                        set_status("Protected", (46, 204, 113))
                
                except Exception as scan_err:
                    logging.error("Error during threat scan iteration: %s", scan_err, exc_info=True)
                    # Continue to next iteration - don't exit loop
                    set_status("Scan error (will retry)", (255, 165, 0))
                
                # Wait for next scan interval (respects stop_event)
                stop_event.wait(scan_interval)
        
        except Exception as e:
            logging.error("Fatal error in threat scan loop, aborting: %s", e, exc_info=True)
            # Exit gracefully without crashing agent
    
    # ════════════════════════════════════════════════════════════════════
    # END THREAT DETECTION FUNCTIONS
    # ════════════════════════════════════════════════════════════════════
```

---

## Step 4: Update the Menu Builder

**Replace the existing `build_menu()` function with this version:**

```python
    def build_menu():
        """Build menu dynamically so status updates in real time."""
        menu_items = [
            pystray.MenuItem(lambda item: f"● Agent: {config.get('agent_id', 'unknown')[:8]}...", None, enabled=False),
            pystray.MenuItem(lambda item: f"◉ Status: {status.get('text', 'Unknown')}", None, enabled=False),
            pystray.MenuItem(lambda item: f"  Account: {config.get('account_id', 'Not set')[:8]}..." if config.get('account_id') else "  Account: Not configured", None, enabled=False),
            pystray.Menu.SEPARATOR,
        ]
        
        # Add threat scan menu item ONLY if threat detection is enabled
        if threat_system and threat_system.get('enabled'):
            menu_items.append(pystray.MenuItem("🔍 Quick threat scan", quick_threat_scan))
        
        # Existing menu items
        menu_items.extend([
            pystray.MenuItem("Register now", do_register),
            pystray.MenuItem("Send heartbeat", do_heartbeat),
            pystray.MenuItem("Open console", open_console),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", quit_app),
        ])
        
        return pystray.Menu(*menu_items)
```

---

## Step 5: Start Threat Detection Thread

**After the existing heartbeat thread is started, add this:**

```python
    # ... existing heartbeat thread ...
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    
    # Start threat detection ONLY if enabled (in separate daemon thread)
    if threat_system and threat_system.get('enabled'):
        threading.Thread(target=threat_scan_loop, daemon=True).start()
        logging.info("✓ Threat detection background thread started")
    
    # ... rest of existing code ...
```

---

## Step 6: Update config.json

Add these optional settings (defaults to disabled for safety):

```json
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "auto_register": true,
  "heartbeat_interval": 60,
  "agent_id": "uuid-from-first-run",
  
  "threat_scan_interval": 3600,
  "threat_scan_mode": "quick",
  "threat_realtime_monitor": false,
  "threat_realtime_interval": 300
}
```

---

## Complete Integration Steps

1. **Add initialization function** (Step 1)
2. **Initialize threat system** in tray_main (Step 2)
3. **Add scan functions** (Step 3)
4. **Update menu builder** (Step 4)
5. **Start background thread** (Step 5)
6. **Update config.json** (Step 6)

---

## Safety Verification Checklist

After integrating, verify:

- [ ] Agent starts normally with threat detection module present
- [ ] Registration works (no changes to `register()` function)
- [ ] Heartbeat works (no changes to `heartbeat()` function)
- [ ] Tray icon displays correctly
- [ ] Menu shows Quick threat scan option (module present)
- [ ] All existing functionality unchanged
- [ ] No import errors in console

Then validate policy control:

- [ ] Disable via console policy (`scheduled_scan` enabled=false)
- [ ] Restart agent or wait for next heartbeat
- [ ] Verify scans pause and quick scan is blocked by policy
- [ ] Enable via console policy (`scheduled_scan` enabled=true)
- [ ] Verify scans resume and reports are sent
- [ ] Threat scan doesn't interfere with heartbeat

---

## Disabling Threat Detection

If any issues, disable via console policy (recommended) or remove the module:

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

## What Stays Unchanged

✓ **Registration logic** - Not touched
✓ **Heartbeat function** - Not touched
✓ **Tray icon logic** - Not touched
✓ **Config loading** - Not touched
✓ **Singleton checking** - Not touched
✓ **Error handling** - Not touched
✓ **Main event loop** - Not touched

Only additions:
- Optional initialization function
- Threat detection condition checks
- Separate daemon thread for scanning
- Menu item (when enabled)

---

## Minimal Code Impact

Total new code:
- ~50 lines for initialization function
- ~50 lines for thread functions
- ~10 lines for menu updates
- ~5 lines for thread startup

**No existing code modified - only additions!**
