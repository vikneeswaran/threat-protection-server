# Implementation Guide: Adding Threat Detection to Your Agent

## Quick Start (5 minutes)

### Step 1: Add to requirements.txt
Your threat detection module needs `psutil` which is already in your requirements. No additional packages needed!

### Step 2: Import the module in main.py

Add this to your imports in `agent-tray/main.py`:

```python
# Add with other imports at the top
from threat_detection import (
    ThreatDetectionEngine,
    ThreatReporter,
    ThreatActionExecutor,
)
```

### Step 3: Initialize in tray_main()

Add this in the `tray_main()` function after loading config:

```python
def tray_main():
    setup_logging()
    logging.info("Starting Kuamini Agent Tray")
    config = load_config()
    
    # ===== ADD THIS SECTION =====
    # Initialize threat detection
    threat_engine = ThreatDetectionEngine(log_callback=logging.info)
    threat_reporter = ThreatReporter(
        api_base_url=config.get('api_base', 'https://kuaminisystems.com/api/agent'),
        agent_id=config.get('agent_id'),
        account_id=config.get('account_id'),
        log_callback=logging.info
    )
    threat_executor = ThreatActionExecutor(log_callback=logging.info)
    # ===== END SECTION =====
    
    # ... rest of existing code ...
```

### Step 4: Add threat scanning function

Add this function in `tray_main()` after the menu functions:

```python
def threat_scan_loop():
    """Background thread for periodic threat scanning"""
    endpoint_id = config.get("endpoint_id")
    scan_interval = int(config.get("threat_scan_interval", 3600))  # 1 hour default
    
    while not stop_event.is_set():
        try:
            logging.info("Starting scheduled threat scan...")
            
            # Perform full scan
            scan_report = threat_engine.full_scan()
            
            if scan_report.total_threats > 0:
                logging.warning(f"THREATS DETECTED: {scan_report.total_threats}")
                
                # Report to server
                success, results = threat_reporter.report_scan_results(
                    scan_report,
                    endpoint_id=endpoint_id
                )
                
                if success:
                    logging.info("✓ Threats reported to server")
                else:
                    logging.error("Failed to report threats")
                    
                # Update UI status to show warning
                set_status(f"Threats: {scan_report.total_threats}", (231, 76, 60))
            else:
                logging.info("✓ Scan complete - No threats found")
                set_status("Protected", (46, 204, 113))
        
        except Exception as e:
            logging.error(f"Error in threat scan: {e}", exc_info=True)
        
        # Wait for next scan interval
        for _ in range(scan_interval):
            if stop_event.is_set():
                break
            stop_event.wait(1)
```

### Step 5: Start threat scan thread

Add this after the heartbeat thread in `tray_main()`:

```python
threading.Thread(target=threat_scan_loop, daemon=True).start()
logging.info("✓ Threat detection thread started")
```

### Step 6: Add quick scan to menu

Add this function for on-demand scanning:

```python
def quick_threat_scan(icon_, item):
    """Run quick threat scan on demand"""
    set_status("Scanning...", (255, 165, 0))
    logging.info("Quick threat scan requested by user")
    
    try:
        scan_report = threat_engine.quick_scan()
        
        if scan_report.total_threats > 0:
            logging.warning(f"Found {scan_report.total_threats} threats")
            set_status(f"Threats: {scan_report.total_threats}", (231, 76, 60))
            
            # Report to server
            threat_reporter.report_scan_results(
                scan_report,
                endpoint_id=config.get("endpoint_id")
            )
        else:
            logging.info("Quick scan complete - Clean")
            set_status("Protected", (46, 204, 113))
    
    except Exception as e:
        logging.error(f"Quick scan error: {e}")
        set_status("Scan error", (255, 0, 0))
```

### Step 7: Add to menu

In `build_menu()`, add the quick scan option:

```python
def build_menu():
    """Build menu dynamically so status updates in real time."""
    return pystray.Menu(
        pystray.MenuItem(lambda item: f"● Agent: {config.get('agent_id', 'unknown')[:8]}...", None, enabled=False),
        pystray.MenuItem(lambda item: f"◉ Status: {status.get('text', 'Unknown')}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Run quick scan", quick_threat_scan),  # ADD THIS LINE
        pystray.MenuItem("Register now", do_register),
        pystray.MenuItem("Send heartbeat", do_heartbeat),
        pystray.MenuItem("Open console", open_console),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", quit_app),
    )
```

## Configuration

Add these optional settings to your `config.json`:

```json
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "heartbeat_interval": 60,
  "threat_scan_interval": 3600,
  "threat_scan_mode": "quick",
  "threat_realtime_monitor": false,
  "threat_realtime_interval": 300
}

Note: enable/disable is controlled by console policies returned in heartbeat; local config is used only for default intervals.
```

## Testing

Test the threat detection locally:

```bash
# Quick test
cd agent-tray
python -c "
from threat_detection import ThreatDetectionEngine
engine = ThreatDetectionEngine()
report = engine.quick_scan()
print(f'Found {report.total_threats} threats')
for t in report.threats:
    print(f'  - {t[\"threat_name\"]} ({t[\"severity\"]})')
"
```

## Full Integration Code Example

Here's the complete integrated section for `main.py`:

```python
def tray_main():
    """Run as full tray application with icon and menu."""
    setup_logging()
    logging.info("Starting Kuamini Agent Tray")
    config = load_config()
    
    # ===== THREAT DETECTION INITIALIZATION =====
    from threat_detection import (
        ThreatDetectionEngine,
        ThreatReporter,
        ThreatActionExecutor,
    )
    
    threat_engine = ThreatDetectionEngine(log_callback=logging.info)
    threat_reporter = ThreatReporter(
        api_base_url=config.get('api_base', 'https://kuaminisystems.com/api/agent'),
        agent_id=config.get('agent_id'),
        account_id=config.get('account_id'),
        log_callback=logging.info
    )
    threat_executor = ThreatActionExecutor(log_callback=logging.info)
    # ===== END THREAT DETECTION =====

    # ... existing code ...
    
    def threat_scan_loop():
        """Background threat scanning"""
        endpoint_id = config.get("endpoint_id")
        scan_interval = int(config.get("threat_scan_interval", 3600))
        
        while not stop_event.is_set():
            try:
                logging.info("Starting scheduled threat scan...")
                scan_report = threat_engine.full_scan()
                
                if scan_report.total_threats > 0:
                    logging.warning(f"THREATS: {scan_report.total_threats}")
                    threat_reporter.report_scan_results(
                        scan_report,
                        endpoint_id=endpoint_id
                    )
                    set_status(f"Threats: {scan_report.total_threats}", (231, 76, 60))
                else:
                    set_status("Protected", (46, 204, 113))
            
            except Exception as e:
                logging.error(f"Threat scan error: {e}", exc_info=True)
                time.sleep(60)
                continue
            
            stop_event.wait(scan_interval)
    
    def quick_threat_scan(icon_, item):
        """On-demand threat scan"""
        set_status("Scanning...", (255, 165, 0))
        try:
            scan_report = threat_engine.quick_scan()
            if scan_report.total_threats > 0:
                set_status(f"Found {scan_report.total_threats}", (231, 76, 60))
                threat_reporter.report_scan_results(
                    scan_report,
                    endpoint_id=config.get("endpoint_id")
                )
            else:
                set_status("Clean", (46, 204, 113))
        except Exception as e:
            logging.error(f"Scan error: {e}")
            set_status("Scan failed", (255, 0, 0))
    
    # ... existing code ...
    
    def build_menu():
        """Build menu dynamically"""
        return pystray.Menu(
            pystray.MenuItem(lambda item: f"● Agent: {config.get('agent_id', 'unknown')[:8]}...", None, enabled=False),
            pystray.MenuItem(lambda item: f"◉ Status: {status.get('text', 'Unknown')}", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quick threat scan", quick_threat_scan),
            pystray.MenuItem("Register now", do_register),
            pystray.MenuItem("Send heartbeat", do_heartbeat),
            pystray.MenuItem("Open console", open_console),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", quit_app),
        )
    
    # ... existing icon setup code ...
    
    # Start threat detection
    threading.Thread(target=threat_scan_loop, daemon=True).start()
    logging.info("✓ Threat detection started")
    
    # ... rest of existing code ...
```

## What Gets Scanned

### Quick Scan (5-10 minutes)
- Downloads folder
- Desktop
- Temp directories
- Running processes
- Registry (Windows)

### Full Scan (30+ minutes)
- Entire user home directory
- Program files
- Temp directories
- All processes
- Registry (Windows)

### Realtime (5 minutes)
- Running processes only
- Registry changes
- Lightweight

## API Integration

Threats are automatically reported to your existing API:

```
POST /api/agent/threat
{
  "agent_id": "uuid",
  "account_id": "uuid",
  "endpoint_id": "uuid",
  "threat_name": "Malware.X",
  "threat_type": "trojan",
  "severity": "critical",
  "file_path": "C:\\infected.exe",
  "detection_engine": "signature"
}
```

No changes needed to your backend - the endpoint already exists!

## Monitoring & Logs

Check logs for threat detection activity:

```
[2026-02-09 10:00:00] [INFO] Starting scheduled threat scan...
[2026-02-09 10:00:05] [INFO] Scanning critical directories...
[2026-02-09 10:00:10] [INFO] Scanning running processes...
[2026-02-09 10:00:15] [INFO] Checking registry...
[2026-02-09 10:00:20] [WARNING] THREATS DETECTED: 2
[2026-02-09 10:00:25] [INFO] Reporting threats to server...
[2026-02-09 10:00:30] [INFO] ✓ Threats reported successfully
```

## Next Steps

1. Copy `threat_detection/` to `agent-tray/`
2. Update `main.py` with integration code above
3. Test with `python -c "from threat_detection import ThreatDetectionEngine"`
4. Build and test the installer
5. Deploy to test machines
6. Monitor threat reports in console

## Troubleshooting

### Module not found
```bash
# Make sure threat_detection folder is in agent-tray/
# and __init__.py exists
ls agent-tray/threat_detection/
```

### API reporting fails
```python
# Check API configuration
config['api_base'] = 'https://kuaminisystems.com/api/agent'
config['agent_id']  # Must be set
config['account_id']  # Must be set
```

### No threats detected
- Threat signatures updated? Check `signatures.py`
- Scan actually running? Check logs
- Add test threat to Downloads folder for testing

## Performance Impact

- **Quick scan**: ~5-10% CPU, minimal disk I/O
- **Full scan**: ~30% CPU, heavy disk I/O (schedule off-hours)
- **Realtime**: <1% CPU (process/registry only)

Run full scans during off-hours to minimize impact on users.
